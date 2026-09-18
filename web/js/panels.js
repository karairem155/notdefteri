// Sol kenar panelleri (tasarım ekranları): Kalem Ayarları, Silgi Ayarları, Şekiller ve Cetvel,
// Seçim, Favoriler, Renk Seçici. Editör bir `ctx` verir; paneller durumu oradan okur/yazar.
import { h, svgIcon, toast, promptDialog, actionSheet } from "./ui.js";

export const WIDTH_PRESETS = [1.2, 2, 3.2, 4.8, 8];          // mm karşılığı: 0.3 0.5 0.8 1.2 2.0
export const HL_PRESETS = [6, 8, 10, 14, 20];

/** Kalınlık gösterimi: sayfa birimi / 4 ≈ mm. */
export function mm(width) {
  return (Math.round((width / 4) * 10) / 10).toFixed(1);
}

// ---------- ortak parçalar ----------

export function shell(title, onClose, ...children) {
  let icon = null;
  if (typeof title === "object") { icon = title.icon; title = title.title; }
  return h("div", { class: "side-panel", role: "dialog", "aria-label": title },
    h("div", { class: "sp-head" }, h("h2", {}, icon ? h("span", { class: "sp-title-icon" }, svgIcon(icon, 24)) : null, title), h("button", { class: "sp-close", type: "button", "aria-label": "Kapat", onTap: onClose }, svgIcon("close", 18))),
    h("div", { class: "sp-body" }, ...children.filter(Boolean)));
}

function section(text) {
  return h("div", { class: "sp-section" }, text);
}

function labelRow(label, value) {
  return h("div", { class: "sp-label-row" }, h("span", {}, label), h("span", { class: "sp-value" }, value));
}

function slider({ min, max, step, value, onInput, label }) {
  return h("input", { type: "range", class: "sp-range", min: String(min), max: String(max), step: String(step), value: String(value), "aria-label": label,
    onInput: (e) => onInput(Number(e.target.value)) });
}

function presetRow(values, current, onPick, fmt) {
  return h("div", { class: "sp-presets" }, ...values.map((v) =>
    h("button", { type: "button", class: "sp-preset" + (Math.abs(v - current) < 0.05 ? " active" : ""), onTap: () => onPick(v) }, fmt(v))));
}

function toggle(on, onChange) {
  const el = h("button", { class: "toggle pink" + (on ? " on" : ""), type: "button", role: "switch", "aria-checked": String(on),
    onTap: () => { on = !on; el.classList.toggle("on", on); el.setAttribute("aria-checked", String(on)); onChange(on); } });
  return el;
}

function toggleRow(title, sub, on, onChange, icon) {
  return h("div", { class: "sp-toggle-row" },
    icon ? h("div", { class: "sp-row-icon" }, svgIcon(icon, 26)) : null,
    h("div", { class: "sp-row-text" }, h("div", { class: "sp-row-title" }, title), sub ? h("div", { class: "sp-row-sub" }, sub) : null),
    toggle(on, onChange));
}

function previewCard(label, color, width, alpha) {
  const w = Math.max(2, Math.min(18, width * 1.6));
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 340 60");
  svg.setAttribute("class", "sp-preview-svg");
  svg.innerHTML = `<path d="M10 42 C 70 -10, 120 70, 180 30 S 300 10, 330 22" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round" opacity="${alpha}"/>`;
  return h("div", { class: "sp-card" }, h("div", { class: "sp-card-label" }, label), svg);
}

function optionCards(options, current, onPick) {
  return h("div", { class: "sp-cards", style: { gridTemplateColumns: `repeat(${options.length}, 1fr)` } }, ...options.map((o) =>
    h("button", { type: "button", class: "sp-option" + (o.key === current ? " active" : ""), onTap: () => onPick(o.key) },
      h("div", { class: "sp-option-icon" }, svgIcon(o.icon, 30)),
      h("div", { class: "sp-option-title" }, o.title),
      o.sub ? h("div", { class: "sp-option-sub" }, o.sub) : null)));
}

function colorRow(label, color, onOpen) {
  return h("div", { class: "sp-color-row" },
    h("span", {}, label),
    h("span", { class: "sp-color-dot", style: { "--c": color } }),
    h("button", { class: "sp-link-btn", type: "button", onTap: onOpen }, "Renkleri aç", svgIcon("forward", 16)));
}

function heartButton(text, onTap) {
  return h("button", { class: "sp-outline-btn", type: "button", onTap }, svgIcon("heart", 18), text);
}

// ---------- Kalem Ayarları ----------

const HOLD_NAMES = ["Devre dışı", "Kısa", "Varsayılan", "Uzun"];
const HOLD_VALUES = [0, 350, 600, 950];

