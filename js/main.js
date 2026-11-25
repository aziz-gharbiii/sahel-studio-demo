import { createDresser, createViewer } from "./dresser.js";

/* ================= DONNÉES ================= */
const WHATSAPP = "21600000000"; // numéro du client (format international sans +)
const SIZES = ["XS", "S", "M", "L", "XL"];

// Chaque produit = une photo studio du modèle + un masque. Chaque coloris est recoloré en direct.
const PRODUCTS = [
  {
    id: "hoodie-boxy", gender: "homme", name: "Hoodie Boxy Heavyweight", price: 199, tag: "Drop 04", base: "model-mb", pipe: true,
    line: ["The Heavyweight", "Hoodie"], meta: "Coupe boxy · passepoil contrasté · molleton 500 g/m²",
    desc: "Molleton ultra épais 500 g/m² qui tient sa forme, coupe boxy courte et large, épaules très tombantes, passepoil blanc contrasté sur le buste et les manches, badge brodé SAHEL. Le hoodie qui se tient tout seul.",
    colors: [
      { name: "Vert Bouteille", hex: "#2e4a3b" },
      { name: "Noir Profond", hex: "#1f1f21" },
      { name: "Gris Chiné", hex: "#a5a5a3" },
      { name: "Crème", hex: "#ebe3d3" },
      { name: "Bleu Marine", hex: "#1f2c4f" },
      { name: "Bordeaux", hex: "#6b2230" },
      { name: "Mocha Mousse", hex: "#8a6650" },
    ],
  },
  {
    id: "hoodie-oversize", gender: "femme", name: "Hoodie Oversize", price: 179, tag: "Best-seller", base: "model-fp",
    line: ["The Oversize", "Hoodie"], meta: "Hoodie XXL · molleton 500 g · épaules tombantes",
    desc: "Coupe XXL qui se porte en robe ou avec un jean large : épaules très tombantes, manches longues, molleton 500 g ultra doux.",
    colors: [
      { name: "Moka", hex: "#a77a66" },
      { name: "Rose Bubblegum", hex: "#f29fc0" },
      { name: "Jaune Beurre", hex: "#f2dd8a" },
      { name: "Bleu Glacier", hex: "#a9c8ee" },
      { name: "Vert Pistache", hex: "#a9c98a" },
      { name: "Rouge Cerise", hex: "#b0202c" },
      { name: "Noir Profond", hex: "#1f1f21" },
    ],
  },
];
const byId = (id) => PRODUCTS.find((p) => p.id === id);
const setDef = (p) => ({
  key: p.id, colors: p.colors,
  photo: `assets/img/${p.base}.webp`, mask: `assets/img/${p.base}-mask.png`,
  ghost: `assets/img/${p.base}-ghost.webp`, meta: `assets/img/${p.base}-meta.json`,
  pipe: p.pipe ? `assets/img/${p.base}-pipe.png` : null,
});
const vKey = (id, i) => `${id}--${i}`;            // clé d'une variante (produit + coloris)
const thumbs = {};                                 // vKey -> image générée en WebGL
const BLANK = "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";
const imgOf = (key) => thumbs[key] || BLANK;

const LOOKS = [
  { img: "look-1", title: "Rouge 01", desc: "Cuir rouge vernis, pantalon large, sneakers montantes." },
  { img: "look-2", title: "Noir 02", desc: "Total look cuir noir, top court blanc, attitude." },
  { img: "look-3", title: "Night 03", desc: "Blouson cuir oversize, denim brut, bijoux argent." },
  { img: "look-4", title: "Crew 04", desc: "Denim sur denim, superposition et casquettes." },
];

const IMG = (id) => `assets/img/${id}.webp`;
const fmt = (n) => `${n} DT`;
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const reduce = false; // démo vitrine : animations toujours actives

/* ================= SMOOTH SCROLL ================= */
gsap.registerPlugin(ScrollTrigger);
// toujours repartir du haut (sinon le navigateur restaure la position et le hero n'est plus visible)
if ("scrollRestoration" in history) history.scrollRestoration = "manual";
scrollTo(0, 0);
const lenis = new Lenis({ lerp: 0.085, wheelMultiplier: 0.9, smoothWheel: !reduce });
lenis.on("scroll", ScrollTrigger.update);
gsap.ticker.add((t) => lenis.raf(t * 1000));
gsap.ticker.lagSmoothing(0);
lenis.stop();
$$('a[href^="#"]').forEach((a) => a.addEventListener("click", (e) => {
  const id = a.getAttribute("href");
  if (id === "#top") { e.preventDefault(); lenis.scrollTo(0, { duration: 1.6 }); return; }
  if (id.length > 1 && $(id)) { e.preventDefault(); lenis.scrollTo(id, { duration: 1.6 }); }
}));

/* ================= CURSEUR + MAGNÉTIQUE ================= */
const cursor = $("#cursor"), cursorLabel = $("#cursorLabel");
if (matchMedia("(hover:hover)").matches) {
  const xTo = gsap.quickTo(cursor, "x", { duration: 0.35, ease: "power3" });
  const yTo = gsap.quickTo(cursor, "y", { duration: 0.35, ease: "power3" });
  addEventListener("pointermove", (e) => { xTo(e.clientX); yTo(e.clientY); });
  document.addEventListener("pointerover", (e) => {
    const lab = e.target.closest("[data-cursor]");
    const hov = e.target.closest("a,button");
    cursor.classList.toggle("is-label", !!lab && !hov);
    cursor.classList.toggle("is-hover", !!hov);
    cursorLabel.textContent = lab && !hov ? lab.dataset.cursor : "";
  });
  $$("[data-magnetic]").forEach(bindMagnetic);
}
function bindMagnetic(el) {
  el.addEventListener("pointermove", (e) => {
    const r = el.getBoundingClientRect();
    gsap.to(el, { x: (e.clientX - r.left - r.width / 2) * 0.3, y: (e.clientY - r.top - r.height / 2) * 0.35, duration: 0.5, ease: "power3" });
  });
  el.addEventListener("pointerleave", () => gsap.to(el, { x: 0, y: 0, duration: 0.8, ease: "elastic.out(1,.4)" }));
}

