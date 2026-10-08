// Defter kapağı (02-DefterGorunumu.png): desenli ön yüz, sağda cilt şeridi, altta sayfa kenarları.
import { h, openModal, closeModal } from "./ui.js";
import { store, COVER_PRESETS } from "./store.js";

const SVG_NS = "http://www.w3.org/2000/svg";

function svgEl(tag, attrs = {}) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

/** Deseni 100×135 birimlik viewBox'a çizer. */
function patternGroup(pattern) {
  const g = svgEl("g", { fill: "rgba(0,0,0,0.26)", stroke: "rgba(0,0,0,0.26)", "stroke-width": "0.8" });
  const W = 100, H = 135;
  if (pattern === "lines") {
    for (let y = 16; y < H; y += 12) g.append(svgEl("line", { x1: 6, y1: y, x2: W - 6, y2: y }));
  } else if (pattern === "grid") {
    for (let x = 10; x < W; x += 11) g.append(svgEl("line", { x1: x, y1: 0, x2: x, y2: H, "stroke-width": "0.6" }));
    for (let y = 10; y < H; y += 11) g.append(svgEl("line", { x1: 0, y1: y, x2: W, y2: y, "stroke-width": "0.6" }));
  } else if (pattern === "gingham") {
    g.setAttribute("stroke", "none");
    for (let x = 0; x < W; x += 20) g.append(svgEl("rect", { x, y: 0, width: 10, height: H, fill: "rgba(0,0,0,0.14)" }));
    for (let y = 0; y < H; y += 20) g.append(svgEl("rect", { x: 0, y, width: W, height: 10, fill: "rgba(0,0,0,0.14)" }));
  } else if (pattern === "dots") {
    g.setAttribute("stroke", "none");
    g.setAttribute("fill", "rgba(255,255,255,0.85)");
    let row = 0;
    for (let y = 12; y < H; y += 16, row++) {
      for (let x = (row % 2 ? 16 : 8); x < W; x += 16) g.append(svgEl("circle", { cx: x, cy: y, r: 2.4 }));
    }
  } else if (pattern === "hearts") {
    g.setAttribute("stroke", "none");
    const spots = [[20, 16], [62, 13], [40, 27], [82, 27], [20, 97], [86, 105], [30, 113], [65, 116]];
    for (const [x, y] of spots) {
      g.append(svgEl("path", { d: `M${x} ${y + 5} C ${x - 9} ${y - 1}, ${x - 5} ${y - 8}, ${x} ${y - 2.5} C ${x + 5} ${y - 8}, ${x + 9} ${y - 1}, ${x} ${y + 5} Z` }));
    }
  } else if (pattern === "stars") {
    g.setAttribute("stroke", "none");
    const spots = [[22, 19], [70, 14], [45, 32], [86, 32], [24, 105], [80, 100], [52, 119]];
    for (const [cx, cy] of spots) {
      const pts = [];
      for (let i = 0; i < 10; i++) {
        const a = (i * 36 - 90) * Math.PI / 180;
        const r = i % 2 === 0 ? 7 : 3.2;
        pts.push(`${(cx + Math.cos(a) * r).toFixed(1)},${(cy + Math.sin(a) * r).toFixed(1)}`);
      }
      g.append(svgEl("polygon", { points: pts.join(" ") }));
    }
  }
  return g;
}

// ── Görselin kapaktaki yeri ─────────────────────────────────────────────────
//
// Kendi görselini kapak yapınca görsel kapağı tamamen kaplıyor (cover); hangi
// kısmının görüneceği eskiden hep ortaydı, bazen önemli yer kesiliyordu.
// `imageFit` = { x, y, z }: x/y 0..1 arası konum (0 sol/üst, 1 sağ/alt), z
// yakınlaştırma (1 = tam kaplama). Modeli CSS'teki object-position ile aynı:
// taşan kısmın x kadarı soldan, y kadarı yukarıdan kesiliyor. Yakınlaştırma
// aynı noktanın etrafında yapılıyor, o yüzden kaydırmak her eksende çalışıyor.

export const FIT_VARSAYILAN = { x: 0.5, y: 0.5, z: 1 };