export function penPanel(ctx) {
  const s = ctx.store.settings;
  const body = h("div");
  const build = () => {
    const tool = ctx.tool();
    const hl = tool.tool === "highlighter";
    const a = tool.alpha == null ? 1 : tool.alpha;
    const widthValue = h("span", { class: "sp-value" }, mm(tool.width));
    const opacityValue = h("span", { class: "sp-value" }, "%" + Math.round(a * 100));
    const smoothing = Math.min(3, Math.max(0, s.smoothing == null ? 2 : s.smoothing));
    const SMOOTH = ["Temel", "Yumuşak", "İpek", "Akıcı"];
    const holdMs = s.shapeRecognition === false ? 0 : (s.shapeHoldMs == null ? 600 : s.shapeHoldMs);
    const holdIndex = Math.max(0, HOLD_VALUES.indexOf(holdMs));
    const preview = previewCard(hl ? "Fosforlu Önizleme" : "Kalem Önizleme", tool.color, hl ? tool.width * 1.4 : tool.width, hl ? 0.42 * a : a);
    body.replaceChildren(...[
      preview,
      section("Uç Tipi"),
      optionCards([{ key: "pen", title: "Jel", icon: "tipGel" }, { key: "fineliner", title: "Fineliner", icon: "tipFine" }, { key: "pencil", title: "Kurşun", icon: "tipPencil" }, { key: "highlighter", title: "Fosforlu", icon: "highlighter" }],
        tool.tool, (k) => { ctx.setTool({ tool: k }); build(); }),
      h("div", { class: "sp-label-row", style: { marginTop: "18px" } }, h("span", {}, "Kalınlık"), widthValue),
      slider({ min: hl ? 4 : 0.8, max: hl ? 24 : 12, step: 0.2, value: tool.width, label: "Kalınlık",
        onInput: (v) => { ctx.setTool({ width: v }, true); widthValue.textContent = mm(v); preview.replaceWith(previewCard(hl ? "Fosforlu Önizleme" : "Kalem Önizleme", tool.color, hl ? v * 1.4 : v, hl ? 0.42 * a : a)); build(); } }),
      presetRow(hl ? HL_PRESETS : WIDTH_PRESETS, tool.width, (v) => { ctx.setTool({ width: v }); build(); }, mm),
      h("div", { class: "sp-label-row", style: { marginTop: "16px" } }, h("span", {}, "Opaklık"), opacityValue),
      slider({ min: 10, max: 100, step: 5, value: Math.round(a * 100), label: "Opaklık",
        onInput: (v) => { ctx.setTool({ alpha: v / 100 }, true); opacityValue.textContent = "%" + v; } }),
      toggleRow("Basınç Hassasiyeti", "Kalem baskısına göre kalınlık ayarla.", !!s.pressureWidth, (v) => ctx.store.setSetting("pressureWidth", v)),
      h("div", { class: "sp-label-row", style: { marginTop: "16px" } }, h("span", {}, "Şekil çizmek için basılı tutun"), h("span", { class: "sp-value" }, HOLD_NAMES[holdIndex])),
      h("div", { class: "sp-seg" }, ...HOLD_NAMES.map((name, i) => h("button", { type: "button", class: i === holdIndex ? "active" : "",
        onTap: () => { ctx.store.setSetting("shapeHoldMs", HOLD_VALUES[i]); ctx.store.setSetting("shapeRecognition", i > 0); build(); } }, name))),
      h("div", { class: "sp-row-sub", style: { marginTop: "6px" } }, "Çizimin sonunda kalemi sabit tutunca çizgi düz çizgiye, kabaca çizilen şekil gerçek şekle dönüşür."),
      h("div", { class: "sp-label-row", style: { marginTop: "16px" } }, h("span", {}, "Stabilizatör"), h("span", { class: "sp-value" }, SMOOTH[smoothing])),
      h("div", { class: "sp-seg" }, ...SMOOTH.map((name, i) => h("button", { type: "button", class: i === smoothing ? "active" : "",
        onTap: () => { ctx.store.setSetting("smoothing", i); build(); } }, name))),
      h("div", { class: "sp-row-sub", style: { marginTop: "6px" } }, "El titremesini yumuşatır; yüksek seviyede çizgi daha akıcı olur."),
      h("div", { class: "sp-sep" }),
      colorRow("Mevcut Renk", tool.color, () => ctx.openColor()),
      (s.recentColors || []).length ? section("Son Kullanılan Renkler") : null,
      (s.recentColors || []).length ? h("div", { class: "cp-swatches" }, ...(s.recentColors || []).slice(0, 8).map((c) =>
        h("button", { class: "cp-swatch" + (c.toUpperCase() === tool.color.toUpperCase() ? " selected" : ""), type: "button", style: { "--c": c }, "aria-label": "Renk " + c, onTap: () => { ctx.setColor(c); build(); } }))) : null,
      h("div", { class: "sp-two" },
        heartButton("Favorilere ekle", () => ctx.addFavorite()),
        h("button", { class: "sp-outline-btn", type: "button", onTap: () => ctx.openFavorites() }, svgIcon("drag", 18), "Favorilerim"))
    ].filter(Boolean));
  };
  build();
  return shell("Kalem Ayarları", ctx.close, body);
}