/* ================= TOAST ================= */
let toastT;
function toast(msg) {
  const t = $("#toast"); t.textContent = msg; t.classList.add("is-show");
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("is-show"), 2200);
}

/* ================= PANIER ================= */
let cart = JSON.parse(localStorage.getItem("sahel-cart-v2") || "[]");
const FREE_SHIP = 200, SHIP = 8;
function saveCart() { localStorage.setItem("sahel-cart-v2", JSON.stringify(cart)); renderCart(); }
function addToCart(p, colorIdx, size) {
  const c = p.colors[colorIdx];
  const key = `${p.id}|${colorIdx}|${size}`;
  const found = cart.find((x) => x.key === key);
  if (found) found.qty++;
  else cart.push({ key, id: p.id, name: p.name, variant: c.name, hex: c.hex, colorIdx, size, price: p.price, img: vKey(p.id, colorIdx), qty: 1 });
  saveCart();
  gsap.fromTo("#cartOpen", { scale: 1 }, { scale: 1.15, yoyo: true, repeat: 1, duration: 0.18 });
  toast(`${p.name} ${c.name} · ${size} — ajouté au panier`);
}
function renderCart() {
  const list = $("#cartItems");
  const count = cart.reduce((s, c) => s + c.qty, 0);
  const sub = cart.reduce((s, c) => s + c.qty * c.price, 0);
  $("#cartCount").textContent = count;
  if (!cart.length) list.innerHTML = `<li class="cart__empty">Votre panier est vide.</li>`;
  else list.innerHTML = cart.map((c, i) => `
    <li class="ci">
      <img src="${imgOf(c.img)}" alt="">
      <div><h4>${c.name}</h4><p><i class="dot" style="background:${c.hex}"></i>${c.variant} · Taille ${c.size}</p>
        <div class="qty"><button data-q="${i}" data-d="-1" aria-label="Moins">−</button>${c.qty}<button data-q="${i}" data-d="1" aria-label="Plus">+</button></div></div>
      <div class="ci__price">${fmt(c.qty * c.price)}<button class="ci__rm" data-rm="${i}">Retirer</button></div>
    </li>`).join("");
  const left = Math.max(0, FREE_SHIP - sub);
  $("#cartShip").innerHTML = (left ? `Plus que <b>${fmt(left)}</b> pour la livraison offerte` : `<b>Livraison offerte ✦</b>`) +
    `<i><b style="width:${Math.min(100, (sub / FREE_SHIP) * 100)}%"></b></i>`;
  $("#cartTotal").textContent = fmt(sub);
  $("#toCheckout").disabled = !cart.length;
  if ($("#cartPanel").dataset.step === "checkout") renderSummary();
}
$("#cartItems").addEventListener("click", (e) => {
  const q = e.target.closest("[data-q]"), rm = e.target.closest("[data-rm]");
  if (q) { const c = cart[+q.dataset.q]; c.qty += +q.dataset.d; if (c.qty <= 0) cart.splice(+q.dataset.q, 1); saveCart(); }
  if (rm) { cart.splice(+rm.dataset.rm, 1); saveCart(); }
});

/* ---------- étapes panier -> livraison -> confirmation ---------- */
const STEP_TITLES = { cart: "Panier", checkout: "Livraison", done: "Commande confirmée" };
function setStep(step) {
  const p = $("#cartPanel");
  p.dataset.step = step;
  $("#cartTitle").textContent = STEP_TITLES[step];
  const n = { cart: 1, checkout: 2, done: 3 }[step];
  $$(".steps i").forEach((i, k) => i.classList.toggle("is-on", k < n));
  gsap.fromTo(p.querySelector(`[data-view="${step}"]`), { opacity: 0, x: 30 }, { opacity: 1, x: 0, duration: 0.6, ease: "expo.out" });
  if (step === "checkout") { renderSummary(); setTimeout(() => $("#coName").focus({ preventScroll: true }), 350); }
}
const openCart = () => { $("#cart").classList.add("is-open"); $("#cart").setAttribute("aria-hidden", "false"); lenis.stop(); };
const closeCart = () => {
  if (!$("#cart").classList.contains("is-open")) return;
  $("#cart").classList.remove("is-open"); $("#cart").setAttribute("aria-hidden", "true"); lenis.start();
  if ($("#cartPanel").dataset.step === "done") setTimeout(() => setStep("cart"), 700);
};
$("#cartOpen").addEventListener("click", openCart);
$$("[data-cart-close]").forEach((b) => b.addEventListener("click", closeCart));
$("#toCheckout").addEventListener("click", () => cart.length ? setStep("checkout") : toast("Ajoutez un article d'abord"));
$("#cartBack").addEventListener("click", () => setStep("cart"));

const GOVS = ["Tunis", "Ariana", "Ben Arous", "Manouba", "Nabeul", "Zaghouan", "Bizerte", "Béja", "Jendouba", "Le Kef", "Siliana",
  "Sousse", "Monastir", "Mahdia", "Sfax", "Kairouan", "Kasserine", "Sidi Bouzid", "Gabès", "Médenine", "Tataouine", "Gafsa", "Tozeur", "Kébili"];
const GRAND_TUNIS = ["Tunis", "Ariana", "Ben Arous", "Manouba"];
$("#coGov").insertAdjacentHTML("beforeend", GOVS.map((g) => `<option>${g}</option>`).join(""));
$("#coGov").addEventListener("change", (e) => {
  e.target.classList.add("has-value");
  e.target.closest(".field").classList.remove("is-error");
  const express = $('input[name="ship"][value="express"]');
  const ok = GRAND_TUNIS.includes(e.target.value);
  express.disabled = !ok; express.closest(".opt").style.opacity = ok ? 1 : 0.4;
  if (!ok && express.checked) $('input[name="ship"][value="standard"]').checked = true;
  renderSummary();
});
$("#checkoutForm").addEventListener("change", (e) => {
  if (e.target.name === "pay" && e.target.value === "card") { toast("Paiement par carte bientôt disponible"); $('input[name="pay"][value="cod"]').checked = true; }
  if (e.target.name === "ship") renderSummary();
});
// format téléphone : "22 123 456"
$("#coPhone").addEventListener("input", (e) => {
  const d = e.target.value.replace(/\D/g, "").slice(0, 8);
  e.target.value = d.replace(/^(\d{2})(\d{0,3})(\d{0,3}).*/, (_, a, b, c) => [a, b, c].filter(Boolean).join(" "));
});

