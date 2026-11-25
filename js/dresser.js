// Essayage virtuel WebGL : une photo studio + un masque (R = vêtement, G = personne) par modèle.
// Chaque produit = recoloration du vêtement dans un shader (ombres, plis, coutures conservés).
// Les produits voisins flottent à gauche / droite (ghost flouté) puis viennent habiller le modèle.
import * as THREE from "three";

// le plan se courbe comme un tissu (cylindre) : uBend = 0 -> plat
const VERT = /* glsl */`
uniform float uBend;
varying vec2 vUv;
void main(){
  vUv = uv;
  vec3 p = position;
  p.z -= p.x * p.x * uBend;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;

const COMMON = /* glsl */`
uniform sampler2D tPhoto; uniform sampler2D tMask; uniform float uMeanLum; uniform float uFade; uniform float uDark;
vec3 toLin(vec3 c){ return pow(max(c,0.), vec3(2.2)); }
vec3 toSrgb(vec3 c){ return pow(clamp(c,0.,1.), vec3(1.0/2.2)); }
// c.a = 1 -> couleur d'origine
vec3 recolor(vec3 p, vec4 c){
  if(c.a > 0.5) return p;
  vec3 pl = toLin(p);
  float L = dot(pl, vec3(.2126,.7152,.0722));
  if(uDark > 0.5){
    // tissu foncé brillant : teinte sur les ombres, reflets blancs conservés (effet laqué)
    float sd = clamp(L / uMeanLum, 0.0, 3.0);
    vec3 rd = toLin(c.rgb) * pow(min(sd, 1.5), 0.8);
    rd += smoothstep(0.10, 0.6, L) * 0.6;
    return toSrgb(rd);
  }
  float s = L / uMeanLum;
  s = s < 1.0 ? s : 1.0 + (1.0 - exp(-(s - 1.0) * 1.6)) * 0.45;  // compresse les zones brûlées (pas de tache claire)
  // couleur cible plus claire que le tissu d'origine : on adoucit le contraste (sinon taches / bruit)
  float tl = dot(toLin(c.rgb), vec3(.2126,.7152,.0722));
  float lighter = smoothstep(0.0, 0.5, tl - uMeanLum);
  s = mix(s, 1.0 + (s - 1.0) * 0.45, lighter);
  s = pow(max(s, 0.0), 0.9);
  vec3 r = toLin(c.rgb) * s;
  r += max(s - 1.15, 0.0) * 0.12;
  return toSrgb(r);
}
uniform sampler2D tPipe;
// passepoil (R) + son ombre portée (G) : reste blanc cassé quelle que soit la couleur, suit les plis du tissu
vec3 applyPipe(vec3 col, vec3 base, vec2 uv){
  vec2 pp = texture2D(tPipe, uv).rg;
  float L = dot(base, vec3(.299,.587,.114));
  float sh = clamp(0.6 + 0.75 * (L - 0.34) / 0.5, 0.55, 1.08);
  col *= 1.0 - pp.g * 0.42;
  return mix(col, vec3(0.95, 0.94, 0.91) * sh, pp.r);
}
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y); }
`;

const MODEL_FRAG = /* glsl */`
${COMMON}
uniform vec4 uColA; uniform vec4 uColB; uniform float uMix; uniform float uTime; uniform float uBottomFade; uniform vec3 uBg; uniform float uStudio;
varying vec2 vUv;
void main(){
  vec3 p = texture2D(tPhoto, vUv).rgb;
  vec4 m = texture2D(tMask, vUv);
  float g = smoothstep(0.04, 0.5, m.r);                 // couvre aussi les bords (pas de liseré)
  float person = smoothstep(0.42, 0.98, m.g);
  vec3 praw = p;
  // retire la couleur du fond studio mélangée dans les bords (pas de halo)
  p = clamp((p - (1.0 - m.g) * uBg) / max(m.g, 0.2), 0.0, 1.0);
  p = mix(p, praw, uStudio);                              // mode studio : on garde la photo telle quelle
  // "enfiler" : la nouvelle couleur descend depuis la capuche / le col, avec un bord de tissu ondulé
  // bord de transition très doux et régulier (aucune tache, aucun bruit)
  float wave = sin(vUv.x * 4.0 + uTime * 1.2) * 0.012;
  float front = uMix * 1.6 - 0.3;                        // 0 -> haut, 1 -> tout le vêtement
  float s = (1.0 - vUv.y) + wave;
  float k = smoothstep(front + 0.22, front - 0.22, s);
  vec3 col = mix(recolor(p, uColA), recolor(p, uColB), k);
  col = applyPipe(col, p, vUv);
  vec3 outc = mix(p, col, g);
  // mode studio (comme le reel) : le vrai fond de la photo, fondu doucement dans la couleur de la page
  float vign = smoothstep(0.0, 0.16, vUv.x) * smoothstep(1.0, 0.84, vUv.x) * smoothstep(1.0, 0.9, vUv.y);
  float a = mix(person, max(person, vign), uStudio) * uFade * smoothstep(0.0, uBottomFade, vUv.y);
  gl_FragColor = vec4(outc * a, a);
}`;

const GHOST_FRAG = /* glsl */`
${COMMON}
uniform sampler2D tGhost; uniform vec4 uCol; uniform float uOpacity; uniform float uBlur; uniform float uWash; uniform float uCut; uniform float uTime;
varying vec2 vUv;
void main(){
  // tGhost = vêtement complet (mains / cou effacés), masque B = silhouette pleine
  vec3 acc = vec3(0.); float ga = 0.; float wsum = 0.;
  for(int i = 0; i < 12; i++){
    float a = float(i) * 2.39996; float r = sqrt(float(i) / 12.0);
    vec2 o = vec2(cos(a), sin(a)) * r * uBlur;
    float w = 1.0 - r * 0.5;
    float gm = texture2D(tMask, vUv + o).b;
    acc += texture2D(tGhost, vUv + o).rgb * gm * w;
    ga += gm * w; wsum += w;
  }
  vec3 p = ga > 0.001 ? acc / ga : vec3(0.);
  float cov = smoothstep(0.3, 0.9, ga / wsum);
  float alpha = cov * uOpacity * uFade;
  // "s'enfile" : la partie haute du vêtement fond dans le modèle, en suivant le même front que lui
  float front = uCut * 1.6 - 0.3;
  float sy = (1.0 - vUv.y) + sin(vUv.x * 4.0 + uTime * 1.2) * 0.012;
  alpha *= smoothstep(front - 0.22, front + 0.22, sy);
  vec3 gc = mix(applyPipe(recolor(p, uCol), p, vUv), vec3(0.97, 0.96, 0.96), uWash);
  gl_FragColor = vec4(gc * alpha, alpha);
}`;

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const vec4Of = (hex, original) => { const c = new THREE.Color(hex); return new THREE.Vector4(c.r, c.g, c.b, original ? 1 : 0); };
const EMPTY_TEX = (() => { const t = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1); t.needsUpdate = true; return t; })();
const blendOpts = { transparent: true, depthTest: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor };

export function createDresser(canvas) {
  THREE.ColorManagement.enabled = false;
  const isMobile = matchMedia("(max-width: 820px)").matches;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, premultipliedAlpha: true, preserveDrawingBuffer: false });
  renderer.setPixelRatio(Math.min(devicePixelRatio, isMobile ? 1.5 : 2));
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;

  const loader = new THREE.TextureLoader();
  const loadTex = (u) => new Promise((res, rej) => loader.load(u, (t) => {
    t.colorSpace = THREE.NoColorSpace; t.anisotropy = 4; res(t);
  }, undefined, rej));

  const scene = new THREE.Scene();
  const FOV = 32;
  const camera = new THREE.PerspectiveCamera(FOV, 1, 1, 5000);
  const group = new THREE.Group();          // tout le "plateau" 3D, incliné par la souris
  scene.add(group);
  const geo = new THREE.PlaneGeometry(1, 1, 24, 1);

  // poussière / particules en profondeur (parallaxe 3D)
  const DUST = isMobile ? 120 : 260;
  const dustGeo = new THREE.BufferGeometry();
  const dustPos = new Float32Array(DUST * 3), dustSeed = new Float32Array(DUST);
  for (let i = 0; i < DUST; i++) dustSeed[i] = Math.random();
  dustGeo.setAttribute("position", new THREE.BufferAttribute(dustPos, 3));
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ color: 0x111111, size: 2.2, transparent: true, opacity: 0.22, depthWrite: false }));
  dust.renderOrder = -1; scene.add(dust);
  function layoutDust() {
    for (let i = 0; i < DUST; i++) {
      const r = dustSeed[i];
      dustPos[i * 3] = (Math.random() - 0.5) * W * 1.4;
      dustPos[i * 3 + 1] = (Math.random() - 0.5) * H * 1.2;
      dustPos[i * 3 + 2] = -r * 900 + 120;
    }
    dustGeo.attributes.position.needsUpdate = true;
  }
  const mouse = { x: 0, y: 0, sx: 0, sy: 0 };
  addEventListener("pointermove", (e) => { mouse.x = e.clientX / innerWidth - 0.5; mouse.y = e.clientY / innerHeight - 0.5; }, { passive: true });
  const shared = { uFade: { value: 0 }, uTime: { value: 0 }, uBottomFade: { value: 0.02 } };

  let set = null;        // { colors, vecs, tPhoto, tMask, meta, model, ghosts }
  const cache = new Map();

  async function prepare(def) {
    if (cache.has(def.key)) return cache.get(def.key);
    const [tPhoto, tMask, tGhost, meta, tPipe] = await Promise.all([loadTex(def.photo), loadTex(def.mask), loadTex(def.ghost), fetch(def.meta).then((r) => r.json()),
      def.pipe ? loadTex(def.pipe) : Promise.resolve(EMPTY_TEX)]);
    const vecs = def.colors.map((c) => vec4Of(c.hex, c.original));
    const base = { tPhoto: { value: tPhoto }, tMask: { value: tMask }, tPipe: { value: tPipe }, uMeanLum: { value: meta.meanLum }, uFade: shared.uFade,
      uDark: { value: meta.mode === "dark" ? 1 : 0 } };
    const model = new THREE.Mesh(geo, new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: MODEL_FRAG, ...blendOpts,
      uniforms: { ...base, uStudio: { value: 0 }, uBg: { value: new THREE.Color(meta.bg || "#cccccc") }, uBend: { value: 0 }, uTime: shared.uTime, uBottomFade: shared.uBottomFade, uColA: { value: vecs[0].clone() }, uColB: { value: vecs[0].clone() }, uMix: { value: 0 } } }));
    model.renderOrder = 1;
    const ghosts = vecs.map((v) => {
      const g = new THREE.Mesh(geo, new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: GHOST_FRAG, ...blendOpts,
        uniforms: { ...base, uTime: shared.uTime, uCut: { value: 0 }, uWash: { value: 0 }, uBend: { value: 0 }, tGhost: { value: tGhost }, uCol: { value: v }, uOpacity: { value: 0 }, uBlur: { value: 0 } } }));
      g.renderOrder = 2; return g;
    });
    const s = { key: def.key, colors: def.colors, vecs, meta, model, ghosts };
    cache.set(def.key, s);
    return s;
  }

  // ---- mise en page (pixels CSS) ----
  let W = 1, H = 1, PW = 1, PH = 1, spacing = 1, baseY = 0;
  function resize() {
    W = canvas.clientWidth; H = canvas.clientHeight;
    if (!W || !H) return;
    renderer.setSize(W, H, false);
    // caméra perspective calée pour que 1 unité = 1 pixel CSS sur le plan z = 0
    camera.aspect = W / H;
    camera.position.z = H / 2 / Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    camera.far = camera.position.z * 4; camera.near = 1;
    camera.updateProjectionMatrix();
    layoutDust();
    if (!set) return;
    const mobile = W < 820, aspect = set.meta.aspect;
    if (mobile) {
      // modèle en haut (sous le header), fondu en bas, texte en dessous
      // mobile comme le PC : grand modèle au centre, vêtements en attente sur les côtés
      PH = Math.min(H * 0.7, (W * 1.18) / aspect);
      PW = PH * aspect;
      baseY = -H / 2 + PH / 2 + H * 0.12;
      spacing = W * 0.58;
      shared.uBottomFade.value = 0.14;
    } else {
      // comme le reel : modèle net au centre, beaucoup d'air autour
      PH = Math.min(H * 0.8, W * 0.9 / aspect);
      PW = PH * aspect;
      baseY = -H * 0.035;
      spacing = Math.max(PW * 0.95, W * 0.33);
      shared.uBottomFade.value = 0.07;
    }
    set.model.scale.set(PW, PH, 1); set.model.position.set(0, baseY, 0);
  }
  new ResizeObserver(() => resize()).observe(canvas);

  let pos = 0, target = 0, vel = 0, time = 0, lastIdx = -1, fadeTarget = 1, showMode = false, spinSpeed = 0, spinTarget = 0;
  const listeners = [];
  const reduce = false; // démo vitrine : l animation 3D est le produit, on la garde même si Windows réduit les animations

  const wrapN = (v, n) => ((v % n) + n) % n;
  function layout() {
    if (!set) return;
    const n = set.colors.length;
    // position circulaire : pos peut grandir à l'infini, on boucle sur les n coloris
    const fl = Math.floor(pos), f = pos - fl;
    const i0 = wrapN(fl, n), i1 = wrapN(fl + 1, n);
    const mu = set.model.material.uniforms;
    mu.uColA.value.copy(set.vecs[i0]); mu.uColB.value.copy(set.vecs[i1]);
    mu.uMix.value = spinSpeed > 0.02 ? smooth(0.5, 0.97, f) : smooth(0.3, 1.0, f);
    const gc = set.meta.garmentCenter;
    const gx = (gc[0] - 0.5) * PW, gy = (gc[1] - 0.5) * PH;
    // ANNEAU 3D : tous les vêtements tournent autour du modèle ; celui qui passe devant vient l'habiller
    const STEP = (Math.PI * 2) / n;
    const RX = Math.min(spacing * 1.08, W * 0.44), RZ = RX * 0.85;
    set.ghosts.forEach((g, i) => {
      let d = wrapN(i - pos + n / 2, n) - n / 2;            // écart circulaire dans [-n/2, n/2)
      const a = Math.abs(d), sgn = Math.sign(d) || 1;
      const theta = d * STEP;
      const incoming = i === i1 && f > 0.0001;
      // en arrivant devant (a < 1) le vêtement quitte l'anneau et se pose sur le modèle
      const t = Math.min(a, 1), rf = t * t * (3 - 2 * t);
      const x = Math.sin(theta) * RX * rf;
      const z = Math.cos(theta) * RZ * rf - (1 - rf) * 0 + (a < 1 ? 70 * Math.sin(t * Math.PI) : 0);
      const front = Math.cos(theta);                       // 1 = devant, -1 = derrière le modèle
      let op;
      if (a <= 0.5) op = incoming ? 0.96 : 0.9 * smooth(0.04, 0.5, a);
      else if (a <= 1) op = 0.9 + (0.62 - 0.9) * ((a - 0.5) / 0.5);
      else op = 0.72 * (0.6 + 0.4 * Math.max(0, front)) + 0.08;
      const s = 1 - 0.22 * t;
      const bob = Math.sin(time * 1.1 + i * 1.7) * 10 * t;
      const lift = (1 - front) * 0.5 * PH * 0.16 * rf;      // anneau incliné : on voit la forme de la ronde
      g.scale.set(PW * s, PH * s, PW * s);
      g.position.set(x + gx - gx * s, baseY + gy - gy * s + bob + t * 14 + lift, z);
      g.rotation.set(0, -theta * 0.55, -sgn * 0.04 * t);
      g.material.uniforms.uBend.value = 0.28 * t;
      g.material.uniforms.uOpacity.value = op;
      g.material.uniforms.uCut.value = incoming ? mu.uMix.value : 0;
      g.material.uniforms.uBlur.value = (0.004 + 0.008 * Math.max(0, -front)) * t;   // plus flou derrière
      g.material.uniforms.uWash.value = (0.12 + 0.35 * Math.max(0, -front)) * t;     // couleurs visibles devant
      g.renderOrder = (a < 0.6 || z > 25) ? 3 : 0;           // devant ou derrière le modèle selon la profondeur
      g.visible = op > 0.003;
    });
    const idx = wrapN(Math.round(pos), n);
    if (idx !== lastIdx) { lastIdx = idx; listeners.forEach((fn) => fn(idx)); }
  }

  let running = true, raf = 0;
  const clock = new THREE.Clock();
  function loop() {
    const dt = Math.min(clock.getDelta(), 0.05);
    time += dt;
    // ressort amorti : départ et arrivée tout en douceur (pas de saut)
    spinSpeed += (spinTarget - spinSpeed) * Math.min(1, dt * 2.6);     // monte / descend en vitesse en douceur
    if (reduce) { pos = target; vel = 0; }
    else if (spinTarget > 0 || spinSpeed > 0.02) {
      // l'anneau tourne en continu ; à l'arrêt on finit proprement sur le hoodie le plus proche
      pos += spinSpeed * dt; vel = spinSpeed;
      target = spinTarget > 0 ? pos : Math.ceil(pos);
      if (spinTarget === 0 && spinSpeed <= 0.02) { spinSpeed = 0; }
    } else {
      const stiff = showMode ? 9 : 38, damp = 2 * Math.sqrt(stiff) * 1.05;
      vel += ((target - pos) * stiff - vel * damp) * dt;
      pos += vel * dt;
      if (Math.abs(target - pos) < 0.0004 && Math.abs(vel) < 0.002) { pos = target; vel = 0; }
    }
    const fk = reduce ? 1 : 1 - Math.pow(0.0004, dt);
    shared.uFade.value += (fadeTarget - shared.uFade.value) * fk;
    shared.uTime.value = time;
    // parallaxe 3D : le plateau suit la souris + respiration lente
    const mk = 1 - Math.pow(0.02, dt);
    mouse.sx += (mouse.x - mouse.sx) * mk; mouse.sy += (mouse.y - mouse.sy) * mk;
    if (!reduce) {
      // pendant un changement : tout le plateau pivote légèrement et recule (effet caméra 3D)
      const swing = Math.max(-1, Math.min(1, (spinSpeed > 0.02 ? vel * 0.35 : vel * 0.9)));
      group.rotation.y = mouse.sx * 0.22 + Math.sin(time * 0.35) * 0.03 - swing * 0.16;
      group.rotation.x = mouse.sy * 0.07;
      group.position.z += (-Math.abs(swing) * 140 - group.position.z) * Math.min(1, dt * 6);
      dust.rotation.y = mouse.sx * 0.35; dust.rotation.x = mouse.sy * 0.12;
      dust.position.y = (time * 6) % 40;
    }
    layout();
    renderer.render(scene, camera);
    if (running) raf = requestAnimationFrame(loop);
  }
  new IntersectionObserver(([e]) => {
    if (e.isIntersecting && !running) { running = true; clock.getDelta(); loop(); }
    if (!e.isIntersecting) { running = false; cancelAnimationFrame(raf); }
  }).observe(canvas);

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  async function useSet(def, startIdx = 0) {
    const next = await prepare(def);
    if (set && set.key === next.key) { const n = set.colors.length; target = startIdx + n * Math.round((pos - startIdx) / n); return; }
    if (set) { fadeTarget = 0; await wait(reduce ? 0 : 420); group.remove(set.model, ...set.ghosts); }
    set = next; group.add(set.model, ...set.ghosts);
    // la page prend la couleur du studio de la photo : le modèle se fond dans le décor (comme le reel)
    pos = target = startIdx; vel = 0; lastIdx = -1;
    resize(); fadeTarget = 1;
  }

  // vignette produit : le modèle qui porte le coloris, sur fond studio (rendu hors écran)
  async function thumbnail(def, i, w = 600, h = 800, bg = "#e6e4e0") {
    const s = await prepare(def);
    const rt = new THREE.WebGLRenderTarget(w, h);
    const sc = new THREE.Scene(); sc.background = new THREE.Color(bg);
    const cam = new THREE.OrthographicCamera(-w / 2, w / 2, h / 2, -h / 2, -10, 10);
    const mat = s.model.material.clone();
    mat.uniforms = THREE.UniformsUtils.clone(s.model.material.uniforms);
    mat.uniforms.tPhoto.value = s.model.material.uniforms.tPhoto.value;
    mat.uniforms.tMask.value = s.model.material.uniforms.tMask.value;
    mat.uniforms.tPipe.value = s.model.material.uniforms.tPipe.value;
    mat.uniforms.uColA.value.copy(s.vecs[i]); mat.uniforms.uColB.value.copy(s.vecs[i]);
    mat.uniforms.uMix.value = 0; mat.uniforms.uFade.value = 1; mat.uniforms.uBottomFade.value = 0.16;
    const m = new THREE.Mesh(geo, mat);
    const gc = s.meta.garmentCenter, ph = h * 1.12, pw = ph * s.meta.aspect;
    m.scale.set(pw, ph, 1); m.position.set(-(gc[0] - 0.5) * pw, -h / 2 + ph / 2 - h * 0.02, 0);
    sc.add(m);
    renderer.setRenderTarget(rt); renderer.render(sc, cam); renderer.setRenderTarget(null);
    const px = new Uint8Array(w * h * 4); renderer.readRenderTargetPixels(rt, 0, 0, w, h, px);
    rt.dispose(); mat.dispose();
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    const ctx = c.getContext("2d"); const id = ctx.createImageData(w, h);
    for (let y = 0; y < h; y++) id.data.set(px.subarray((h - 1 - y) * w * 4, (h - y) * w * 4), y * w * 4);
    ctx.putImageData(id, 0, 0);
    return c.toDataURL("image/webp", 0.85);
  }

  resize(); loop();
  return {
    useSet, thumbnail, prepare,
    setTarget(v, show = false) {
      showMode = show; if (!set) return;
      if (!show) { spinTarget = 0; spinSpeed = 0; }
      const n = set.colors.length;
      target = v + n * Math.round((pos - v) / n);          // chemin le plus court autour de l'anneau
    },
    next(show = true) { showMode = show; target = Math.round(target) + 1; },
    spin(speed) { spinTarget = speed; if (speed > 0) showMode = true; },          // rotation continue (tours / s en coloris)
    get pos() { return pos; }, get spacing() { return spacing; },
    onChange(fn) { listeners.push(fn); },
  };
}

// ================= VIEWER 3D PRODUIT (page produit) =================
// Le vêtement seul, courbé comme un tissu, posé sur un plateau tournant : glisser pour le faire tourner.
export function createViewer(canvas) {
  THREE.ColorManagement.enabled = false;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, premultipliedAlpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 1, 5000);
  const geo = new THREE.PlaneGeometry(1, 1, 32, 1);
  const loader = new THREE.TextureLoader();
  const loadTex = (u) => new Promise((res, rej) => loader.load(u, (t) => { t.colorSpace = THREE.NoColorSpace; t.anisotropy = 4; res(t); }, undefined, rej));
  const cache = new Map();

  const stage = new THREE.Group(); scene.add(stage);
  // plateau : anneaux fins + ombre douce
  const ringMat = new THREE.LineBasicMaterial({ color: 0x111111, transparent: true, opacity: 0.18 });
  for (let r = 0; r < 3; r++) {
    const pts = []; const rad = 1 + r * 0.16;
    for (let i = 0; i <= 96; i++) { const a = (i / 96) * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(a) * rad, 0, Math.sin(a) * rad)); }
    const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), ringMat); l.userData.ring = true; stage.add(l);
  }
  const shadowTex = (() => {
    const c = document.createElement("canvas"); c.width = c.height = 128; const x = c.getContext("2d");
    const g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, "rgba(0,0,0,.35)"); g.addColorStop(1, "rgba(0,0,0,0)");
    x.fillStyle = g; x.fillRect(0, 0, 128, 128); const t = new THREE.CanvasTexture(c); return t;
  })();
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; stage.add(shadow);

  let mesh = null, cur = null, colTarget = new THREE.Vector4(), W = 1, H = 1;
  let rot = 0, vel = 0, drag = false, lastX = 0, time = 0;

  function size() {
    W = canvas.clientWidth; H = canvas.clientHeight; if (!W || !H) return;
    renderer.setSize(W, H, false);
    camera.aspect = W / H; camera.position.set(0, H * 0.06, H / 2 / Math.tan(THREE.MathUtils.degToRad(15)));
    camera.lookAt(0, 0, 0); camera.updateProjectionMatrix();
    if (!cur) return;
    const ph = H * 1.25, pw = ph * cur.meta.aspect;
    mesh.scale.set(pw, ph, pw);
    const gc = cur.meta.garmentCenter;
    mesh.position.set(-(gc[0] - 0.5) * pw, -(gc[1] - 0.5) * ph + H * 0.04, 0);
    const base = -H * 0.36;
    stage.children.forEach((c) => { if (c.userData.ring) { c.scale.setScalar(W * 0.2); c.position.y = base; } });
    shadow.scale.set(W * 0.42, W * 0.14, 1); shadow.position.y = base + 1;
  }
  new ResizeObserver(size).observe(canvas);

  async function show(def, i) {
    let s = cache.get(def.key);
    if (!s) {
      const [tGhost, tMask, meta, tPipe] = await Promise.all([loadTex(def.ghost), loadTex(def.mask), fetch(def.meta).then((r) => r.json()),
        def.pipe ? loadTex(def.pipe) : Promise.resolve(EMPTY_TEX)]);
      const mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: GHOST_FRAG, transparent: true, depthTest: false,
        side: THREE.DoubleSide, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
        uniforms: { tPhoto: { value: tGhost }, tGhost: { value: tGhost }, tMask: { value: tMask }, tPipe: { value: tPipe }, uMeanLum: { value: meta.meanLum },
          uDark: { value: meta.mode === "dark" ? 1 : 0 }, uFade: { value: 0 }, uBend: { value: 0.32 },
          uCol: { value: new THREE.Vector4() }, uOpacity: { value: 1 }, uBlur: { value: 0 }, uWash: { value: 0 } } });
      s = { meta, mesh: new THREE.Mesh(geo, mat) };
      s.mesh.renderOrder = 2;
      cache.set(def.key, s);
    }
    const c = new THREE.Color(def.colors[i].hex);
    colTarget.set(c.r, c.g, c.b, def.colors[i].original ? 1 : 0);
    if (cur !== s) {
      if (mesh) stage.remove(mesh);
      cur = s; mesh = s.mesh; stage.add(mesh);
      mesh.material.uniforms.uCol.value.copy(colTarget);
      mesh.material.uniforms.uFade.value = 0; vel += 0.12;
      size();
    }
  }

  canvas.addEventListener("pointerdown", (e) => { drag = true; lastX = e.clientX; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener("pointermove", (e) => { if (!drag) return; vel = (e.clientX - lastX) * 0.004; rot += vel; lastX = e.clientX; });
  canvas.addEventListener("pointerup", () => { drag = false; });

  const clock = new THREE.Clock(); let running = true, raf = 0;
  function loop() {
    const dt = Math.min(clock.getDelta(), 0.05); time += dt;
    if (!drag) { vel *= Math.pow(0.04, dt); rot += vel; rot += (Math.sin(time * 0.6) * 0.45 - rot) * dt * 0.8; }
    rot = Math.max(-1.1, Math.min(1.1, rot));
    if (mesh) {
      const u = mesh.material.uniforms;
      u.uFade.value += (1 - u.uFade.value) * (1 - Math.pow(0.002, dt));
      // fondu de couleur (le flag "original" bascule à mi-chemin)
      const cv = u.uCol.value; const k = 1 - Math.pow(0.003, dt);
      cv.x += (colTarget.x - cv.x) * k; cv.y += (colTarget.y - cv.y) * k; cv.z += (colTarget.z - cv.z) * k; cv.w = colTarget.w;
      mesh.rotation.y = rot;
      mesh.position.y += (Math.sin(time * 1.3) * 0.15);
      u.uBend.value = 0.32 + Math.abs(rot) * 0.1;
    }
    stage.rotation.y = rot * 0.4;
    renderer.render(scene, camera);
    if (running) raf = requestAnimationFrame(loop);
  }
  new IntersectionObserver(([e]) => {
    if (e.isIntersecting && !running) { running = true; clock.getDelta(); loop(); }
    if (!e.isIntersecting) { running = false; cancelAnimationFrame(raf); }
  }).observe(canvas);
  loop();
  return { show };
}