// ---------- Silgi Ayarları ----------

export function eraserPanel(ctx) {
  const e = { mode: "stroke", size: 12, onlyHighlighter: false, pressureSize: false, ...ctx.store.settings.eraser };
  const save = () => ctx.store.setSetting("eraser", { ...e });
  const body = h("div");
  const build = () => {
    const sizeValue = h("span", { class: "sp-value" }, e.size + " px");
    body.replaceChildren(
      Object.assign(previewCard("Önizleme", "#f27ab0", Math.min(16, e.size / 3 + 4), 1), { className: "sp-card checker" }),
      section("Silgi Modu"),
      optionCards([
        { key: "pixel", title: "Piksel", icon: "eraser", sub: "Tam hassasiyetle tek tek siler." },
        { key: "stroke", title: "Çizgi", icon: "wave", sub: "Dokunduğun çizgiyi tamamen siler." },
        { key: "area", title: "Alan", icon: "lassoRect", sub: "Çizdiğin kutunun içindeki her şeyi siler." }
      ], e.mode, (k) => { e.mode = k; save(); build(); }),
      h("div", { class: "sp-label-row", style: { marginTop: "18px" } }, h("span", {}, "Boyut"), sizeValue),
      slider({ min: 4, max: 80, step: 1, value: e.size, label: "Silgi boyutu", onInput: (v) => { e.size = v; sizeValue.textContent = v + " px"; save(); } }),
      presetRow([6, 12, 20, 28, 48, 80], e.size, (v) => { e.size = v; save(); build(); }, (v) => String(v)),
      h("div", { class: "sp-sep" }),
      toggleRow("Yalnız fosforluyu sil", "Sadece fosforlu kalem izlerini siler.", !!e.onlyHighlighter, (v) => { e.onlyHighlighter = v; save(); }),
      toggleRow("Basınca göre boyut", "Kalem baskısına göre silgi boyutunu ayarla.", !!e.pressureSize, (v) => { e.pressureSize = v; save(); }),
      h("div", { class: "sp-sep" }),
      h("button", { class: "sp-outline-btn danger", type: "button", onTap: () => ctx.clearPage() }, svgIcon("trash", 18), "Sayfadaki her şeyi sil")
    );
  };
  build();
  return shell("Silgi Ayarları", ctx.close, body);
}

// ---------- Şekiller ve Cetvel ----------

export const SHAPES = [
  ["line", "Çizgi", "shapeLine"], ["arrow", "Ok", "shapeArrow"], ["rect", "Dikdörtgen", "shapeRect"],
  ["circle", "Daire", "shapeCircle"], ["triangle", "Üçgen", "shapeTriangle"], ["star", "Yıldız", "star"]
];

export function shapesPanel(ctx) {
  const s = ctx.store.settings;
  const body = h("div");
  const build = () => {
    const tool = ctx.tool();
    const current = tool.tool === "shape" ? tool.shape : null;
    const widthValue = h("span", { class: "sp-value" }, mm(tool.width));
    body.replaceChildren(
      section("Şekil Araçları"),
      h("div", { class: "sp-cards", style: { gridTemplateColumns: "repeat(3, 1fr)" } }, ...SHAPES.map(([key, title, icon]) =>
        h("button", { type: "button", class: "sp-option" + (current === key ? " active" : ""), onTap: () => { ctx.setTool({ tool: "shape", shape: key }); build(); } },
          h("div", { class: "sp-option-icon" }, svgIcon(icon, 30)), h("div", { class: "sp-option-title" }, title)))),
      section("Çizgi Ayarları"),
      h("div", { class: "sp-label-row" }, h("span", {}, "Kalınlık"), widthValue),
      slider({ min: 0.8, max: 12, step: 0.2, value: tool.width, label: "Kalınlık", onInput: (v) => { ctx.setTool({ width: v }, true); widthValue.textContent = mm(v); } }),
      presetRow(WIDTH_PRESETS, tool.width, (v) => { ctx.setTool({ width: v }); build(); }, mm),
      colorRow("Renk", tool.color, () => ctx.openColor()),
      section("Cetvel"),
      toggleRow("Cetveli Göster", "Düz çizgiler çizmek için cetvel kullanın.", ctx.ruler.active(), () => ctx.ruler.toggle(), "ruler"),
      toggleRow("Açı Göstergesi", null, s.rulerAngle !== false, (v) => { ctx.store.setSetting("rulerAngle", v); ctx.ruler.refresh(); }),
      toggleRow("Yapışma (Snapping)", "Şekiller hizalama kılavuzlarına yapışsın.", s.rulerSnap !== false, (v) => ctx.store.setSetting("rulerSnap", v))
    );
  };
  build();
  return shell("Şekiller ve Cetvel", ctx.close, body);
}

// ---------- Seçim ----------