function totals() {
  const sub = cart.reduce((s, c) => s + c.qty * c.price, 0);
  const express = $('input[name="ship"]:checked')?.value === "express";
  const ship = express ? 15 : sub >= FREE_SHIP ? 0 : SHIP;
  return { sub, ship, total: sub + ship, express };
}
function summaryHTML(t, items = cart) {
  return `<div class="sum-items">${items.map((c) => `<img src="${imgOf(c.img)}" alt="${c.name}">`).join("")}</div>
    ${items.map((c) => `<div><span>${c.qty} × ${c.name} <span class="muted">· ${c.variant} · ${c.size}</span></span><span>${fmt(c.qty * c.price)}</span></div>`).join("")}
    <div class="muted"><span>Sous-total</span><span>${fmt(t.sub)}</span></div>
    <div class="muted"><span>Livraison ${t.express ? "express" : "standard"}</span><span>${t.ship ? fmt(t.ship) : "Offerte"}</span></div>
    <div><b>Total</b><b>${fmt(t.total)}</b></div>`;
}
function renderSummary() {
  const t = totals();
  $("#shipStdPrice").textContent = t.sub >= FREE_SHIP ? "Offerte" : `${SHIP} DT`;
  $("#coSummary").innerHTML = summaryHTML(t);
  $("#coTotal").textContent = fmt(t.total);
}
function validate() {
  const rules = {
    coName: (v) => v.trim().split(/\s+/).length >= 2,
    coPhone: (v) => /^[2-9]\d{7}$/.test(v.replace(/\s/g, "")),
    coGov: (v) => !!v,
    coCity: (v) => v.trim().length >= 2,
    coAddr: (v) => v.trim().length >= 5,
  };
  let first = null;
  for (const [id, ok] of Object.entries(rules)) {
    const el = $("#" + id), good = ok(el.value);
    el.closest(".field").classList.toggle("is-error", !good);
    if (!good && !first) first = el;
  }
  if (first) { first.focus(); gsap.fromTo(first.closest(".field"), { x: -6 }, { x: 0, duration: 0.5, ease: "elastic.out(1,.3)" }); }
  return !first;
}
$$("#checkoutForm input, #checkoutForm select").forEach((el) => el.addEventListener("input", () => el.closest(".field")?.classList.remove("is-error")));

$("#checkoutForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!cart.length || !validate()) return;
  const btn = $("#placeOrder");
  btn.disabled = true; btn.textContent = "Envoi en cours…";
  const t = totals();
  const items = cart.map((c) => ({ ...c }));
  const fd = new FormData(e.target);
  const order = {
    id: "SH-" + Date.now().toString(36).toUpperCase().slice(-6),
    date: new Date().toISOString(),
    client: { name: fd.get("name").trim(), phone: "+216 " + fd.get("phone"), gov: fd.get("gov"), city: fd.get("city").trim(), address: fd.get("address").trim(), note: fd.get("note").trim() },
    livraison: t.express ? "express" : "standard", paiement: "à la livraison",
    items: items.map(({ id, name, variant, size, qty, price }) => ({ id, name, couleur: variant, taille: size, qty, price })),
    sousTotal: t.sub, fraisLivraison: t.ship, total: t.total,
  };
  // DÉMO : la commande est enregistrée dans le navigateur.
  // EN PROD : envoyer `order` vers le back-office du client (Google Sheets, Supabase, e-mail, Converty…).
  await new Promise((r) => setTimeout(r, 900));
  const orders = JSON.parse(localStorage.getItem("sahel-orders") || "[]");
  orders.push(order); localStorage.setItem("sahel-orders", JSON.stringify(orders));

  $("#doneName").textContent = order.client.name.split(" ")[0];
  $("#doneId").textContent = "#" + order.id;
  $("#donePhone").textContent = order.client.phone;
  $("#doneSummary").innerHTML = summaryHTML(t, items);
  const msg = `Bonjour SAHEL STUDIO, voici ma commande #${order.id} :\n` +
    order.items.map((i) => `• ${i.qty} × ${i.name} ${i.couleur} — taille ${i.taille}`).join("\n") +
    `\nTotal : ${fmt(t.total)}\n${order.client.name} · ${order.client.phone}\n${order.client.address}, ${order.client.city}, ${order.client.gov}`;
  $("#doneWa").href = `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(msg)}`;

  cart = []; saveCart(); e.target.reset(); $("#coGov").classList.remove("has-value");
  btn.disabled = false; btn.textContent = "Confirmer la commande";
  setStep("done");
});
renderCart();

/* ================= HERO : CABINE D'ESSAYAGE ================= */
let dresser = null, heroST = null, heroIdx = 0, heroSize = "M";
let cur = PRODUCTS[0];
const N = 7; // coloris par produit
$("#heroTotal").textContent = String(N).padStart(2, "0");
$("#heroDots").innerHTML = "<i></i>".repeat(N);
const sw = $("#swatches");
const renderSwatches = () => {
  sw.innerHTML = cur.colors.map((c, i) => `<li><button style="background:${c.hex}" data-sw="${i}" aria-label="${c.name}"></button></li>`).join("");
};
const renderChips = () => {
  $("#prodChips").innerHTML = PRODUCTS.filter((p) => p.gender === cur.gender)
    .map((p) => `<button data-prod="${p.id}" class="${p.id === cur.id ? "is-active" : ""}">${p.name}</button>`).join("");
};
$("#heroSizes").innerHTML = SIZES.map((s) => `<button data-hs="${s}" class="${s === heroSize ? "is-active" : ""}" aria-label="Taille ${s}">${s}</button>`).join("");
$("#heroSizes").addEventListener("click", (e) => {
  const b = e.target.closest("[data-hs]"); if (!b) return;
  heroSize = b.dataset.hs; $$("#heroSizes button").forEach((x) => x.classList.toggle("is-active", x === b));
});
renderSwatches(); renderChips();