export function fitDuzelt(fit) {
  const f = fit || FIT_VARSAYILAN;
  const k = (v, a, b, d) => (Number.isFinite(v) ? Math.min(b, Math.max(a, v)) : d);
  return { x: k(f.x, 0, 1, 0.5), y: k(f.y, 0, 1, 0.5), z: k(f.z, 1, 4, 1) };
}

/** Görsel öğesine konumu uygular (object-fit: cover üstüne). */
export function fitUygula(img, fit) {
  const f = fitDuzelt(fit);
  const px = (f.x * 100).toFixed(2) + "%";
  const py = (f.y * 100).toFixed(2) + "%";
  img.style.objectPosition = `${px} ${py}`;
  img.style.transformOrigin = `${px} ${py}`;
  img.style.transform = f.z > 1.001 ? `scale(${f.z.toFixed(3)})` : "";
}

/**
 * Görselin w×h kutudaki yerleşimi (tuvale çizerken ve sürüklemeyi çevirirken).
 * Dönen: sol üst köşe ve çizim boyutu, ayrıca iki eksendeki toplam taşma.
 */
export function fitYerlesim(iw, ih, w, h, fit) {
  const f = fitDuzelt(fit);
  const s = Math.max(w / iw, h / ih) * f.z;
  const dw = iw * s;
  const dh = ih * s;
  const tx = dw - w;
  const ty = dh - h;
  return { x: -tx * f.x, y: -ty * f.y, w: dw, h: dh, tx, ty };
}

/** Kapak öğesi. `cover` = { pattern, color, imageAsset?, imageFit? }. Oran 100:135. */
export function coverElement(cover, { className = "" } = {}) {
  const c = cover || store.settings.defaultCover || COVER_PRESETS[5];
  // Gerçek 3B kitap: arka kapak (z=0), sırt (sol yüz), sayfa bloğu (sağ, üst, alt yüzler), ön kapak (z=kalınlık).
  const wrap = h("div", { class: "cover " + className, style: { "--cover": c.color } });
  const front = h("div", { class: "cover-front", style: { background: c.color } });
  if (c.imageAsset) {
    const image = h("img", { alt: "", draggable: "false" });
    fitUygula(image, c.imageFit);
    store.assetURL(c.imageAsset).then((url) => { if (url) image.src = url; });
    front.append(image);
  } else if (c.pattern && c.pattern !== "plain") {
    const svg = svgEl("svg", { viewBox: "0 0 100 135", preserveAspectRatio: "none", "aria-hidden": "true" });
    svg.append(patternGroup(c.pattern));
    front.append(svg);
  }
  front.append(h("div", { class: "cover-sheen" }));
  wrap.append(
    h("div", { class: "cover-back" }),
    h("div", { class: "book-spine" }),
    h("div", { class: "book-pages" }),
    h("div", { class: "book-top" }),
    h("div", { class: "book-bottom" }),
    front);
  return wrap;
}

/** Görseli kapaktaki konumuyla yerleştirir (ekrandaki kapakla aynı). */
function drawFitted(ctx, img, w, h, fit) {
  const y = fitYerlesim(img.width, img.height, w, h, fit);
  ctx.drawImage(img, y.x, y.y, y.w, y.h);
}