export function selectionPanel(ctx) {
  const row = (icon, title, sub, fn, cls = "") => h("button", { type: "button", class: "sp-action" + (cls ? " " + cls : ""), onTap: fn },
    h("div", { class: "sp-action-icon" }, svgIcon(icon, 24)), h("div", {}, h("div", { class: "sp-row-title" }, title), sub ? h("div", { class: "sp-row-sub" }, sub) : null));
  const sel = ctx.selection;
  return shell("Seçim", ctx.close,
    row("move", "Taşı", "Seçilen içeriği taşı", () => toast("Kutuyu sürükle, köşeden büyüt, üstten döndür"), "active"),
    row("copy", "Kopyala", "Panoya kopyala", sel.copy),
    row("duplicate", "Çoğalt", "Seçimi çoğalt", sel.duplicate),
    row("scissors", "Kes", "Seçimi kes", sel.cut),
    row("pen", "Renk Değiştir", "Seçilen içeriğin rengini değiştir", () => ctx.openColor({ onPick: sel.recolor, title: "Seçim Rengi" })),
    row("layerUp", "Öne Al", "Bir katman öne getir", sel.front),
    row("layerDown", "Arkaya Gönder", "Bir katman arkaya gönder", sel.back),
    h("div", { class: "sp-sep" }),
    row("trash", "Seçimi Sil", null, sel.remove, "danger"));
}

// ---------- Favoriler ----------

export function favoritesPanel(ctx) {
  const body = h("div");
  const build = () => {
    const s = ctx.store.settings;
    const list = h("div", { class: "fav-list" });
    s.pens.forEach((pen, index) => {
      const selected = ctx.penMatches(pen);
      const row = h("div", { class: "fav-row" + (selected ? " selected" : ""), role: "button", tabindex: "0", "aria-label": pen.name });
      const handle = h("div", { class: "fav-drag", "aria-label": "Sırala: sürükle" }, svgIcon("drag", 20));
      const illo = h("div", { class: "fav-illo" }, ctx.penIllustration(pen));
      const dot = h("div", { class: "fav-dot", style: { "--c": pen.color } });
      const text = h("div", { class: "fav-text" }, h("div", { class: "fav-name" }, pen.name), h("div", { class: "fav-width" }, mm(pen.width)));
      const edit = h("button", { class: "fav-icon-btn", type: "button", "aria-label": "Düzenle", onTap: (e) => { e.stopPropagation(); editMenu(pen); } }, svgIcon("edit", 18));
      const del = h("button", { class: "fav-icon-btn", type: "button", "aria-label": "Sil", disabled: s.pens.length <= 1, onTap: (e) => { e.stopPropagation(); ctx.store.removePen(pen.id); build(); ctx.rerender(); } }, svgIcon("trash", 18));
      row.append(handle, illo, dot, text, edit, del);
      row.addEventListener("pointerup", (e) => { if (e.target.closest(".fav-icon-btn") || e.target.closest(".fav-drag")) return; if (row._dragged) { row._dragged = false; return; } ctx.applyPen(pen); build(); });
      // Sürükleyerek sıralama: tutamaçtan tut, bırakınca hedef sıraya taşınır.
      handle.addEventListener("pointerdown", (e) => {
        e.preventDefault(); e.stopPropagation();
        try { handle.setPointerCapture(e.pointerId); } catch (_) { /* sentetik */ }
        const startY = e.clientY;
        row.classList.add("dragging");
        const move = (ev) => { row.style.transform = `translateY(${ev.clientY - startY}px)`; };
        const up = (ev) => {
          handle.removeEventListener("pointermove", move); handle.removeEventListener("pointerup", up); handle.removeEventListener("pointercancel", up);
          row.classList.remove("dragging"); row.style.transform = "";
          const rows = [...list.children];
          let target = index;
          rows.forEach((r, i) => { const b = r.getBoundingClientRect(); if (ev.clientY > b.top + b.height / 2) target = Math.max(target, i > index ? i : target); if (ev.clientY < b.top + b.height / 2 && i < index) target = Math.min(target, i); });
          if (target !== index) { const dir = target > index ? 1 : -1; for (let k = index; k !== target; k += dir) ctx.store.movePen(pen.id, dir); build(); ctx.rerender(); }
        };
        handle.addEventListener("pointermove", move); handle.addEventListener("pointerup", up); handle.addEventListener("pointercancel", up);
      });
      list.append(row);
    });
    body.replaceChildren(
      h("p", { class: "sp-desc" }, "Sık kullandığın kalem ayarlarını kaydet, hemen ulaş ve notlarını daha hızlı al. Sürükleyerek sırala."),
      list,
      h("button", { class: "sp-outline-btn wide", type: "button", onTap: () => { ctx.addFavorite(); build(); } }, svgIcon("plus", 18), "Yeni favori"));
  };
  const editMenu = (pen) => {
    const s = ctx.store.settings;
    actionSheet(pen.name, [
      { title: "Yeniden Adlandır", onSelect: () => promptDialog("Kalem adı", "Ad", pen.name, (name) => { ctx.store.updatePen(pen.id, { name }); build(); ctx.rerender(); }) },
      { title: "Şu Anki Ayarlarla Güncelle", onSelect: () => { const t = ctx.tool(); ctx.store.updatePen(pen.id, { tool: t.tool === "shape" ? "pen" : t.tool, color: t.color, width: t.width }); build(); ctx.rerender(); } },
      { title: pen.id === s.defaultPenId ? "✓ Varsayılan kalem" : "Varsayılan Yap", onSelect: () => { ctx.store.setSetting("defaultPenId", pen.id); build(); } }
    ]);
  };
  build();
  return shell({ title: "Favoriler", icon: "star" }, ctx.close, body);
}