function swapText(el, text, dir = 1) {
  if (el.textContent === text) return;
  gsap.timeline()
    .to(el, { yPercent: -110 * dir, duration: 0.3, ease: "power2.in" })
    .add(() => { el.textContent = text; })
    .fromTo(el, { yPercent: 110 * dir }, { yPercent: 0, duration: 0.6, ease: "expo.out" });
}
function setHeroUI(i, animate = true) {
  const dir = i >= heroIdx ? 1 : -1;
  heroIdx = i;
  const label = `${cur.name} · ${cur.colors[i].name}`;
  $("#heroIdx").textContent = String(i + 1).padStart(2, "0");
  $("#heroPrice").textContent = fmt(cur.price);
  $$("[data-sw]").forEach((b, k) => b.classList.toggle("is-active", k === i));
  $$("#heroDots i").forEach((d, k) => d.classList.toggle("is-on", k === i));
  document.documentElement.style.setProperty("--tint", cur.colors[i].hex); // le décor prend la couleur portée
  if (animate) swapText($("#colorName"), label, dir); else $("#colorName").textContent = label;
}
setHeroUI(0, false);

function movePill() {
  const a = $("#gender .is-active"), pill = $(".gender__pill");
  pill.style.width = a.offsetWidth + "px";
  const pad = parseFloat(getComputedStyle($("#gender")).paddingLeft) || 0;
  pill.style.width = a.offsetWidth + "px";
  pill.style.transform = `translateX(${a.offsetLeft - pad}px)`;
}
movePill(); addEventListener("resize", movePill); document.fonts.ready.then(movePill);

// change le produit porté par le modèle (et le modèle si besoin)
async function selectProduct(p, idx = 0) {
  if (!dresser) return;
  const changed = p.id !== cur.id;
  cur = p;
  $$("#gender button").forEach((b) => b.classList.toggle("is-active", b.dataset.set === p.gender));
  movePill(); renderChips();
  if (changed) {
    swapText($("#heroT1"), p.line[0]); swapText($("#heroT2"), p.line[1]);
    swapText($("#heroMeta"), p.meta);
    renderSwatches();
  }
  await dresser.useSet(setDef(p), idx);
  heroIdx = -1; setHeroUI(idx, changed);
}
$("#gender").addEventListener("click", (e) => {
  const b = e.target.closest("[data-set]");
  if (b && b.dataset.set !== cur.gender) { goTo(0, 0.6); selectProduct(PRODUCTS.find((p) => p.gender === b.dataset.set), 0); }
});
$("#prodChips").addEventListener("click", (e) => {
  const b = e.target.closest("[data-prod]");
  if (b && b.dataset.prod !== cur.id) { goTo(0, 0.6); selectProduct(byId(b.dataset.prod), 0); }
});

// position du scroll <-> coloris (le hero est épinglé pendant N-1 "pas")
function scrollForIndex(v) { return heroST ? heroST.start + (v / (N - 1)) * (heroST.end - heroST.start) : 0; }
function goTo(i, dur = 1.1) {
  i = Math.max(0, Math.min(N - 1, i));
  lenis.scrollTo(scrollForIndex(i), { duration: dur, easing: (t) => 1 - Math.pow(1 - t, 4), force: true });
}
// depuis la boutique : "Essayer sur le modèle"
async function tryOn(p, idx, size) {
  closeQV();
  if (size) { heroSize = size; $$("#heroSizes button").forEach((x) => x.classList.toggle("is-active", x.dataset.hs === size)); }
  await selectProduct(p, idx);
  lenis.scrollTo(scrollForIndex(idx), { duration: 1.8, force: true });
}
$("#next").addEventListener("click", () => goTo(heroIdx + 1));
$("#prev").addEventListener("click", () => goTo(heroIdx - 1));
sw.addEventListener("click", (e) => { const b = e.target.closest("[data-sw]"); if (b) goTo(+b.dataset.sw, 1.4); });
addEventListener("keydown", (e) => {
  if (!heroST || scrollY > heroST.end + 50 || document.querySelector(".is-open")) return;
  if (e.key === "ArrowRight") goTo(heroIdx + 1);
  if (e.key === "ArrowLeft") goTo(heroIdx - 1);
});
$("#heroAdd").addEventListener("click", () => addToCart(cur, heroIdx, heroSize));

