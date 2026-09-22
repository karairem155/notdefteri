// Bir sayfanın tam görüntüsünü (kağıt + nesneler + mürekkep) canvas'a çizer.
// Hem dışa aktarma hem de defter önizlemeleri aynı çizimi kullanır; böylece önizleme sayfanın gerçeğidir.
import { store } from "./store.js";
import { paintPaper, drawImageURL, pdfPageImage } from "./paper.js";
import { drawStroke, orderForDrawing } from "./ink.js";

/**
 * Çift sayfada foldu geçen nesne: sahibi tek sayfa, ama komşuda da görünür.
 *
 * Sayfa çiftleri çift indisten başlıyor (editörde de öyle: 0-1, 2-3 …).
 * Dönen `dx`, komşunun nesnelerinin BU sayfanın koordinatlarına kayması.
 */
export function spillFor(pages, index) {
  const leftIndex = index - (index % 2);
  const left = pages[leftIndex];
  const right = pages[leftIndex + 1];
  if (!left || !right) return null;
  if (index === leftIndex) return { objects: right.objects || [], dx: left.size.w };
  return { objects: left.objects || [], dx: -left.size.w };
}

export async function renderPageCanvas(page, scale, opts = {}) {
  const { w, h } = page.size;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  const ctx = canvas.getContext("2d");
  ctx.scale(scale, scale);
  if (opts.background === false && opts.opaque) { ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, w, h); }
  let drewBackground = opts.background === false;
  if (opts.background === false) { /* arka plan istenmedi */ }
  else if (page.pdf) {
    const url = await pdfPageImage(page.pdf, 800 * scale);
    if (url) drewBackground = await drawImageURL(ctx, url, 0, 0, w, h);
  } else if (page.templateAsset) {
    const url = await store.assetURL(page.templateAsset);
    if (url) drewBackground = await drawImageURL(ctx, url, 0, 0, w, h);
  }
  if (!drewBackground) paintPaper(ctx, page.pdf || page.templateAsset ? "blank" : page.paper, w, h, page.bg);
  // Kendi nesneleri + komşudan bu sayfaya taşan yarılar, birlikte sıralanıyor.
  const items = (page.objects || []).map((o) => ({ o, dx: 0 }));
  if (opts.spill) {
    for (const o of opts.spill.objects) {
      const x = o.rect.x + opts.spill.dx;
      if (x < w && x + o.rect.w > 0) items.push({ o, dx: opts.spill.dx });
    }
  }
  items.sort((a, b) => (a.o.z || 0) - (b.o.z || 0));
  for (const { o: object, dx } of items) {
    ctx.save();
    ctx.translate(object.rect.x + dx + object.rect.w / 2, object.rect.y + object.rect.h / 2);
    ctx.rotate((object.rotation || 0) * Math.PI / 180);
    if (object.kind === "postit") {
      ctx.fillStyle = object.tint || "#FFE566";
      ctx.fillRect(-object.rect.w / 2, -object.rect.h / 2, object.rect.w, object.rect.h);
    } else if (object.kind === "tape") {
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = object.tint || "#F5D76E";
      ctx.fillRect(-object.rect.w / 2, -object.rect.h / 2, object.rect.w, object.rect.h);
      ctx.globalAlpha = 1;
    } else if (object.kind === "check") {
      const r = object.rect.w / 2;
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = object.checked ? "#f27ab0" : "#1c1c1e";
      ctx.fillStyle = object.checked ? "#f27ab0" : "rgba(255,255,255,0.7)";
      ctx.beginPath(); ctx.roundRect(-r, -r, r * 2, r * 2, 8); ctx.fill(); ctx.stroke();
      if (object.checked) { ctx.strokeStyle = "#fff"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-r * 0.5, 0); ctx.lineTo(-r * 0.1, r * 0.4); ctx.lineTo(r * 0.55, -r * 0.4); ctx.stroke(); }
    } else if (object.kind === "text") {
      ctx.fillStyle = object.color || "#1C1C1E";
      ctx.font = `${object.size || 24}px ${object.font || "sans-serif"}`;
      ctx.textBaseline = "top";
      const words = (object.text || "").replace(/\[x\]/gi, "☑").replace(/\[ \]/g, "☐").split(/\s+/);
      let line = "";
      let y = -object.rect.h / 2 + 6;
      const maxW = object.rect.w - 16;
      for (const word of words) {
        const test = line ? line + " " + word : word;
        if (ctx.measureText(test).width > maxW && line) { ctx.fillText(line, -object.rect.w / 2 + 8, y); line = word; y += (object.size || 24) * 1.25; }
        else line = test;
      }
      if (line) ctx.fillText(line, -object.rect.w / 2 + 8, y);
    } else {
      const url = await store.assetURL(object.asset);
      if (object.kind === "photo") {
        ctx.fillStyle = "#fff";
        ctx.fillRect(-object.rect.w / 2, -object.rect.h / 2, object.rect.w, object.rect.h);
      }
      if (url) await drawImageURL(ctx, url, -object.rect.w / 2, -object.rect.h / 2, object.rect.w, object.rect.h);
    }
    ctx.restore();
  }
  for (const stroke of orderForDrawing(page.strokes)) drawStroke(ctx, stroke);
  return canvas;
}