/** Deseni doğrudan tuvale çizer — SVG'nin tuval karşılığı. */
function patternOnCanvas(ctx, pattern, w, h) {
  const sx = w / 100;
  const sy = h / 135;
  ctx.save();
  ctx.scale(sx, sy);
  ctx.strokeStyle = "rgba(0,0,0,0.26)";
  ctx.fillStyle = "rgba(0,0,0,0.26)";
  ctx.lineWidth = 0.8;
  const W = 100, H = 135;
  const line = (x1, y1, x2, y2) => { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); };
  if (pattern === "lines") {
    for (let y = 16; y < H; y += 12) line(6, y, W - 6, y);
  } else if (pattern === "grid") {
    ctx.lineWidth = 0.6;
    for (let x = 10; x < W; x += 11) line(x, 0, x, H);
    for (let y = 10; y < H; y += 11) line(0, y, W, y);
  } else if (pattern === "gingham") {
    ctx.fillStyle = "rgba(0,0,0,0.14)";
    for (let x = 0; x < W; x += 20) ctx.fillRect(x, 0, 10, H);
    for (let y = 0; y < H; y += 20) ctx.fillRect(0, y, W, 10);
  } else if (pattern === "dots") {
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    let row = 0;
    for (let y = 12; y < H; y += 16, row++) {
      for (let x = (row % 2 ? 16 : 8); x < W; x += 16) {
        ctx.beginPath();
        ctx.arc(x, y, 2.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else if (pattern === "hearts") {
    for (const [x, y] of [[20, 16], [62, 13], [40, 27], [82, 27], [20, 97], [86, 105], [30, 113], [65, 116]]) {
      ctx.beginPath();
      ctx.moveTo(x, y + 5);
      ctx.bezierCurveTo(x - 9, y - 1, x - 5, y - 8, x, y - 2.5);
      ctx.bezierCurveTo(x + 5, y - 8, x + 9, y - 1, x, y + 5);
      ctx.fill();
    }
  } else if (pattern === "stars") {
    for (const [cx, cy] of [[22, 19], [70, 14], [45, 32], [86, 32], [24, 105], [80, 100], [52, 119]]) {
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = (i * 36 - 90) * Math.PI / 180;
        const r = i % 2 === 0 ? 7 : 3.2;
        const px = cx + Math.cos(a) * r;
        const py = cy + Math.sin(a) * r;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
    }
  }
  ctx.restore();
}

/**
 * Kapağın tuval görüntüsü — açılış animasyonu için.
 *
 * Kapak ekranda DOM; animasyonda ise tuvale çiziliyor (iOS 3B'yi düzleştirdiği
 * için kapak dönüşü de sayfa kıvrımı gibi tuvalde yapılıyor). Desen SVG yerine
 * doğrudan tuval çizimiyle üretiliyor: aynı görüntü, ara adım yok.
 */
export async function coverBitmap(cover, w, h) {
  const c = cover || store.settings.defaultCover || COVER_PRESETS[5];
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(w));
  canvas.height = Math.max(1, Math.round(h));
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = c.color || "#F4A7C0";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (c.imageAsset) {
    const url = await store.assetURL(c.imageAsset);
    if (url) {
      const img = await new Promise((res) => {
        const im = new Image();
        im.onload = () => res(im);
        im.onerror = () => res(null);
        im.src = url;
      });
      if (img) drawFitted(ctx, img, canvas.width, canvas.height, c.imageFit);
    }
  } else if (c.pattern && c.pattern !== "plain") {
    patternOnCanvas(ctx, c.pattern, canvas.width, canvas.height);
  }
  // Parlama: ekrandaki .cover-sheen ile aynı yön ve kuvvet.
  const g = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  g.addColorStop(0, "rgba(255,255,255,0.32)");
  g.addColorStop(0.35, "rgba(255,255,255,0.06)");
  g.addColorStop(0.55, "rgba(255,255,255,0)");
  g.addColorStop(1, "rgba(0,0,0,0.10)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  return canvas;
}

// Kütüphaneden bir deftere girilince editör onu kapalı gösterip kapağını
// açıyor. İşaret oturumda taşınıyor: adres değişikliğinden sağ çıkıyor ama
// kalıcı değil, yenilenince defter doğrudan açık geliyor.
const ACILIS_ANAHTARI = "notdefteri.kapakAcilisi";

export function markCoverOpening(notebookId) {
  try { sessionStorage.setItem(ACILIS_ANAHTARI, notebookId); } catch (_) { /* özel kip */ }
}

/** İşaret bu defterinse alıp siler (bir kez açılsın). */
export function takeCoverOpening(notebookId) {
  try {
    if (sessionStorage.getItem(ACILIS_ANAHTARI) !== notebookId) return false;
    sessionStorage.removeItem(ACILIS_ANAHTARI);
    return true;
  } catch (_) { return false; }
}

/**
 * Görseli kapakta konumlama penceresi.
 *
 * Önizlemede parmakla sürükleyerek kaydırıyorsun, iki parmakla ya da sürgüyle
 * yakınlaştırıyorsun. `oran` çerçevenin en/boy oranı (kapak 100/135, klasör
 * 4/3). Kaydedince `onSave(fit)` çağrılıyor.
 */
export function openImageFit({ url, oran = 100 / 135, fit, baslik = "Kapağı Konumla", onSave }) {
  let f = fitDuzelt(fit);
  const img = h("img", { alt: "", draggable: "false", src: url, class: "konum-gorsel" });
  const cerceve = h("div", { class: "konum-cerceve", style: { aspectRatio: String(oran) } }, img, h("div", { class: "konum-izgara" }));
  const surgu = h("input", { type: "range", min: "1", max: "4", step: "0.01", value: String(f.z), class: "konum-surgu", "aria-label": "Yakınlaştırma" });
  const tazele = () => { fitUygula(img, f); surgu.value = String(f.z); };
  tazele();

  // Sürüklemeyi konuma çevir: taşan kısım kadar kayabiliyor.
  const isaretler = new Map();
  let bas = null;
  const tasma = () => {
    const kutu = cerceve.getBoundingClientRect();
    if (!img.naturalWidth || !kutu.width) return null;
    return fitYerlesim(img.naturalWidth, img.naturalHeight, kutu.width, kutu.height, f);
  };
  cerceve.addEventListener("pointerdown", (e) => {
    isaretler.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try { cerceve.setPointerCapture(e.pointerId); } catch (_) { /* yine çalışır */ }
    if (isaretler.size === 2) {
      const [a, b] = [...isaretler.values()];
      bas = { mesafe: Math.hypot(a.x - b.x, a.y - b.y), z: f.z };
    }
    e.preventDefault();
  });
  cerceve.addEventListener("pointermove", (e) => {
    const onceki = isaretler.get(e.pointerId);
    if (!onceki) return;
    isaretler.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (isaretler.size >= 2 && bas) {
      const [a, b] = [...isaretler.values()];
      f = fitDuzelt({ ...f, z: bas.z * Math.hypot(a.x - b.x, a.y - b.y) / Math.max(1, bas.mesafe) });
    } else {
      const t = tasma();
      if (!t) return;
      const dx = e.clientX - onceki.x;
      const dy = e.clientY - onceki.y;
      f = fitDuzelt({
        ...f,
        x: t.tx > 0.5 ? f.x - dx / t.tx : f.x,
        y: t.ty > 0.5 ? f.y - dy / t.ty : f.y
      });
    }
    tazele();
    e.preventDefault();
  });
  const birak = (e) => { isaretler.delete(e.pointerId); if (isaretler.size < 2) bas = null; };
  cerceve.addEventListener("pointerup", birak);
  cerceve.addEventListener("pointercancel", birak);
  surgu.addEventListener("input", () => { f = fitDuzelt({ ...f, z: parseFloat(surgu.value) }); tazele(); });

  openModal(h("div", { class: "dialog konum-dialog", style: { width: "min(460px, 100%)" } },
    h("h3", {}, baslik),
    h("p", {}, "Sürükleyerek kaydır, iki parmakla ya da sürgüyle yakınlaştır."),
    cerceve,
    h("div", { class: "konum-surgu-satir" }, h("span", {}, "−"), surgu, h("span", {}, "+")),
    h("div", { class: "dialog-actions" },
      h("button", { class: "btn", type: "button", onTap: () => { f = { ...FIT_VARSAYILAN }; tazele(); } }, "Ortala"),
      h("button", { class: "btn primary", type: "button", onTap: () => { closeModal(); onSave(f); } }, "Tamam"))));
}

/** Kapağın görselini konumla ve kaydet (`hedef` = "cover" ya da "backCover"). */
export async function openCoverFit(notebookId, hedef = "cover", sonra = null) {
  const nb = store.notebook(notebookId);
  const kapak = nb && nb[hedef];
  if (!kapak || !kapak.imageAsset) return false;
  const url = await store.assetURL(kapak.imageAsset);
  if (!url) return false;
  openImageFit({
    url,
    fit: kapak.imageFit,
    baslik: hedef === "backCover" ? "Arka Kapağı Konumla" : "Kapağı Konumla",
    onSave: (fit) => {
      store.mutate(notebookId, (n) => { if (n[hedef]) n[hedef] = { ...n[hedef], imageFit: fit }; });
      if (sonra) sonra();
    }
  });
  return true;
}

export function sameCover(a, b) {
  if (!a || !b) return false;
  return a.pattern === b.pattern && a.color === b.color && (a.imageAsset || null) === (b.imageAsset || null);
}