async function initHero() {
  dresser = createDresser($("#dresser"));
  await dresser.useSet(setDef(cur), 0);
  dresser.onChange((i) => setHeroUI(i));

  heroST = ScrollTrigger.create({
    trigger: "#hero", start: "top top", end: () => "+=" + innerHeight * 0.6 * (N - 1),
    pin: true, anticipatePin: 1, refreshPriority: 1,
    onUpdate: (self) => dresser.setTarget(self.progress * (N - 1)),
    snap: { snapTo: 1 / (N - 1), duration: { min: 0.35, max: 0.9 }, delay: 0.08, ease: "power3.inOut" },
  });

  // glisser pour habiller (souris + tactile horizontal)
  const cv = $("#dresser");
  let sx = 0, sy = 0, startPos = 0, drag = false, locked = null;
  cv.addEventListener("pointerdown", (e) => { sx = e.clientX; sy = e.clientY; startPos = dresser.pos; drag = true; locked = null; });
  addEventListener("pointermove", (e) => {
    if (!drag) return;
    const dx = e.clientX - sx, dy = e.clientY - sy;
    if (locked === null && Math.hypot(dx, dy) > 8) locked = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
    if (locked !== "x") return;
    const v = startPos - dx / (dresser.spacing * 0.9);
    lenis.scrollTo(scrollForIndex(Math.max(0, Math.min(N - 1, v))), { immediate: true, force: true });
  });
  addEventListener("pointerup", () => { if (drag && locked === "x") goTo(Math.round(dresser.pos), 0.7); drag = false; });

  // ---- défilement automatique : le modèle change de couleur tout seul (aller-retour, sans saut) ----
  let lastTouch = -1e9, autoDir = 1, autoIdx = 0;                 // tourne dès l ouverture du site
  const touched = () => { lastTouch = performance.now(); live?.classList.remove("is-on"); if (dresser) dresser.spin(0); };
  // l'anneau ne s'arrête que si on choisit soi-même une couleur / un produit / qu'on le fait glisser
  ["#swatches", "#prodChips", "#gender", "#heroSizes", "#dresser", "#prev", "#next"].forEach((sel) =>
    $(sel)?.addEventListener("pointerdown", touched, { passive: true }));
  const live = $("#liveBadge");
  const tick = () => {
    const heroVisible = scrollY <= heroST.end + 2;              // tant que le hero est à l'écran (même épinglé)
    const idle = performance.now() - lastTouch > 2200;            // reprend vite après une action
    const ok = dresser && !document.hidden && !document.querySelector(".modal.is-open, .cart.is-open") && heroVisible && idle;
    live?.classList.toggle("is-on", !!ok);
    dresser.spin(ok ? 1.15 : 0);                                // l anneau tourne vite et en continu
  };
  tick();
  setInterval(tick, 800);

  // photos produits : le modèle qui porte chaque coloris (rendu WebGL, en tâche de fond)
  (async () => {
    for (const p of PRODUCTS) for (let i = 0; i < p.colors.length; i++) {
      const k = vKey(p.id, i);
      thumbs[k] = await dresser.thumbnail(setDef(p), i);
      if (i === 0) renderPicker();
      $$(`[data-thumb="${k}"]`).forEach((im) => { im.src = thumbs[k]; im.classList.add("is-ready"); });
      await new Promise((r) => setTimeout(r, 0));
    }
    renderCart();
  })();
}

/* ================= LOADER + INTRO ================= */
async function boot() {
  document.body.classList.add("is-loading");
  const counter = { v: 0 };
  const paint = () => { $("#loadCount").textContent = Math.round(counter.v); $("#loadBar").style.width = counter.v + "%"; };
  const countTw = gsap.to(counter, { v: 90, duration: 2.2, ease: "power2.out", onUpdate: paint });
  const heroP = initHero().catch((err) => { console.warn("WebGL indisponible", err); document.documentElement.classList.add("no-webgl"); });
  await Promise.race([Promise.all([heroP, document.fonts.ready]), new Promise((r) => setTimeout(r, 5000))]);
  countTw.kill();
  await gsap.to(counter, { v: 100, duration: 0.5, ease: "power2.out", onUpdate: paint });
  gsap.timeline()
    .to("#loader", { yPercent: -100, duration: 1.1, ease: "expo.inOut" })
    .from(".hero__title .line > span", { yPercent: 110, duration: 1.1, stagger: 0.08, ease: "expo.out" }, "-=0.45")
    .from("#dresser", { opacity: 0, scale: 1.04, duration: 1.4, ease: "expo.out" }, "<")
    .from(".hero__word span", { yPercent: 30, opacity: 0, duration: 1.6, ease: "expo.out" }, "<")
    .from(".hero__product, .hero__lead, .hero__side, .hero__dots, .arrow, .hero__hint, .header, .gender, .chips", { opacity: 0, y: 16, duration: 0.9, stagger: 0.05, ease: "power3.out" }, "-=1.2")
    .add(() => {
      $("#loader").remove(); document.body.classList.remove("is-loading");
      scrollTo(0, 0); lenis.scrollTo(0, { immediate: true, force: true });   // le show démarre toujours en haut
      lenis.start(); ScrollTrigger.refresh();
    });
}

/* ================= MANIFESTO + REVEALS ================= */
$$("[data-split]").forEach((el) => {
  el.innerHTML = el.textContent.trim().split(/\s+/).map((w) => `<span class="w">${w}</span>`).join(" ");
  gsap.to(el.querySelectorAll(".w"), { opacity: 1, stagger: 0.1, ease: "none",
    scrollTrigger: { trigger: el, start: "top 80%", end: "bottom 45%", scrub: true } });
});
$$("[data-reveal]").forEach((el) => gsap.from(el, { y: 60, opacity: 0, duration: 1.2, ease: "expo.out", scrollTrigger: { trigger: el, start: "top 88%" } }));

/* ================= SHOP : chaque produit est essayable ================= */
const grid = $("#grid");
const cardSel = {}; // id -> coloris choisi sur la carte
grid.innerHTML = PRODUCTS.map((p) => {
  cardSel[p.id] = 0;
  return `
  <article class="card card--3d" data-cat="${p.gender}" data-id="${p.id}" data-cursor="Essayer">
    <div class="card__media">
      ${p.tag ? `<span class="card__tag">${p.tag}</span>` : ""}
      <span class="card__try">${p.gender === "femme" ? "Femme" : "Homme"} · 3D</span>
      ${p.colors.map((c, i) => `<img src="${BLANK}" data-thumb="${vKey(p.id, i)}" data-ci="${i}" class="${i === 0 ? "is-on" : ""}" alt="${p.name} ${c.name}">`).join("")}
      <button class="card__quick" data-quick="${p.id}">Ajout rapide · M +</button>
    </div>
    <div class="card__row"><b>${p.name}</b><span>${fmt(p.price)}</span></div>
    <div class="card__sub"><span class="card__color">${p.colors[0].name}</span> · ${p.colors.length} coloris</div>
    <div class="card__dots">${p.colors.map((c, i) => `<button data-dot="${i}" class="${i === 0 ? "is-active" : ""}" style="background:${c.hex}" aria-label="${c.name}"></button>`).join("")}</div>
  </article>`;
}).join("");

