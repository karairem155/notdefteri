// Dışa Aktar paneli: PDF / PNG / JPG, sayfa aralığı, kalite, arka plan.
// PDF, sayfa görsellerini (JPEG) gömen küçük bir yazıcıyla üretilir; ek kütüphane yok.
import { h, svgIcon, toast, promptDialog } from "./ui.js";
import { shell } from "./panels.js";

export function exportPanel(ctx) {
  const state = { format: "pdf", range: "current", rangeText: "", quality: 1, background: true, custom: null };
  const body = h("div");
  const build = () => {
    const card = (key, title, icon) => h("button", { type: "button", class: "sp-option" + (state.format === key ? " active" : ""), onTap: () => { state.format = key; build(); } },
      h("div", { class: "sp-option-icon" }, svgIcon(icon, 28)), h("div", { class: "sp-option-title" }, title));
    const radio = (key, title, sub, onPick) => h("button", { type: "button", class: "sp-radio" + (state.range === key ? " active" : ""), onTap: onPick || (() => { state.range = key; build(); }) },
      h("span", { class: "sp-radio-dot" }), h("span", { class: "sp-radio-text" }, title, sub ? h("span", { class: "sp-row-sub" }, sub) : null), onPick ? svgIcon("forward", 16) : null);
    const seg = (values, current, onPick) => h("div", { class: "sp-seg" }, ...values.map(([v, t]) => h("button", { type: "button", class: v === current ? "active" : "", onTap: () => onPick(v) }, t)));
    const toggleRow = (title, sub, on, onChange) => {
      const t = h("button", { class: "toggle pink" + (on ? " on" : ""), type: "button", role: "switch", "aria-checked": String(on), onTap: () => { on = !on; t.classList.toggle("on", on); t.setAttribute("aria-checked", String(on)); onChange(on); } });
      return h("div", { class: "sp-toggle-row" }, h("div", { class: "sp-row-text" }, h("div", { class: "sp-row-title" }, title), h("div", { class: "sp-row-sub" }, sub)), t);
    };
    body.replaceChildren(
      h("p", { class: "sp-desc" }, "Notlarınızı farklı formatlarda kaydedin veya paylaşın."),
      h("div", { class: "sp-section" }, "Format"),
      h("div", { class: "sp-cards", style: { gridTemplateColumns: "repeat(3, 1fr)" } }, card("pdf", "PDF", "page"), card("png", "PNG", "photo"), card("jpg", "JPG", "photo")),
      h("div", { class: "sp-section" }, "Sayfa Aralığı"),
      h("div", { class: "sp-radios" },
        radio("current", "Bu Sayfa"),
        radio("custom", "Seçili Sayfalar", state.range === "custom" && state.rangeText ? state.rangeText : null, () => promptDialog("Sayfa aralığı", "Örn. 1-3, 5", state.rangeText || "", (v) => { state.rangeText = v; state.range = "custom"; build(); })),
        radio("all", "Tüm Defter", `${ctx.pageCount()} sayfa`)),
      h("div", { class: "sp-section" }, "Kalite"),
      seg([[1, "Standart"], [2, "Yüksek"], [3, "En Yüksek"]], state.quality, (v) => { state.quality = v; build(); }),
      h("div", { class: "sp-row-sub", style: { marginTop: "8px" } }, state.quality === 1 ? "Daha küçük dosya boyutu, günlük kullanım için idealdir." : state.quality === 2 ? "Baskı ve paylaşım için net görüntü." : "En ayrıntılı çıktı, büyük dosya."),
      toggleRow("Arka Planı Dahil Et", "Sayfa arka planını dışa aktar.", state.background, (v) => { state.background = v; }),
      toggleRow("Katmanları Birleştir", "Tüm katmanları tek katman olarak kaydet.", true, () => {}),
      h("button", { class: "sp-primary-btn blue", type: "button", onTap: run }, svgIcon("share", 20), "Dışa Aktar")
    );
  };

  function pagesToExport() {
    const count = ctx.pageCount();
    if (state.range === "current") return [ctx.currentIndex()];
    if (state.range === "all") return Array.from({ length: count }, (_, i) => i);
    const out = new Set();
    for (const part of (state.rangeText || "").split(",")) {
      const m = /^\s*(\d+)\s*(?:-\s*(\d+))?\s*$/.exec(part);
      if (!m) continue;
      const a = Math.max(1, Number(m[1]));
      const b = Math.min(count, Number(m[2] || m[1]));
      for (let i = a; i <= b; i++) out.add(i - 1);
    }
    return [...out].sort((x, y) => x - y);
  }

  async function run() {
    const indexes = pagesToExport();
    if (!indexes.length) { toast("Geçerli bir sayfa aralığı gir (örn. 1-3, 5)"); return; }
    toast("Hazırlanıyor…");
    try {
      const title = ctx.title().replace(/[\\/:*?"<>|]+/g, "-") || "defter";
      if (state.format === "pdf") {
        const images = [];
        for (const i of indexes) {
          const canvas = await ctx.renderPage(i, state.quality, { background: true, opaque: true });
          const dataUrl = canvas.toDataURL("image/jpeg", state.quality === 1 ? 0.82 : 0.9);
          images.push({ data: dataUrlToBytes(dataUrl), width: canvas.width, height: canvas.height, pageW: ctx.pageSize(i).w, pageH: ctx.pageSize(i).h });
        }
        const blob = buildPdf(images);
        await deliver([new File([blob], `${title}.pdf`, { type: "application/pdf" })]);
      } else {
        const files = [];
        const mime = state.format === "png" ? "image/png" : "image/jpeg";
        for (const i of indexes) {
          const canvas = await ctx.renderPage(i, state.quality, { background: state.background, opaque: state.format === "jpg" });
          const blob = await new Promise((resolve) => canvas.toBlob(resolve, mime, 0.9));
          files.push(new File([blob], `${title}-sayfa-${i + 1}.${state.format}`, { type: mime }));
        }
        await deliver(files);
      }
    } catch (error) {
      toast("Dışa aktarılamadı: " + error.message);
    }
  }

  async function deliver(files) {
    if (navigator.canShare && navigator.canShare({ files })) {
      try { await navigator.share({ files, title: ctx.title() }); return; } catch (error) { if (error.name === "AbortError") return; }
    }
    for (const file of files) {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(file);
      a.download = file.name;
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 8000);
      await new Promise((r) => setTimeout(r, 250));
    }
    toast(files.length > 1 ? `${files.length} dosya kaydedildi` : "Kaydedildi");
  }

  build();
  return shell("Dışa Aktar", ctx.close, body);
}

function dataUrlToBytes(dataUrl) {
  const b64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Sayfa başına bir JPEG görsel içeren basit PDF (PDF 1.4, DCTDecode). Sayfa boyutu: pt cinsinden sayfa ölçüsü. */
export function buildPdf(images) {
  const enc = new TextEncoder();
  const parts = [];
  const offsets = [];
  let length = 0;
  const push = (chunk) => { const bytes = typeof chunk === "string" ? enc.encode(chunk) : chunk; parts.push(bytes); length += bytes.length; };
  const obj = (n, body) => { offsets[n] = length; push(`${n} 0 obj\n`); if (typeof body === "string") push(body); else for (const c of body) push(c); push("\nendobj\n"); };
  push("%PDF-1.4\n%âãÏÓ\n");
  const pageObjs = images.map((_, i) => 3 + i * 3);
  obj(1, "<< /Type /Catalog /Pages 2 0 R >>");
  obj(2, `<< /Type /Pages /Kids [${pageObjs.map((n) => n + " 0 R").join(" ")}] /Count ${images.length} >>`);
  images.forEach((img, i) => {
    const n = pageObjs[i];
    const w = img.pageW, hgt = img.pageH;
    const content = `q ${w} 0 0 ${hgt} 0 0 cm /Im${i} Do Q`;
    obj(n, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${hgt}] /Contents ${n + 1} 0 R /Resources << /XObject << /Im${i} ${n + 2} 0 R >> >> >>`);
    obj(n + 1, `<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
    obj(n + 2, [`<< /Type /XObject /Subtype /Image /Width ${img.width} /Height ${img.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${img.data.length} >>\nstream\n`, img.data, "\nendstream"]);
  });
  const count = 3 + images.length * 3;
  const xref = length;
  push(`xref\n0 ${count}\n0000000000 65535 f \n`);
  for (let i = 1; i < count; i++) push(String(offsets[i]).padStart(10, "0") + " 00000 n \n");
  push(`trailer\n<< /Size ${count} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  return new Blob(parts, { type: "application/pdf" });
}
