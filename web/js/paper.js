// Sayfa arka planı: uygulamayla gelen desen, kullanıcının şablon görseli ya da PDF sayfası.
import { store } from "./store.js";

export const PAPER_COLOR = "#f2f0e6";
const INK = "rgba(120,124,135,0.55)";

/** Deseni verilen tuvale çizer (CSS piksel boyutu w×h, dpr ölçekli). */
export function drawPaper(canvas, paper, w, h) {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  canvas.style.width = w + "px";
  canvas.style.height = h + "px";
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  paintPaper(ctx, paper, w, h);
}

/** Deseni hazır bir bağlama çizer (anlık görüntü ve önizlemeler için). */
export function paintPaper(ctx, paper, w, h) {
  ctx.fillStyle = PAPER_COLOR;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = INK;
  ctx.fillStyle = INK;
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  if (paper === "ruled") {
    for (let y = 32; y <= h; y += 32) { ctx.moveTo(0, y); ctx.lineTo(w, y); }
    ctx.stroke();
  } else if (paper === "grid") {
    ctx.lineWidth = 0.55;
    for (let x = 24; x <= w; x += 24) { ctx.moveTo(x, 0); ctx.lineTo(x, h); }
    for (let y = 24; y <= h; y += 24) { ctx.moveTo(0, y); ctx.lineTo(w, y); }
    ctx.stroke();
  } else if (paper === "dotted") {
    for (let x = 16; x <= w; x += 24) {
      for (let y = 16; y <= h; y += 24) {
        ctx.moveTo(x + 1.2, y);
        ctx.arc(x, y, 1.2, 0, Math.PI * 2);
      }
    }
    ctx.fill();
  }
}

/** Görsel URL'sini yükleyip verilen dikdörtgene "cover" oranında çizer. */
export function drawImageURL(ctx, url, x, y, w, h) {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      const scale = Math.max(w / image.width, h / image.height);
      const dw = image.width * scale;
      const dh = image.height * scale;
      ctx.save();
      ctx.beginPath();
      ctx.rect(x, y, w, h);
      ctx.clip();
      ctx.drawImage(image, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
      ctx.restore();
      resolve(true);
    };
    image.onerror = () => resolve(false);
    image.src = url;
  });
}

let pdfjsPromise = null;
function pdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = import("../vendor/pdf.min.mjs").then((mod) => {
      mod.GlobalWorkerOptions.workerSrc = new URL("../vendor/pdf.worker.min.mjs", import.meta.url).href;
      return mod;
    });
  }
  return pdfjsPromise;
}

const pdfDocs = new Map();
const pdfImages = new Map();

async function pdfDocument(assetId) {
  if (pdfDocs.has(assetId)) return pdfDocs.get(assetId);
  const blob = await store.assetBlob(assetId);
  if (!blob) return null;
  const lib = await pdfjs();
  const data = new Uint8Array(await blob.arrayBuffer());
  const doc = await lib.getDocument({ data }).promise;
  pdfDocs.set(assetId, doc);
  return doc;
}

/** PDF'in sayfa boyutlarını A4 genişliğine ölçekleyerek döndürür. */
export async function pdfPageSizes(assetId) {
  const doc = await pdfDocument(assetId);
  if (!doc) return [];
  const sizes = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const viewport = page.getViewport({ scale: 1 });
    const w = 595;
    const h = Math.max(100, Math.round(w * viewport.height / viewport.width));
    sizes.push({ w, h });
  }
  return sizes;
}

/** PDF sayfasını görsel URL'sine çevirir (önbellekli). */
export async function pdfPageImage(reference, pixelWidth) {
  const key = `${reference.asset}#${reference.index}@${pixelWidth}`;
  if (pdfImages.has(key)) return pdfImages.get(key);
  const doc = await pdfDocument(reference.asset);
  if (!doc) return null;
  const page = await doc.getPage(reference.index + 1);
  const base = page.getViewport({ scale: 1 });
  const scale = pixelWidth / base.width;
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(viewport.width);
  canvas.height = Math.round(viewport.height);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport }).promise;
  const url = canvas.toDataURL("image/jpeg", 0.88);
  pdfImages.set(key, url);
  return url;
}

/**
 * Sayfa arka plan öğesini doldurur: PDF > kendi şablon > desen.
 * `el` bir div; içine canvas ya da img koyar. Boyut sayfanın kendi boyutudur.
 */