function setCardColor(card, i) {
  const p = byId(card.dataset.id); cardSel[p.id] = i;
  card.querySelectorAll("[data-ci]").forEach((im) => im.classList.toggle("is-on", +im.dataset.ci === i));
  card.querySelectorAll("[data-dot]").forEach((d) => d.classList.toggle("is-active", +d.dataset.dot === i));
  card.querySelector(".card__color").textContent = p.colors[i].name;
}
ScrollTrigger.batch(".card", { start: "top 92%", once: true,
  onEnter: (els) => gsap.from(els, { y: 80, opacity: 0, rotateX: -12, transformOrigin: "50% 0%", duration: 1.2, stagger: 0.08, ease: "expo.out" }) });
if (matchMedia("(hover:hover)").matches) $$(".card").forEach((card) => {
  const m = card.querySelector(".card__media");
  card.addEventListener("pointermove", (e) => {
    const r = m.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
    m.style.transform = `rotateY(${x * 10}deg) rotateX(${-y * 10}deg)`;
  });
  card.addEventListener("pointerleave", () => { m.style.transform = ""; });
});
$("#filters").addEventListener("click", (e) => {
  const b = e.target.closest("[data-filter]"); if (!b) return;
  $$("#filters button").forEach((x) => x.classList.toggle("is-active", x === b));
  const f = b.dataset.filter, cards = $$(".card");
  gsap.to(cards, { opacity: 0, y: 20, duration: 0.25, stagger: 0.015, onComplete: () => {
    cards.forEach((c) => c.classList.toggle("is-hidden", f !== "all" && c.dataset.cat !== f));
    gsap.fromTo(cards.filter((c) => !c.classList.contains("is-hidden")), { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.7, stagger: 0.05, ease: "expo.out" });
    ScrollTrigger.refresh();
  } });
});

/* ================= FICHE PRODUIT (quick view) ================= */
let qv = null, qvColor = 0, qvSize = "M";
function renderQV() {
  const c = qv.colors[qvColor];
  $("#qvImg").src = imgOf(vKey(qv.id, qvColor)); $("#qvImg").alt = `${qv.name} ${c.name}`;
  $("#qvColorName").textContent = c.name;
  $$("#qvColors button").forEach((b) => b.classList.toggle("is-active", +b.dataset.c === qvColor));
  $$("#qvSizes button").forEach((b) => b.classList.toggle("is-active", b.dataset.size === qvSize));
}
function openQV(id, color = 0) {
  qv = byId(id); qvColor = color; qvSize = "M";
  $("#qvCat").textContent = `${qv.gender === "femme" ? "Femme" : "Homme"} · Essayage 3D`;
  $("#qvName").textContent = qv.name; $("#qvPrice").textContent = fmt(qv.price);
  $("#qvDesc").textContent = qv.desc;
  $("#qvColors").innerHTML = qv.colors.map((c, i) => `<button data-c="${i}" style="background:${c.hex}" aria-label="${c.name}"></button>`).join("");
  $("#qvSizes").innerHTML = SIZES.map((s) => `<button data-size="${s}">${s}</button>`).join("");
  renderQV();
  $("#modal").classList.add("is-open"); $("#modal").setAttribute("aria-hidden", "false"); lenis.stop();
}
function closeQV() {
  if (!$("#modal").classList.contains("is-open")) return;
  $("#modal").classList.remove("is-open"); $("#modal").setAttribute("aria-hidden", "true"); lenis.start();
}
grid.addEventListener("click", (e) => {
  const card = e.target.closest(".card"); if (!card) return;
  const dot = e.target.closest("[data-dot]");
  if (dot) { setCardColor(card, +dot.dataset.dot); return; }
  if (e.target.closest("[data-quick]")) { addToCart(byId(card.dataset.id), cardSel[card.dataset.id], "M"); return; }
  openQV(card.dataset.id, cardSel[card.dataset.id]);
});
$("#qvColors").addEventListener("click", (e) => { const b = e.target.closest("[data-c]"); if (b) { qvColor = +b.dataset.c; renderQV(); } });
$("#qvSizes").addEventListener("click", (e) => { const b = e.target.closest("[data-size]"); if (b) { qvSize = b.dataset.size; renderQV(); } });
$("#qvAdd").addEventListener("click", () => { addToCart(qv, qvColor, qvSize); closeQV(); });
$("#qvTry").addEventListener("click", () => tryOn(qv, qvColor, qvSize));
$$("[data-close]").forEach((b) => b.addEventListener("click", closeQV));
addEventListener("keydown", (e) => { if (e.key === "Escape") { closeQV(); closeCart(); } });

