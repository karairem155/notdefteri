// Sayfa arka planı: uygulamayla gelen desen, kullanıcının şablon görseli ya da PDF sayfası.
import { store } from "./store.js";

export const PAPER_COLOR = "#f2f0e6";
const INK = "rgba(120,124,135,0.55)";

/** Sayfa rengine göre desen çizgisi: açık kağıtta gri, koyu kağıtta açık. */
export function pageInk(color) {
  const hex = (color || PAPER_COLOR).replace("#", "");
  const full = hex.length === 3 ? hex.split("").map((c) => c + c).join("") : hex;
  const r = parseInt(full.slice(0, 2), 16) || 0;
  const g = parseInt(full.slice(2, 4), 16) || 0;
  const b = parseInt(full.slice(4, 6), 16) || 0;
  const luma = (r * 299 + g * 587 + b * 114) / 1000;
  return luma < 130 ? "rgba(255,255,255,0.28)" : INK;
}

/** Deseni verilen tuvale çizer (CSS piksel boyutu w×h, dpr ölçekli). */
export function drawPaper(canvas, paper, w, h, color) {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  canvas.style.width = w + "px";
  canvas.style.height = h + "px";
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  paintPaper(ctx, paper, w, h, color);
}

/** Deseni hazır bir bağlama çizer (anlık görüntü ve önizlemeler için). */
export function paintPaper(ctx, paper, w, h, color) {
  const ink = pageInk(color);
  ctx.fillStyle = color || PAPER_COLOR;
  ctx.fillRect(0, 0, w, h);
  // Ölçüler CSS karşılığıyla (paperCss) birebir: çizgi karonun dibinde ve
  // 1 birim kalın, nokta karonun ortasında. Aynı olmazsa sayfa çevrilirken
  // desen kayıyor ve kağıdın rengi değişmiş gibi görünüyor.
  ctx.fillStyle = ink;
  if (paper === "ruled") {
    for (let y = 32; y <= h; y += 32) ctx.fillRect(0, y - 1, w, 1);
  } else if (paper === "grid") {
    for (let x = 24; x <= w; x += 24) ctx.fillRect(x - 1, 0, 1, h);
    for (let y = 24; y <= h; y += 24) ctx.fillRect(0, y - 1, w, 1);
  } else if (paper === "dotted") {
    ctx.beginPath();
    for (let x = 12; x <= w; x += 24) {
      for (let y = 12; y <= h; y += 24) {
        ctx.moveTo(x + 1.6, y);
        ctx.arc(x, y, 1.6, 0, Math.PI * 2);
      }
    }
    ctx.fill();
  }
}

/**
 * Yerleşik desenin CSS karşılığı: çizgi/kare/nokta degradeyle çizilir.
 * Tuval yerine CSS kullanmak, yakınlaştırınca desenin bulanıklaşmasını önler.
 */
export function paperCss(paper, color, size) {
  const ink = pageInk(color);
  const bg = color || PAPER_COLOR;
  const w = (size && size.w) || 595;
  const h = (size && size.h) || 842;
  const yok = { backgroundColor: bg, backgroundImage: "none", backgroundPosition: "0 0", backgroundSize: "auto" };
  // Ölçüler yüzdeyle verilir: hem tam sayfada hem küçük önizlemede desen aynı oranda kalır.
  const yuzde = (deger, tam) => (deger / tam * 100);
  if (paper === "ruled") {
    const tile = yuzde(32, h);
    const cizgi = 100 - yuzde(1, 32) * 1;                       // çizgi karonun dibinde
    return { backgroundColor: bg, backgroundImage: `linear-gradient(180deg, transparent 0 ${cizgi.toFixed(2)}%, ${ink} ${cizgi.toFixed(2)}% 100%)`, backgroundPosition: "0 0", backgroundSize: `100% ${tile.toFixed(3)}%` };
  }
  if (paper === "grid") {
    const tileX = yuzde(24, w);
    const tileY = yuzde(24, h);
    const cizgiX = 100 - yuzde(1, 24);
    const cizgiY = 100 - yuzde(1, 24);
    return {
      backgroundColor: bg,
      backgroundImage: `linear-gradient(90deg, transparent 0 ${cizgiX.toFixed(2)}%, ${ink} ${cizgiX.toFixed(2)}% 100%), linear-gradient(180deg, transparent 0 ${cizgiY.toFixed(2)}%, ${ink} ${cizgiY.toFixed(2)}% 100%)`,
      backgroundPosition: "0 0",
      backgroundSize: `${tileX.toFixed(3)}% 100%, 100% ${tileY.toFixed(3)}%`
    };
  }
  if (paper === "dotted") {
    const tileX = yuzde(24, w);
    const tileY = yuzde(24, h);
    return {
      backgroundColor: bg,
      backgroundImage: `radial-gradient(circle at 50% 50%, ${ink} 0 9%, transparent 11%)`,
      backgroundPosition: "0 0",
      backgroundSize: `${tileX.toFixed(3)}% ${tileY.toFixed(3)}%`
    };
  }
  return yok;
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
  el.style.background = page.bg || PAPER_COLOR;
  el.style.backgroundImage = "none";
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
  // Yerleşik desen: tuval değil CSS. Yakınlaştırınca çizgiler keskin kalır.
  const css = paperCss(page.paper, page.bg, page.size);
  el.style.backgroundColor = css.backgroundColor;
  el.style.backgroundImage = css.backgroundImage;
  el.style.backgroundPosition = css.backgroundPosition;
  el.style.backgroundSize = css.backgroundSize;
  el.style.backgroundRepeat = "repeat";
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