export async function renderBackground(el, page, { thumbnail = false } = {}) {
  el.replaceChildren();
  el.style.background = PAPER_COLOR;
  const { w, h } = page.size;
  if (page.pdf) {
    const url = await pdfPageImage(page.pdf, thumbnail ? 300 : 1400);
    if (url) {
      el.style.background = "#fff";
      el.append(img(url));
      return;
    }
  }
  if (page.templateAsset) {
    const url = await store.assetURL(page.templateAsset);
    if (url) {
      el.append(img(url));
      return;
    }
  }
  const canvas = document.createElement("canvas");
  drawPaper(canvas, page.paper, thumbnail ? w / 4 : w, thumbnail ? h / 4 : h);
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  el.append(canvas);
}

function img(url) {
  const image = document.createElement("img");
  image.src = url;
  image.alt = "";
  image.draggable = false;
  image.style.cssText = "width:100%;height:100%;object-fit:cover;display:block;pointer-events:none";
  return image;
}

const pdfLines = new Map();

/**
 * PDF sayfasındaki metin satırlarını sayfa koordinatında verir: [{ x, y, w, h }].
 * Aynı satırdaki parçalar birleştirilir. Görsel PDF'lerde (taranmış) boş döner.
 */
export async function pdfTextLines(reference, pageSize) {
  const key = `${reference.asset}#${reference.index}`;
  if (pdfLines.has(key)) return pdfLines.get(key);
  const doc = await pdfDocument(reference.asset);
  if (!doc) return [];
  const page = await doc.getPage(reference.index + 1);
  const viewport = page.getViewport({ scale: pageSize.w / page.getViewport({ scale: 1 }).width });
  const content = await page.getTextContent();
  const items = [];
  for (const item of content.items) {
    if (!item.str || !item.str.trim() || !item.transform) continue;
    const [a, b, c, d, e, f] = item.transform;
    const fontHeight = Math.hypot(b, d) || Math.hypot(a, c) || 10;
    // pdf.js koordinatı alt-sol; viewport dönüşümüyle üst-sol'a çevir.
    const [x, yBaseline] = viewport.convertToViewportPoint(e, f);
    const scale = viewport.scale;
    const h = fontHeight * scale;
    const w = (item.width || 0) * scale;
    items.push({ x, y: yBaseline - h * 0.8, w, h, baseline: yBaseline });
  }
  // Aynı taban çizgisine yakın parçaları tek satırda birleştir.
  items.sort((p, q) => p.baseline - q.baseline || p.x - q.x);
  const lines = [];
  for (const it of items) {
    const last = lines[lines.length - 1];
    if (last && Math.abs(last.baseline - it.baseline) < Math.max(2, it.h * 0.35)) {
      const right = Math.max(last.x + last.w, it.x + it.w);
      last.x = Math.min(last.x, it.x);
      last.w = right - last.x;
      last.h = Math.max(last.h, it.h);
      last.y = Math.min(last.y, it.y);
    } else {
      lines.push({ ...it });
    }
  }
  pdfLines.set(key, lines);
  return lines;
}

const pdfItemsCache = new Map();

/** PDF metin parçalarını tek tek verir (seçilebilir metin katmanı için): [{ x, y, w, h, str }]. */
export async function pdfTextItems(reference, pageSize) {
  const key = `${reference.asset}#${reference.index}`;
  if (pdfItemsCache.has(key)) return pdfItemsCache.get(key);
  const doc = await pdfDocument(reference.asset);
  if (!doc) return [];
  const page = await doc.getPage(reference.index + 1);
  const viewport = page.getViewport({ scale: pageSize.w / page.getViewport({ scale: 1 }).width });
  const content = await page.getTextContent();
  const items = [];
  for (const item of content.items) {
    if (!item.str || !item.transform) continue;
    const [a, b, c, d, e, f] = item.transform;
    const fontHeight = Math.hypot(b, d) || Math.hypot(a, c) || 10;
    const [x, yBaseline] = viewport.convertToViewportPoint(e, f);
    const scale = viewport.scale;
    const h = fontHeight * scale;
    items.push({ x, y: yBaseline - h * 0.8, w: (item.width || 0) * scale, h, str: item.str, eol: !!item.hasEOL });
  }
  pdfItemsCache.set(key, items);
  return items;
}
