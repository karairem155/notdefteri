// Defter kapağı (02-DefterGorunumu.png): desenli ön yüz, sağda cilt şeridi, altta sayfa kenarları.
import { h } from "./ui.js";
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

/** Kapak öğesi. `cover` = { pattern, color, imageAsset? }. Oran 100:135. */
export function coverElement(cover, { className = "" } = {}) {
  const c = cover || store.settings.defaultCover || COVER_PRESETS[5];
  // Gerçek 3B kitap: arka kapak (z=0), sırt (sol yüz), sayfa bloğu (sağ, üst, alt yüzler), ön kapak (z=kalınlık).
  const wrap = h("div", { class: "cover " + className, style: { "--cover": c.color } });
  const front = h("div", { class: "cover-front", style: { background: c.color } });
  if (c.imageAsset) {
    const image = h("img", { alt: "", draggable: "false" });
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

/** Görseli `object-fit: cover` gibi yerleştirir. */
function drawFitted(ctx, img, w, h) {
  const k = Math.max(w / img.width, h / img.height);
  const dw = img.width * k;
  const dh = img.height * k;
  ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
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
      if (img) drawFitted(ctx, img, canvas.width, canvas.height);
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

export function sameCover(a, b) {
  if (!a || !b) return false;
  return a.pattern === b.pattern && a.color === b.color && (a.imageAsset || null) === (b.imageAsset || null);
}
