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

/** İki rengi karıştırır (CSS'teki color-mix karşılığı). */
function karistir(a, b, oran) {
  const oku = (c) => {
    const hex = String(c || "").replace("#", "");
    const tam = hex.length === 3 ? hex.split("").map((x) => x + x).join("") : hex;
    return [parseInt(tam.slice(0, 2), 16) || 0, parseInt(tam.slice(2, 4), 16) || 0, parseInt(tam.slice(4, 6), 16) || 0];
  };
  const [r1, g1, b1] = oku(a);
  const [r2, g2, b2] = oku(b);
  const m = (x, y) => Math.round(x + (y - x) * oran);
  return `rgb(${m(r1, r2)},${m(g1, g2)},${m(b1, b2)})`;
}

export async function renderPageCanvas(page, scale, opts = {}) {
  const { w, h } = page.size;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  const ctx = canvas.getContext("2d");
  ctx.scale(scale, scale);
  // Gölge ölçüleri dönüşümden etkilenmiyor, çıktı pikselinde uygulanıyor:
  // sayfa birimi cinsinden istediğimiz değerleri ölçekle çarpmak gerekiyor.
  const golge = (n) => n * scale;
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
      // Ekrandaki .placed.postit: 160° degrade, gölge ve kıvrık köşe.
      const w = object.rect.w;
      const h = object.rect.h;
      const tint = object.tint || "#FFE566";
      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,0.5)";
      ctx.shadowBlur = golge(22);
      ctx.shadowOffsetY = golge(12);
      ctx.fillStyle = tint;
      ctx.fillRect(-w / 2 + 10, -h / 2 + 10, Math.max(1, w - 20), Math.max(1, h - 20));
      ctx.restore();
      const L = Math.abs(w * 0.342) + Math.abs(h * 0.94);
      const g = ctx.createLinearGradient(-0.342 * L / 2, -0.94 * L / 2, 0.342 * L / 2, 0.94 * L / 2);
      g.addColorStop(0, karistir(tint, "#ffffff", 0.2));
      g.addColorStop(0.45, tint);
      g.addColorStop(1, karistir(tint, "#5a4a00", 0.22));
      ctx.fillStyle = g;
      ctx.fillRect(-w / 2, -h / 2, w, h);
      const k = Math.min(34, w / 3, h / 3);
      ctx.beginPath();
      ctx.moveTo(w / 2 - k, h / 2);
      ctx.lineTo(w / 2, h / 2 - k);
      ctx.lineTo(w / 2, h / 2);
      ctx.closePath();
      ctx.fillStyle = karistir(tint, "#000000", 0.25);
      ctx.fill();
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
      const w = object.rect.w;
      const h = object.rect.h;
      if (object.kind === "photo") {
        // Ekrandaki .placed.photo: beyaz polaroid çerçeve (altı daha geniş),
        // yumuşak gölge ve kıl payı iç çizgi. Eskiden görsel çerçevenin üstüne
        // tam boy çiziliyordu: çevirirken fotoğrafın çerçevesi kayboluyordu.
        const pad = 7;
        const padB = 18;
        ctx.save();
        ctx.fillStyle = "#fff";
        ctx.shadowColor = "rgba(0,0,0,0.5)";
        ctx.shadowBlur = golge(24);
        ctx.shadowOffsetY = golge(12);
        ctx.fillRect(-w / 2 + 8, -h / 2 + 8, Math.max(1, w - 16), Math.max(1, h - 16));
        ctx.shadowColor = "rgba(0,0,0,0.2)";
        ctx.shadowBlur = golge(2);
        ctx.shadowOffsetY = golge(1);
        ctx.fillRect(-w / 2, -h / 2, w, h);
        ctx.restore();
        const g = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
        g.addColorStop(0, "#ffffff");
        g.addColorStop(1, "#f3f1ea");
        ctx.fillStyle = g;
        ctx.fillRect(-w / 2, -h / 2, w, h);
        if (url) await drawImageURL(ctx, url, -w / 2 + pad, -h / 2 + pad, Math.max(1, w - pad * 2), Math.max(1, h - pad - padB));
        ctx.strokeStyle = "rgba(0,0,0,0.06)";
        ctx.lineWidth = 1;
        ctx.strokeRect(-w / 2 + 0.5, -h / 2 + 0.5, w - 1, h - 1);
      } else if (url) {
        // Çıkartma: ekranda drop-shadow var. Gölge kırpılmasın diye görsel
        // önce kendi tuvaline çiziliyor, gölgeyi o tuval bırakıyor.
        const pul = document.createElement("canvas");
        pul.width = Math.max(1, Math.round(w));
        pul.height = Math.max(1, Math.round(h));
        await drawImageURL(pul.getContext("2d"), url, 0, 0, pul.width, pul.height);
        ctx.save();
        ctx.shadowColor = "rgba(0,0,0,0.3)";
        ctx.shadowBlur = golge(10);
        ctx.shadowOffsetY = golge(8);
        ctx.drawImage(pul, -w / 2, -h / 2, w, h);
        ctx.shadowColor = "rgba(0,0,0,0.25)";
        ctx.shadowBlur = golge(2);
        ctx.shadowOffsetY = golge(2);
        ctx.drawImage(pul, -w / 2, -h / 2, w, h);
        ctx.restore();
      }
    }
    ctx.restore();
  }
  for (const stroke of orderForDrawing(page.strokes)) drawStroke(ctx, stroke);
  return canvas;
}