/* ================= LOOKBOOK : transition en tuiles ================= */
const COLS = 6, ROWS = 7;
const tiles = $("#tiles");
function buildLayer(img) {
  const layer = document.createElement("div");
  layer.style.cssText = "position:absolute;inset:0;display:grid;grid-template-columns:repeat(6,1fr);grid-template-rows:repeat(7,1fr)";
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const t = document.createElement("div"); t.className = "tile";
    const i = document.createElement("i");
    i.style.backgroundImage = `url(${IMG(img)})`;
    i.style.backgroundPosition = `${(c / (COLS - 1)) * 100}% ${(r / (ROWS - 1)) * 100}%`;
    t.appendChild(i); layer.appendChild(t);
  }
  return layer;
}
LOOKS.forEach((l) => { const im = new Image(); im.src = IMG(l.img); });
$("#lookThumbs").innerHTML = LOOKS.map((l, i) => `<button data-look="${i}" aria-label="${l.title}"><img src="${IMG(l.img)}" alt=""></button>`).join("");
$("#lookThumbs").addEventListener("click", (e) => {
  const b = e.target.closest("[data-look]"); if (!b || !lookST) return;
  const i = +b.dataset.look;
  lenis.scrollTo(lookST.start + ((i + 0.5) / LOOKS.length) * (lookST.end - lookST.start), { duration: 1.2 });
});
let lookST = null;
let lookIdx = -1, lookBusy = null;
function showLook(i) {
  if (i === lookIdx) return;
  const dir = i > lookIdx ? 1 : -1;
  lookIdx = i;
  $$("#lookThumbs button").forEach((b, k) => b.classList.toggle("is-active", k === i));
  gsap.to("#lookBar", { scaleX: (i + 1) / LOOKS.length, duration: 0.8, ease: "expo.out" });
  const layer = buildLayer(LOOKS[i].img);
  tiles.appendChild(layer);
  if (lookBusy) lookBusy.progress(1);
  lookBusy = gsap.timeline({ onComplete: () => { while (tiles.children.length > 1) tiles.firstChild.remove(); lookBusy = null; } });
  lookBusy.from(layer.querySelectorAll(".tile i"), { opacity: 0, scale: 1.35, duration: 0.7, ease: "expo.out",
    stagger: { grid: [ROWS, COLS], from: dir > 0 ? "end" : "start", amount: 0.55 } });
  const t = $("#lookTitle");
  gsap.timeline()
    .to(t, { yPercent: -100 * dir, duration: 0.35, ease: "power2.in" })
    .add(() => { t.textContent = LOOKS[i].title; $("#lookDesc").textContent = LOOKS[i].desc; $("#lookIdx").textContent = String(i + 1).padStart(2, "0"); })
    .fromTo(t, { yPercent: 100 * dir }, { yPercent: 0, duration: 0.7, ease: "expo.out" });
}
showLook(0);
lookST = ScrollTrigger.create({ trigger: "#lookbook", start: "top top", end: "bottom bottom",
  onUpdate: (s) => showLook(Math.min(LOOKS.length - 1, Math.floor(s.progress * LOOKS.length))) });
gsap.from("#tiles", { clipPath: "inset(18% 18% 18% 18%)", scale: 0.9, ease: "none",
  scrollTrigger: { trigger: "#lookbook", start: "top bottom", end: "top top", scrub: true } });

/* ================= FOOTER + NEWSLETTER ================= */
gsap.from(".footer__giant", { yPercent: 40, ease: "none", scrollTrigger: { trigger: ".footer", start: "top bottom", end: "bottom bottom", scrub: true } });
$("#newsletter").addEventListener("submit", (e) => { e.preventDefault(); e.target.hidden = true; $("#nlOk").hidden = false; });

/* ================= STORY : le scroll joue le "film" du produit (style scroll-cinematic) ================= */
(() => {
  const P = PRODUCTS[0];                       // Hoodie Boxy (homme, passepoil)
  const NC = P.colors.length;
  // repères du film (progression 0 -> 1 de la section épinglée)
  const CH = [0, 0.22, 0.47, 0.8];             // début de chaque chapitre
  const COL0 = 0.47, COL1 = 0.79;              // fenêtre où les teintes défilent
  let story = null, chap = -1, colIdx = 0;
  const chaps = $$(".chap"), cards = $$(".story .fcard"), rail = $$(".story__rail i");

  function setChap(c) {
    if (c === chap) return;
    chap = c;
    $("#stIdx").textContent = String(c + 1).padStart(2, "0");
    chaps.forEach((el, k) => el.classList.toggle("is-on", k === c));
    cards.forEach((el) => el.classList.toggle("is-on", +el.dataset.fc === c));
    rail.forEach((el, k) => el.classList.toggle("is-on", k <= c));
  }
  function setColor(i) {
    i = ((i % NC) + NC) % NC; colIdx = i;
    const c = P.colors[i];
    $("#stColor").textContent = c.name; $("#stColorIdx").textContent = i + 1;
    $("#stDot").style.background = c.hex;
    $("#storyAdd").textContent = `Ajouter au panier · ${fmt(P.price)}`;
    document.querySelector(".story").style.setProperty("--st-tint", c.hex);
    const k = vKey(P.id, i); if (thumbs[k]) $("#stThumb").src = thumbs[k];
  }
  setChap(0); setColor(0);

  // la scène WebGL ne se crée qu'à l'approche de la section (le hero charge d'abord)
  new IntersectionObserver(async ([e], obs) => {
    if (!e.isIntersecting) return; obs.disconnect();
    try {
      story = createDresser($("#storyCanvas"), { dpr: 1.6 });
      await story.useSet(setDef(P), 0);
      story.onChange((i) => setColor(i));
      st.update && update(st.progress);
    } catch (err) { console.warn("story WebGL indisponible", err); }
  }, { rootMargin: "120% 0px" }).observe($("#drop"));

  const clamp01 = (x) => Math.max(0, Math.min(1, x));
  function update(p) {
    setChap(p < CH[1] ? 0 : p < CH[2] ? 1 : p < CH[3] ? 2 : 3);
    $("#stBar").style.transform = `scaleY(${p})`;
    if (story) story.setTarget(clamp01((p - COL0) / (COL1 - COL0)) * NC);   // NC = retour au vert (anneau)
  }

  // caméra : gros plan tissu -> recul plein pied -> push-in sur le badge
  const tl = gsap.timeline({ defaults: { ease: "none" } })
    .fromTo("#storyCam", { scale: 2.25, yPercent: 8 }, { scale: 1, yPercent: 0, duration: 0.3, ease: "power2.inOut" }, 0)
    .to("#storyCam", { scale: 1.06, duration: 0.5 }, 0.3)
    .to("#storyCam", { scale: 1.85, yPercent: 10, duration: 0.2, ease: "power2.inOut" }, 0.8)
    .fromTo(".story__word", { xPercent: 12 }, { xPercent: -28, duration: 1 }, 0)
    .fromTo(".fcard--a", { y: 40 }, { y: -60, duration: 0.25 }, 0)
    .fromTo(".fcard--b", { y: 80 }, { y: -30, duration: 0.25 }, 0)
    .fromTo(".fcard--c", { y: 60 }, { y: -40, duration: 0.25 }, CH[1])
    .fromTo(".fcard--d", { y: 50 }, { y: -50, duration: 0.33 }, CH[2])
    .fromTo(".fcard--e", { y: 50 }, { y: -20, duration: 0.2 }, CH[3])
    .fromTo(".fcard--f", { y: 90 }, { y: 0, duration: 0.2 }, CH[3])
    .fromTo(".story__hint", { opacity: 1 }, { opacity: 0, duration: 0.06 }, 0.02);
  const st = ScrollTrigger.create({
    trigger: "#drop", start: "top top", end: "bottom bottom", scrub: 0.6, animation: tl,
    onUpdate: (s) => update(s.progress),
  });

  $("#storyAdd").addEventListener("click", () => addToCart(P, colIdx, "M"));
})();