// ---------- Renk Seçici ----------

export function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || "");
  if (!m) return { r: 28, g: 28, b: 30 };
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function rgbToHex({ r, g, b }) {
  const c = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
  return ("#" + c(r) + c(g) + c(b)).toUpperCase();
}

export function rgbToHsv({ r, g, b }) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const d = max - min;
  let hue = 0;
  if (d) {
    if (max === r) hue = ((g - b) / d) % 6;
    else if (max === g) hue = (b - r) / d + 2;
    else hue = (r - g) / d + 4;
    hue *= 60;
    if (hue < 0) hue += 360;
  }
  return { h: hue, s: max ? d / max : 0, v: max };
}

export function hsvToRgb({ h: hue, s, v }) {
  const c = v * s;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = v - c;
  let r = 0, g = 0, b = 0;
  if (hue < 60) [r, g, b] = [c, x, 0];
  else if (hue < 120) [r, g, b] = [x, c, 0];
  else if (hue < 180) [r, g, b] = [0, c, x];
  else if (hue < 240) [r, g, b] = [0, x, c];
  else if (hue < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return { r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 };
}

/** Türkçe renk adı (yaklaşık): ton + açıklık. */
export function colorName(hex) {
  const { h: hue, s, v } = rgbToHsv(hexToRgb(hex));
  if (v < 0.12) return "Siyah";
  if (s < 0.1) return v > 0.92 ? "Beyaz" : v > 0.6 ? "Açık Gri" : "Gri";
  if (hue >= 315 && hue < 350 && s < 0.6 && v > 0.85) return "Şeker Pembesi";
  let base;
  if (hue < 15 || hue >= 350) base = "Kırmızı";
  else if (hue < 42) base = "Turuncu";
  else if (hue < 68) base = "Sarı";
  else if (hue < 160) base = "Yeşil";
  else if (hue < 200) base = "Camgöbeği";
  else if (hue < 258) base = "Mavi";
  else if (hue < 300) base = "Mor";
  else base = "Pembe";
  if (v < 0.4) return "Koyu " + base;
  if (s < 0.45 && v > 0.8) return "Pastel " + base;
  if (s < 0.65) return "Açık " + base;
  return base;
}

export function colorPanel(ctx, opts = {}) {
  const startHex = /^#[0-9a-f]{6}$/i.test(opts.initial || ctx.tool().color) ? (opts.initial || ctx.tool().color).toUpperCase() : "#1C1C1E";
  const state = { ...rgbToHsv(hexToRgb(startHex)), alpha: opts.alpha != null ? opts.alpha : (ctx.tool().alpha == null ? 1 : ctx.tool().alpha) };
  const hex = () => rgbToHex(hsvToRgb(state));
  const bigDot = h("div", { class: "cp-big", style: { "--c": startHex } });
  const nameEl = h("div", { class: "cp-name" }, colorName(startHex));
  const sv = h("div", { class: "cp-sv", role: "slider", "aria-label": "Doygunluk ve parlaklık" }, h("div", { class: "cp-knob" }));
  const hueBar = h("div", { class: "cp-hue", role: "slider", "aria-label": "Ton" }, h("div", { class: "cp-hue-knob" }));
  const alphaValue = h("span", { class: "sp-value" }, Math.round(state.alpha * 100) + "%");
  const alphaSlider = slider({ min: 0, max: 100, step: 5, value: Math.round(state.alpha * 100), label: "Opaklık", onInput: (v) => { state.alpha = v / 100; alphaValue.textContent = v + "%"; emit(); } });
  const field = (label, value, onChange, cls = "") => {
    const input = h("input", { class: "cp-field-input", value: String(value), inputmode: cls === "hex" ? "text" : "numeric", "aria-label": label,
      onChange: (e) => onChange(e.target.value) });
    return h("label", { class: "cp-field " + cls }, h("span", {}, label), input);
  };
  const fields = h("div", { class: "cp-fields" });
  const favRow = h("div", { class: "cp-swatches" });
  const recentRow = h("div", { class: "cp-swatches" });

  function paint() {
    const hx = hex();
    const rgb = hexToRgb(hx);
    bigDot.style.setProperty("--c", hx);
    nameEl.textContent = colorName(hx);
    sv.style.setProperty("--hue", rgbToHex(hsvToRgb({ h: state.h, s: 1, v: 1 })));
    sv.firstChild.style.left = (state.s * 100) + "%";
    sv.firstChild.style.top = ((1 - state.v) * 100) + "%";
    hueBar.firstChild.style.top = (state.h / 360 * 100) + "%";
    fields.replaceChildren(
      h("div", { class: "cp-hexrow" }, field("HEX", hx, (v) => { if (/^#?[0-9a-f]{6}$/i.test(v)) { Object.assign(state, rgbToHsv(hexToRgb(v.startsWith("#") ? v : "#" + v))); paint(); emit(); } }, "hex")),
      h("div", { class: "cp-rgbrow" },
        field("R", rgb.r, (v) => setRgb({ ...rgb, r: Number(v) })),
        field("G", rgb.g, (v) => setRgb({ ...rgb, g: Number(v) })),
        field("B", rgb.b, (v) => setRgb({ ...rgb, b: Number(v) }))));
    const s = ctx.store.settings;
    favRow.replaceChildren(
      ...s.palette.map((c) => swatch(c, hx)),
      h("button", { class: "cp-swatch add", type: "button", "aria-label": "Favori renklere ekle", onTap: () => { ctx.store.addPaletteColor(hx); paint(); } }, svgIcon("plus", 16)));
    recentRow.replaceChildren(...(s.recentColors || []).slice(0, 8).map((c) => swatch(c, hx)));
  }
  function swatch(c, current) {
    return h("button", { class: "cp-swatch" + (c.toUpperCase() === current ? " selected" : ""), type: "button", style: { "--c": c }, "aria-label": "Renk " + c,
      onTap: () => { Object.assign(state, rgbToHsv(hexToRgb(c))); paint(); emit(); } });
  }
  function setRgb(rgb) { Object.assign(state, rgbToHsv(rgb)); paint(); emit(); }
  function emit() {
    const hx = hex();
    if (opts.onPick) opts.onPick(hx, state.alpha);
    else ctx.setColor(hx, state.alpha);
  }
  const drag = (el, fn) => {
    let active = null;
    el.addEventListener("pointerdown", (e) => { e.preventDefault(); active = e.pointerId; try { el.setPointerCapture(e.pointerId); } catch (_) { /* sentetik */ } fn(e); });
    el.addEventListener("pointermove", (e) => { if (active === e.pointerId) { e.preventDefault(); fn(e); } });
    const end = (e) => { if (active === e.pointerId) active = null; };
    el.addEventListener("pointerup", end);
    el.addEventListener("pointercancel", end);
  };
  drag(sv, (e) => {
    const r = sv.getBoundingClientRect();
    state.s = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    state.v = 1 - Math.max(0, Math.min(1, (e.clientY - r.top) / r.height));
    paint(); emit();
  });
  drag(hueBar, (e) => {
    const r = hueBar.getBoundingClientRect();
    state.h = Math.max(0, Math.min(359.9, (e.clientY - r.top) / r.height * 360));
    paint(); emit();
  });
  paint();
  return shell(opts.title || "Renk Seçici", ctx.close,
    h("div", { class: "cp-head" }, bigDot, h("div", {}, h("div", { class: "sp-row-sub" }, "Seçilen Renk"), nameEl)),
    h("div", { class: "cp-pickers" }, sv, hueBar),
    h("div", { class: "sp-label-row", style: { marginTop: "16px" } }, h("span", {}, "Opaklık")),
    h("div", { class: "cp-alpha" }, alphaSlider, h("span", { class: "cp-alpha-value" }, alphaValue)),
    fields,
    section("Favori Renkler"), favRow,
    section("Son Kullanılan Renkler"), recentRow,
    h("button", { class: "sp-primary-btn", type: "button", onTap: () => { ctx.store.addPaletteColor(hex()); paint(); toast("Favori renklere eklendi"); } }, svgIcon("heart", 20), "Favori rengi kaydet"));
}


// ---------- Post-it ve Sticker ----------

const POSTITS = [
  ["Sarı", "#FFE566", "plain"], ["Pembe", "#FFB8CC", "plain"], ["Mavi", "#A9D3F5", "plain"],
  ["Kareli", "#FFFFFF", "grid"], ["Çizgili", "#FFE566", "lined"], ["Mor", "#D9C8F5", "plain"],
  ["Yeşil", "#B4E6A8", "plain"], ["Yırtık", "#FFB8CC", "torn"], ["Kraft", "#C9A87A", "kraft"]
];
const FROSTED = [["Buzlu sarı", "#F6EEC2"], ["Buzlu pembe", "#F6CDD6"], ["Buzlu mavi", "#CBDFF0"], ["Buzlu gri", "#E3E3E7"], ["Buzlu yeşil", "#D2EAD0"]];
const STICKERS = ["\u2764\uFE0F", "\u2B50", "\u2728", "\u{1F60A}", "\u{1F331}", "\u2615", "\u{1F4A1}", "\u2600\uFE0F", "\u{1F338}", "\u{1F380}", "\u{1F431}", "\u{1F43E}", "\u{1F389}", "\u{1F3AF}", "\u{1F4DA}", "\u{1F4DD}", "\u{1F35C}", "\u{1F3B5}", "\u{1F4F7}", "\u{1F308}", "\u{1F340}", "\u{1F525}", "\u{1F62D}", "\u{1F914}"];
const MARKS = ["\u2705", "\u{1F6A9}", "\u{1F4CC}", "\u{1F4D6}", "\u2757", "\u2753", "\u27A1\uFE0F", "\u2B06\uFE0F", "\u274C", "\u2714\uFE0F", "\u{1F4CD}", "\u{1F511}", "\u23F0", "\u{1F4C5}", "\u{1F4B0}", "\u{1F449}"];
const TAPES = [["Sarı bant", "#F5D76E", "plain"], ["Pembe bant", "#F4A7C0", "plain"], ["Mavi bant", "#8FC6F0", "plain"], ["Çizgili", "#F4A7C0", "stripes"], ["Puantiyeli", "#F5D76E", "dots"], ["Pötikare", "#9EDCC6", "gingham"]];

export function stickerPanel(ctx) {
  let tab = "postit";
  const tabs = h("div", { class: "sp-tabs" });
  const body = h("div");
  const emojiGrid = (list) => h("div", { class: "st-grid emoji" }, ...list.map((e) =>
    h("button", { class: "st-cell", type: "button", "aria-label": "Çıkartma " + e, onTap: () => ctx.addEmoji(e) }, e)));
  const build = () => {
    tabs.replaceChildren(...[["postit", "Post-it"], ["sticker", "Sticker"], ["marks", "İşaretler"], ["recent", "Sık Kullanılanlar"]].map(([k, t]) =>
      h("button", { type: "button", class: tab === k ? "active" : "", onTap: () => { tab = k; build(); } }, t)));
    if (tab === "postit") {
      body.replaceChildren(
        section("Post-it"),
        h("div", { class: "st-grid" }, ...POSTITS.map(([name, hex, style]) =>
          h("button", { class: "st-cell", type: "button", "aria-label": name + " post-it", onTap: () => ctx.addPostIt(hex, style) }, h("div", { class: "st-postit " + style, style: { "--tint": hex } })))),
        section("Buzlu post-it"),
        h("p", { class: "sp-desc" }, "Cevabın üstünü örter; dokununca açılır, tekrar dokununca kapanır."),
        h("div", { class: "st-grid" }, ...FROSTED.map(([name, hex]) =>
          h("button", { class: "st-cell", type: "button", "aria-label": name, onTap: () => ctx.addFrosted(hex) }, h("div", { class: "st-postit frosted", style: { "--tint": hex } })))),
        section("Sticker"),
        emojiGrid(STICKERS.slice(0, 16)));
    } else if (tab === "sticker") {
      body.replaceChildren(section("Sticker"), emojiGrid(STICKERS),
        section("Kendi görselim"),
        h("button", { class: "sp-outline-btn", type: "button", onTap: () => ctx.importSticker() }, svgIcon("photo", 18), "Fotoğraflar'dan çıkartma ekle"));
    } else if (tab === "marks") {
      body.replaceChildren(section("İşaretler"), emojiGrid(MARKS),
        section("Bant"),
        h("div", { class: "st-grid" }, ...TAPES.map(([name, hex, pattern]) =>
          h("button", { class: "st-cell", type: "button", "aria-label": name, onTap: () => ctx.addTape(hex, pattern) }, h("div", { class: "tape-preview " + pattern, style: { "--tint": hex } }, h("div", { class: "tape-body" }))))));
    } else {
      const recent = ctx.store.settings.recentStickers || [];
      body.replaceChildren(section("Sık Kullanılanlar"),
        recent.length ? emojiGrid(recent) : h("p", { class: "sp-desc" }, "Kullandığın çıkartmalar burada birikir."));
    }
  };
  build();
  return shell("Post-it ve Sticker", ctx.close, tabs, body);
}


// ---------- Fotoğraf ve Dosya Ekle / Metin ----------

function navRow(icon, title, onTap, sub) {
  return h("button", { class: "sp-nav-row", type: "button", onTap },
    h("span", { class: "sp-nav-icon" }, svgIcon(icon, 22)),
    h("span", { class: "sp-nav-text" }, h("span", { class: "sp-nav-title" }, title), sub ? h("span", { class: "sp-row-sub" }, sub) : null),
    svgIcon("forward", 18));
}

export function mediaPanel(ctx) {
  const recent = ctx.recentMedia();
  const grid = h("div", { class: "sp-recent-grid" });
  for (const entry of recent.slice(0, 6)) {
    const cell = h("button", { class: "sp-recent-cell", type: "button", "aria-label": entry.name || "Son eklenen", onTap: () => ctx.insertRecent(entry) });
    if (entry.kind === "pdf") cell.append(h("div", { class: "sp-recent-doc" }, svgIcon("pdf", 26), h("span", {}, entry.name || "PDF")));
    else { const img = h("img", { alt: "", draggable: "false" }); ctx.assetURL(entry.asset).then((url) => { if (url) img.src = url; }); cell.append(img); }
    grid.append(cell);
  }
  return shell("Fotoğraf ve Dosya Ekle", ctx.close,
    h("div", { class: "sp-nav" },
      navRow("photos", "Fotoğraflar", () => ctx.importPhoto()),
      navRow("camera", "Kamera", () => ctx.capturePhoto()),
      navRow("folder", "Dosyalar", () => ctx.importFile(), "Görsel ya da PDF"),
      navRow("scan", "Belge Tara", () => ctx.capturePhoto(true), "Kamerayla çekilir"),
      navRow("clock", "Son Eklenenler", () => grid.scrollIntoView({ behavior: "smooth" }))),
    h("div", { class: "sp-section-row" }, h("span", { class: "sp-section" }, "Son Eklenenler"), recent.length ? h("span", { class: "sp-row-sub" }, `${recent.length} öğe`) : null),
    recent.length ? grid : h("p", { class: "sp-desc" }, "Eklediğin fotoğraf ve dosyalar burada birikir."),
    h("div", { class: "sp-section" }, "Diğer"),
    h("div", { class: "sp-nav" },
      navRow("audio", ctx.isRecording() ? "Ses Kaydını Durdur" : "Sesli Not Kaydet", () => ctx.toggleAudio(), "Sayfaya oynatılabilir not düşer"),
      navRow("frost", ctx.isFrosted() ? "Buzlu Kalemi Kapat" : "Buzlu Kalem", () => ctx.toggleFrosted(), "Cevabın üstünü örter; dokununca açılır"),
      navRow("objects", ctx.isEditingObjects() ? "Düzenlemeyi Bitir" : "Nesneleri Düzenle", () => ctx.toggleEditing(), "Taşı, döndür, kes"),
      ctx.hasClipboard() ? navRow("copy", "Yapıştır", () => ctx.paste()) : null));
}

export function textPanel(ctx) {
  return shell("Metin", ctx.close,
    h("div", { class: "sp-nav" },
      navRow("textTool", "Yazı Kutusu", () => ctx.addText(false), "Klavye ya da Apple Pencil ile yaz"),
      navRow("check", "Yapılacaklar Listesi", () => ctx.addText(true), "Onay kutulu maddeler"),
      navRow("lassoRect", "Onay Kutusu", () => ctx.addCheckBox(), "El yazısının yanına"),
      navRow("translate", "Çeviri", () => ctx.openTranslate(), "Yaz ya da seç, çevir")));
}


/** Sayfa rengi: hazır tonlar, özel renk ve "bütün sayfalara uygula". */
export function pageColorPanel(ctx) {
  const PRESETS = [
    ["#F2F0E6", "Krem"], ["#FFFFFF", "Beyaz"], ["#FBF6E9", "Sıcak"], ["#F6EFE0", "Kraft"],
    ["#EFF4EC", "Nane"], ["#EAF1FA", "Gökyüzü"], ["#F3EEF9", "Lavanta"], ["#FBEEF1", "Gül"],
    ["#E9E7E0", "Gri"], ["#2A2C34", "Gece"]
  ];
  let all = false;
  const body = h("div");
  const build = () => {
    const current = (ctx.pageColor() || "#F2F0E6").toUpperCase();
    const cell = (hex, name) => {
      const active = hex.toUpperCase() === current;
      return h("button", { type: "button", class: "pc-cell" + (active ? " active" : ""), "aria-label": name, onTap: () => { ctx.setPageColor(hex, all); build(); } },
        h("span", { class: "pc-chip", style: { background: hex } }), h("span", { class: "pc-name" }, name));
    };
    const toggle = h("button", { class: "toggle pink" + (all ? " on" : ""), type: "button", role: "switch", "aria-checked": String(all),
      onTap: () => { all = !all; toggle.classList.toggle("on", all); toggle.setAttribute("aria-checked", String(all)); } });
    body.replaceChildren(
      h("p", { class: "sp-desc" }, "Sayfanın kağıt rengini seç. Çizgi ve kareler renge göre uyum sağlar."),
      h("div", { class: "sp-section" }, "Hazır tonlar"),
      h("div", { class: "pc-grid" }, ...PRESETS.map(([hex, name]) => cell(hex, name))),
      h("div", { class: "sp-toggle-row" }, h("div", { class: "sp-row-text" }, h("div", { class: "sp-row-title" }, "Bütün sayfalara uygula"), h("div", { class: "sp-row-sub" }, "Defterdeki her sayfa bu renge geçer")), toggle),
      h("button", { class: "sp-outline-btn", type: "button", onTap: () => ctx.openCustom(all) }, svgIcon("pen", 18), "Özel renk seç"),
      h("button", { class: "sp-outline-btn", type: "button", onTap: () => { ctx.setPageColor(null, all); build(); } }, svgIcon("undoTool", 18), "Varsayılana dön")
    );
  };
  build();
  return shell({ title: "Sayfa Rengi", icon: "page" }, ctx.close, body);
}