/* ================= PAGE PRODUIT + VIEWER 3D ================= */
let pdp = PRODUCTS[0], pdpColor = 0, pdpSize = "M", pdpQty = 1, viewer = null;
try { viewer = createViewer($("#viewer")); } catch (e) { console.warn("viewer 3D indisponible", e); }
function renderPicker() {
  $("#pdpPicker").innerHTML = PRODUCTS.map((p) => `<button data-pp="${p.id}" class="${p.id === pdp.id ? "is-active" : ""}" aria-label="${p.name}"><img src="${imgOf(vKey(p.id, 0))}" alt=""></button>`).join("");
}
function renderPDP(animate) {
  const c = pdp.colors[pdpColor];
  $("#pdpCat").textContent = `${pdp.gender === "femme" ? "Femme" : "Homme"} · Essayage 3D`;
  $("#pdpName").textContent = pdp.name; $("#pdpPrice").textContent = fmt(pdp.price * pdpQty);
  $("#pdpColorName").textContent = c.name; $("#pdpQty").textContent = pdpQty;
  $("#pdpColors").innerHTML = pdp.colors.map((cc, i) => `<button data-pc="${i}" class="${i === pdpColor ? "is-active" : ""}" style="background:${cc.hex}" aria-label="${cc.name}"></button>`).join("");
  $("#pdpSizes").innerHTML = SIZES.map((s) => `<button data-ps="${s}" class="${s === pdpSize ? "is-active" : ""}">${s}</button>`).join("");
  $$("#pdpPicker button").forEach((b) => b.classList.toggle("is-active", b.dataset.pp === pdp.id));
  if (viewer) viewer.show(setDef(pdp), pdpColor);
  $("#product").style.setProperty("--pdp-tint", c.hex);
  if (animate) gsap.from(".pdp__right > *", { y: 14, opacity: 0, duration: 0.6, stagger: 0.03, ease: "expo.out" });
}
renderPicker(); renderPDP();
$("#pdpPicker").addEventListener("click", (e) => { const b = e.target.closest("[data-pp]"); if (b) { pdp = byId(b.dataset.pp); pdpColor = 0; renderPDP(true); } });
$("#pdpColors").addEventListener("click", (e) => { const b = e.target.closest("[data-pc]"); if (b) { pdpColor = +b.dataset.pc; renderPDP(); } });
$("#pdpSizes").addEventListener("click", (e) => { const b = e.target.closest("[data-ps]"); if (b) { pdpSize = b.dataset.ps; renderPDP(); } });
$("#pdpMinus").addEventListener("click", () => { pdpQty = Math.max(1, pdpQty - 1); renderPDP(); });
$("#pdpPlus").addEventListener("click", () => { pdpQty = Math.min(9, pdpQty + 1); renderPDP(); });
$("#pdpAdd").addEventListener("click", () => { for (let q = 0; q < pdpQty; q++) addToCart(pdp, pdpColor, pdpSize); });
$("#pdpTry").addEventListener("click", () => tryOn(pdp, pdpColor, pdpSize));
const guide = $("#guide");
const openGuide = (e) => { e?.preventDefault(); guide.classList.add("is-open"); guide.setAttribute("aria-hidden", "false"); lenis.stop(); };
$("#sizeGuide").addEventListener("click", openGuide);
$$("[data-open-guide]").forEach((a) => a.addEventListener("click", openGuide));
$$("[data-guide-close]").forEach((b) => b.addEventListener("click", () => { guide.classList.remove("is-open"); guide.setAttribute("aria-hidden", "true"); lenis.start(); }));
gsap.from(".pdp__title, .pdp__text, .pdp__specs", { y: 50, opacity: 0, duration: 1.2, stagger: 0.1, ease: "expo.out", scrollTrigger: { trigger: ".pdp", start: "top 70%" } });

/* ================= FEED INSTAGRAM ================= */
const INSTA = ["look-1", "puffer-noir", "hoodie-studio", "look-2", "cuir-cognac", "varsity-mood", "look-4", "puffer-moon", "hoodie-graphic", "bomber-rev"];
$("#instaRow").innerHTML = INSTA.map((n, i) => `<a class="insta__item" href="#" data-cursor="Voir"><img src="${IMG(n)}" alt="Post Instagram SAHEL" loading="lazy"><span>♥ ${(1.2 + i * 0.37).toFixed(1)}k</span></a>`).join("");
gsap.from(".insta__item", { x: 120, opacity: 0, duration: 1.2, stagger: 0.06, ease: "expo.out", scrollTrigger: { trigger: ".insta", start: "top 80%" } });
(() => { // glisser horizontalement le feed
  const row = $("#instaRow"); let down = false, sx = 0, sl = 0, moved = false;
  row.addEventListener("pointerdown", (e) => { down = true; moved = false; sx = e.clientX; sl = row.scrollLeft; });
  addEventListener("pointermove", (e) => { if (!down) return; const dx = e.clientX - sx; if (Math.abs(dx) > 4) moved = true; row.scrollLeft = sl - dx; });
  addEventListener("pointerup", () => { down = false; });
  row.addEventListener("click", (e) => { e.preventDefault(); if (moved) e.stopPropagation(); }, true);
})();

boot();

/* ================= RACCORD HERO -> STORY : la caméra plonge vers la poitrine du modèle ================= */
gsap.fromTo("#hero", { "--hx": 0 }, { "--hx": 1, ease: "power1.in",
  scrollTrigger: { trigger: ".marquee", start: "top bottom", end: "top top", scrub: true } });
