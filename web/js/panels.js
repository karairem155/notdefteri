// Sol kenar panelleri (tasarım ekranları): Kalem Ayarları, Silgi Ayarları, Şekiller ve Cetvel,
// Seçim, Favoriler, Renk Seçici. Editör bir `ctx` verir; paneller durumu oradan okur/yazar.
import { h, svgIcon, toast, promptDialog, actionSheet, pressable } from "./ui.js";
import { DESENLER } from "./ink.js";

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

/** iPad'deki gibi gruplu liste kartı: içindeki satırların arası ince çizgi. */
function grup(...satirlar) {
  return h("div", { class: "sp-grup" }, ...satirlar.filter(Boolean));
}

/** Kaydırıcılı satır: üstte ad ve değer, altta kaydırıcı. */
function kaydirSatiri(ad, deger, kaydirici) {
  return h("div", { class: "sp-kaydir" }, h("div", { class: "sp-label-row" }, h("span", {}, ad), deger), kaydirici);
}

/** Simge üstte, ad altta: hızlı eylem karosu. */
function karo(icon, ad, renk, onTap) {
  return h("button", { class: "sp-karo", type: "button", onTap },
    h("span", { class: "sp-karo-simge", style: { "--s": renk } }, svgIcon(icon, 26)), h("span", { class: "sp-karo-ad" }, ad));
}

/** Kalınlık örnekleri: gerçek çizgi kalınlığında kısa izler. */
function kalinlikSecici(degerler, simdiki, onPick) {
  const enKalin = Math.max(...degerler);
  return h("div", { class: "sp-kalinlik", role: "group", "aria-label": "Hazır kalınlıklar" }, ...degerler.map((v) =>
    h("button", { type: "button", class: "sp-kalinlik-dugme" + (Math.abs(v - simdiki) < 0.05 ? " active" : ""), "aria-label": mm(v) + " mm", "aria-pressed": String(Math.abs(v - simdiki) < 0.05), onTap: () => onPick(v) },
      h("span", { class: "sp-kalinlik-iz", style: { height: Math.max(1.5, 1 + (v / enKalin) * 12) + "px" } }))));
}

function labelRow(label, value) {
  return h("div", { class: "sp-label-row" }, h("span", {}, label), h("span", { class: "sp-value" }, value));
}

/** Dolu kısmın oranı CSS'e geçiyor — çubuğu kendimiz çiziyoruz (bkz. .sp-range). */
function fillRange(el) {
  const min = Number(el.min);
  const max = Number(el.max);
  const pct = max > min ? ((Number(el.value) - min) / (max - min)) * 100 : 0;
  el.style.setProperty("--p", Math.max(0, Math.min(100, pct)) + "%");
}

export function slider({ min, max, step, value, onInput, onBitti, label }) {
  const el = h("input", { type: "range", class: "sp-range", min: String(min), max: String(max), step: String(step), value: String(value), "aria-label": label,
    onInput: (e) => { fillRange(el); onInput(Number(e.target.value)); } });
  fillRange(el);
  if (onBitti) el.addEventListener("change", onBitti);   // parmak kalkınca
  return el;
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

function optionCards(options, current, onPick) {
  // Altıdan fazla seçenek tek sıraya sığmıyor: üçerli iki sıra.
  return h("div", { class: "sp-cards", style: { gridTemplateColumns: `repeat(${options.length > 4 ? 3 : options.length}, 1fr)` } }, ...options.map((o) =>
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

// ---------- Kalem Ayarları ----------

const UCLAR = [["pen", "Jel"], ["fineliner", "Fineliner"], ["dolma", "Dolma"], ["firca", "Fırça"], ["pencil", "Kurşun"], ["highlighter", "Fosforlu"], ["desen", "Desen"], ["frosted", "Buzlu"]];
const HOLD_NAMES = ["Devre dışı", "Kısa", "Varsayılan", "Uzun"];
const HOLD_VALUES = [0, 350, 600, 950];

export function penPanel(ctx) {
  const s = ctx.store.settings;
  const body = h("div");
  /** Desen kalemi: hazır şekiller, içe aktarılan fırçalar ve "Fırça içe aktar". */
  const desenSecici = () => {
    const tool = ctx.tool();
    if (tool.tool !== "desen") return [];
    const secili = tool.desen || "kalp";
    const hucre = (deger, ad, ic) => h("button", { type: "button", class: "desen-hucre" + (secili === deger ? " secili" : ""), "aria-label": ad,
      onTap: () => { ctx.setTool({ desen: deger }); build(); } }, ic, h("span", {}, ad));
    const ornek = (ad) => {
      const c = document.createElement("canvas");
      c.width = c.height = 64;
      const g = c.getContext("2d");
      ctx.desenOrnek(g, ad, tool.color);
      return c;
    };
    const ozeller = (s.ozelFircalar || []).map((f) => {
      const img = h("img", { alt: "", draggable: "false" });
      ctx.store.assetURL(f.asset).then((u) => { if (u) img.src = u; });
      return hucre("ozel:" + f.asset, f.ad || "Fırçam", img);
    });
    return [
      section("Desen"),
      h("div", { class: "desen-izgara" }, ...DESENLER.map(([k, ad]) => hucre(k, ad, ornek(k))), ...ozeller,
        h("button", { type: "button", class: "desen-hucre ekle", onTap: async () => { await ctx.fircaIceAktar(); build(); } }, svgIcon("plus", 22), h("span", {}, "Fırça ekle"))),
      h("div", { class: "sp-row-sub", style: { marginTop: "6px" } }, "Kendi fırçanı ekle: saydam arka planlı bir PNG (damla, yıldız, el çizimi bir şekil) seç; çizgi boyunca basılır.")
    ];
  };

  /** PDF'te satıra hizalama ve fosforlunun kalınlık aralığı. */
  const pdfAyarlari = () => {
    const tool = ctx.tool();
    if (["pencil", "desen", "firca"].includes(tool.tool)) return [];
    const acik = s.pdfHizala !== false;
    const satirlar = [toggleRow("PDF'te Satıra Hizala", tool.tool === "highlighter"
      ? "PDF metninin üstünden geçerken fosforlu satıra oturur, düz ve satır boyunda olur."
      : "PDF metninin altından geçerken çizgi satırın altına düz oturur.", acik, (v) => { ctx.store.setSetting("pdfHizala", v); build(); })];
    if (acik && tool.tool === "highlighter") {
      const [en, ek] = s.fosforluAralik || [3, 18];
      const deger = h("span", { class: "sp-value" }, `${mm(en)} – ${mm(ek)}`);
      const yaz = (a, b) => { ctx.store.setSetting("fosforluAralik", [a, b]); deger.textContent = `${mm(a)} – ${mm(b)}`; };
      satirlar.push(
        h("div", { class: "sp-label-row", style: { marginTop: "12px" } }, h("span", {}, "Satırda kalınlık aralığı"), deger),
        h("div", { class: "sp-row-sub" }, "Kalınlık yazının boyuna göre ayarlanır; bu aralığın dışına çıkmaz."),
        h("div", { class: "aralik-satir" }, h("span", {}, "En ince"),
          slider({ min: 2, max: 24, step: 0.5, value: en, label: "En ince", onInput: (v) => { const b = Math.max(v, (s.fosforluAralik || [3, 18])[1]); yaz(v, b); } })),
        h("div", { class: "aralik-satir" }, h("span", {}, "En kalın"),
          slider({ min: 2, max: 36, step: 0.5, value: ek, label: "En kalın", onInput: (v) => { const a = Math.min(v, (s.fosforluAralik || [3, 18])[0]); yaz(a, v); } })));
    }
    return satirlar;
  };
  /**
   * Renk satırı: favori renkler (palet) + palette olmayan son renkler, tek sırada (yana kayar);
   * sonda renk çemberi Renk Seçici'yi açar. Favori renge uzun basınca favorilerden çıkar.
   * Renk kullanmayan araçta (buzlu) gösterilmez.
   */
  const renkSatiri = (tool) => {
    const secili = (tool.color || "").toUpperCase();
    const favori = (s.palette || []).map((c) => c.toUpperCase());
    const son = (s.recentColors || []).map((c) => c.toUpperCase()).filter((c) => !favori.includes(c)).slice(0, 8);
    const renk = (c, fav) => {
      const el = h("button", { class: "cp-swatch" + (c === secili ? " selected" : ""), type: "button", style: { "--c": c },
        "aria-label": `${fav ? "Favori" : "Son kullanılan"} renk ${colorName(c)} (${c}); uzun bas: ${fav ? "favorilerden çıkar" : "favorilere ekle"}`, "aria-pressed": String(c === secili) });
      pressable(el, {
        onTap: () => { ctx.setColor(c); build(); },
        onLong: () => actionSheet(colorName(c) + " · " + c, [fav
          ? { title: "Favori renklerden çıkar", destructive: true, disabled: s.palette.length <= 1, onSelect: () => { ctx.store.removePaletteColor(c); build(); ctx.rerender(); } }
          : { title: "Favori renklere ekle", onSelect: () => { ctx.store.addPaletteColor(c); build(); ctx.rerender(); } }])
      });
      return el;
    };
    return h("div", { class: "kp-renkler", role: "group", "aria-label": "Renk" },
      ...favori.map((c) => renk(c, true)),
      son.length && favori.length ? h("span", { class: "kp-renk-ayrac", "aria-hidden": "true" }) : null,
      ...son.map((c) => renk(c, false)),
      h("button", { class: "cp-swatch kp-cark", type: "button", "aria-label": "Diğer renkler", onTap: () => ctx.openColor() }, svgIcon("plus", 18)));
  };

  /** Buzlu kalem ayarları: Uç Tipi'nde Buzlu seçiliyken panelin içinde (ayrı pencere yok). */
  const buzluAyarlari = () => {
    const f = ctx.buzluAyar();
    const bulanikDeger = h("span", { class: "sp-value" }, String(f.blur));
    const kalinlikDeger = h("span", { class: "sp-value" }, String(f.thickness));
    return [
      grup(
        kaydirSatiri("Bulanıklık", bulanikDeger, slider({ min: 1, max: 24, step: 1, value: f.blur, label: "Bulanıklık", onInput: (v) => { ctx.buzluAyarla({ blur: v }); bulanikDeger.textContent = String(v); } })),
        kaydirSatiri("Şerit kalınlığı", kalinlikDeger, slider({ min: 12, max: 60, step: 2, value: f.thickness, label: "Şerit kalınlığı", onInput: (v) => { ctx.buzluAyarla({ thickness: v }); kalinlikDeger.textContent = String(v); } })),
        toggleRow("Dokununca açılsın", "Kapalıyken kalıcı bulanık kalır.", !!f.revealOnTap, (v) => ctx.buzluAyarla({ revealOnTap: v }))),
      h("p", { class: "sp-dipnot" }, "Yazının üstüne çek: cevap buzlu bir şeritle örtülür. Başka bir uca dokununca buzlu kalem kapanır.")
    ];
  };

  // "Yazma ayarları" katlanır bölümü: varsayılan kapalı; panel yeniden çizilince açık/kapalı kalır.
  let yazmaAcik = false;
  const build = () => {
    const tool = ctx.tool();
    const buzlu = tool.tool === "frosted";
    const hl = tool.tool === "highlighter";
    const a = tool.alpha == null ? 1 : tool.alpha;
    const widthValue = h("span", { class: "sp-value" }, mm(tool.width));
    const opacityValue = h("span", { class: "sp-value" }, "%" + Math.round(a * 100));
    const smoothing = Math.min(3, Math.max(0, s.smoothing == null ? 2 : s.smoothing));
    const SMOOTH = ["Temel", "Yumuşak", "İpek", "Akıcı"];
    const holdMs = s.shapeRecognition === false ? 0 : (s.shapeHoldMs == null ? 600 : s.shapeHoldMs);
    const holdIndex = Math.max(0, HOLD_VALUES.indexOf(holdMs));
    // Önizleme gerçek çizgi motoruyla çizilir: seçili ucun, rengin ve kalınlığın izi.
    const tuval = buzlu ? null : h("canvas", { class: "kp-onizleme", "aria-hidden": "true" });
    const onizle = () => { if (tuval) ctx.onizlemeCiz(tuval, ctx.tool()); };
    const yazmaGovde = h("div", { class: "kp-katlanir-govde", id: "kp-yazma-ayarlari", hidden: !yazmaAcik },
      grup(
        toggleRow("Basınç Hassasiyeti", "Kalem baskısına göre kalınlık ayarla.", !!s.pressureWidth, (v) => { ctx.store.setSetting("pressureWidth", v); onizle(); }),
        ...pdfAyarlari()),
      grup(
        h("div", { class: "sp-satir" },
          h("div", { class: "sp-label-row" }, h("span", {}, "Şekil için basılı tut"), h("span", { class: "sp-value" }, HOLD_NAMES[holdIndex])),
          h("div", { class: "sp-seg" }, ...HOLD_NAMES.map((name, i) => h("button", { type: "button", class: i === holdIndex ? "active" : "",
            onTap: () => { ctx.store.setSetting("shapeHoldMs", HOLD_VALUES[i]); ctx.store.setSetting("shapeRecognition", i > 0); build(); } }, name))),
          h("div", { class: "sp-row-sub" }, "Çizimin sonunda kalemi sabit tutunca çizgi düz çizgiye, kabaca çizilen şekil gerçek şekle dönüşür.")),
        h("div", { class: "sp-satir" },
          h("div", { class: "sp-label-row" }, h("span", {}, "Stabilizatör"), h("span", { class: "sp-value" }, SMOOTH[smoothing])),
          h("div", { class: "sp-seg" }, ...SMOOTH.map((name, i) => h("button", { type: "button", class: i === smoothing ? "active" : "",
            onTap: () => { ctx.store.setSetting("smoothing", i); build(); } }, name))),
          h("div", { class: "sp-row-sub" }, "El titremesini yumuşatır; yüksek seviyede çizgi daha akıcı olur."))));
    const yazmaBaslik = h("button", { class: "kp-katlanir-baslik" + (yazmaAcik ? " acik" : ""), type: "button", "aria-expanded": String(yazmaAcik), "aria-controls": "kp-yazma-ayarlari",
      onTap: () => { yazmaAcik = !yazmaAcik; yazmaGovde.hidden = !yazmaAcik; yazmaBaslik.classList.toggle("acik", yazmaAcik); yazmaBaslik.setAttribute("aria-expanded", String(yazmaAcik)); if (yazmaAcik) yazmaBaslik.scrollIntoView({ block: "start", behavior: "smooth" }); } },
      h("span", {}, "Yazma ayarları"), h("span", { class: "sp-row-sub" }, "Basınç, PDF'te hizalama, şekil, stabilizatör"), svgIcon("down", 18));
    const ucSec = (k) => {
      if (k === tool.tool) return;
      if (k === "frosted") { ctx.buzlu(); build(); return; }
      ctx.setTool(k === "desen" ? { tool: k, desen: tool.desen || "kalp", width: Math.max(6, Math.min(30, tool.width * 3)) } : { tool: k }); build();
    };
    // Uçlar gerçek kalem çizimleriyle, yan yana; seçili olan yukarı kalkar.
    const uclar = h("div", { class: "kp-uclar", role: "group", "aria-label": "Uç tipi" }, ...UCLAR.map(([k, ad]) =>
      h("button", { type: "button", class: "kp-uc" + (k === tool.tool ? " secili" : ""), "aria-label": ad, "aria-pressed": String(k === tool.tool), onTap: () => ucSec(k) },
        h("span", { class: "kp-uc-cizim" }, ctx.kalemCubugu(k, k === "frosted" ? "#7fa3c7" : k === tool.tool ? tool.color : k === "highlighter" ? "#F6D74A" : "#3A3D44")), h("span", { class: "kp-uc-ad" }, ad))));
    const benim = buzlu ? null : ctx.favoriKalem();
    const favDugme = buzlu ? null : h("button", { class: "sp-fav-dugme" + (benim ? " dolu" : ""), type: "button", "aria-pressed": String(!!benim),
      onTap: () => { if (benim) ctx.favoridenCikar(benim); else ctx.addFavorite(); build(); } }, svgIcon("star", 20), benim ? "Favorilerden çıkar" : "Favorilere ekle");
    body.replaceChildren(...[
      tuval ? h("div", { class: "kp-onizleme-kart" }, tuval) : null,
      uclar,
      ...(buzlu ? buzluAyarlari() : [
        grup(h("div", { class: "sp-satir" }, renkSatiri(tool))),
        ...desenSecici(),
        grup(
          h("div", { class: "sp-kaydir" },
            h("div", { class: "sp-label-row" }, h("span", {}, "Kalınlık"), widthValue),
            kalinlikSecici(hl ? HL_PRESETS : WIDTH_PRESETS, tool.width, (v) => { ctx.setTool({ width: v }); build(); }),
            // Sürüklerken panel yeniden kurulmaz: kaydırıcı parmağın altından kaçıyordu.
            slider({ min: hl ? 4 : tool.tool === "desen" ? 3 : 0.8, max: hl ? 24 : tool.tool === "desen" ? 40 : 12, step: 0.2, value: tool.width, label: "Kalınlık",
              onInput: (v) => { ctx.setTool({ width: v }, true); widthValue.textContent = mm(v); onizle(); }, onBitti: build })),
          kaydirSatiri("Opaklık", opacityValue, slider({ min: 10, max: 100, step: 5, value: Math.round(a * 100), label: "Opaklık",
            onInput: (v) => { ctx.setTool({ alpha: v / 100 }, true); opacityValue.textContent = "%" + v; onizle(); }, onBitti: build })))
      ]),
      h("div", { class: "sp-two" }, favDugme,
        h("button", { class: "sp-fav-dugme ikincil", type: "button", onTap: () => ctx.openFavorites() }, svgIcon("drag", 20), "Favorilerim")),
      buzlu ? null : h("div", { class: "kp-katlanir" }, yazmaBaslik, yazmaGovde)
    ].filter(Boolean));
    onizle();
    const seciliUc = uclar.querySelector(".kp-uc.secili");
    if (seciliUc) requestAnimationFrame(() => { uclar.scrollLeft = Math.max(0, seciliUc.offsetLeft - uclar.clientWidth / 2 + seciliUc.offsetWidth / 2); });
  };
  build();
  return shell("Kalem", ctx.close, body);
}

// ---------- Silgi Ayarları ----------

export function eraserPanel(ctx) {
  const e = { mode: "stroke", size: 12, onlyHighlighter: false, pressureSize: false, ...ctx.store.settings.eraser };
  const save = () => ctx.store.setSetting("eraser", { ...e });
  const body = h("div");
  const build = () => {
    const sizeValue = h("span", { class: "sp-value" }, e.size + " px");
    body.replaceChildren(

      optionCards([
        { key: "pixel", title: "Piksel", icon: "eraser", sub: "Tam hassasiyetle tek tek siler." },
        { key: "stroke", title: "Çizgi", icon: "wave", sub: "Dokunduğun çizgiyi tamamen siler." },
        { key: "area", title: "Alan", icon: "lassoRect", sub: "Çizdiğin kutunun içindeki her şeyi siler." }
      ], e.mode, (k) => { e.mode = k; save(); build(); }),
      grup(
        h("div", { class: "sp-kaydir" },
          h("div", { class: "sp-label-row" }, h("span", {}, "Boyut"), sizeValue),
          slider({ min: 4, max: 80, step: 1, value: e.size, label: "Silgi boyutu", onInput: (v) => { e.size = v; sizeValue.textContent = v + " px"; save(); } }),
          presetRow([6, 12, 20, 28, 48, 80], e.size, (v) => { e.size = v; save(); build(); }, (v) => String(v))),
        h("div", { class: "sp-satir" },
          h("div", { class: "sp-label-row" }, h("span", {}, "Ne silinsin")),
          h("div", { class: "sp-seg" }, ...[["hepsi", "Hepsi"], ["murekkep", "Mürekkep"], ["fosforlu", "Fosforlu"]].map(([k, ad]) => {
            const aktif = (e.hedef || (e.onlyHighlighter ? "fosforlu" : "hepsi")) === k;
            return h("button", { type: "button", class: aktif ? "active" : "", onTap: () => { e.hedef = k; e.onlyHighlighter = k === "fosforlu"; save(); build(); } }, ad);
          })),
          h("div", { class: "sp-row-sub" }, "Mürekkep: altını çizdiğin fosforluyu bozmadan yalnız yazıyı siler."))),
      grup(
        toggleRow("Basınca göre boyut", "Kalem baskısına göre silgi boyutunu ayarla.", !!e.pressureSize, (v) => { e.pressureSize = v; save(); }),
        toggleRow("Karalayarak sil", "Kalemle yazının üstünü zikzakla karalayınca silinir; silgiye geçmen gerekmez.", ctx.store.settings.karalamaSilme !== false, (v) => ctx.store.setSetting("karalamaSilme", v))),
      grup(h("button", { class: "sp-satir-dugme tehlike", type: "button", onTap: () => ctx.clearPage() }, svgIcon("trash", 20), "Sayfadaki her şeyi sil"))
    );
  };
  build();
  return shell("Silgi", ctx.close, body);
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

      h("div", { class: "sp-cards", style: { gridTemplateColumns: "repeat(3, 1fr)" } }, ...SHAPES.map(([key, title, icon]) =>
        h("button", { type: "button", class: "sp-option" + (current === key ? " active" : ""), onTap: () => { ctx.setTool({ tool: "shape", shape: key }); build(); } },
          h("div", { class: "sp-option-icon" }, svgIcon(icon, 30)), h("div", { class: "sp-option-title" }, title)))),
      grup(
        h("div", { class: "sp-kaydir" },
          h("div", { class: "sp-label-row" }, h("span", {}, "Kalınlık"), widthValue),
          kalinlikSecici(WIDTH_PRESETS, tool.width, (v) => { ctx.setTool({ width: v }); build(); }),
          slider({ min: 0.8, max: 12, step: 0.2, value: tool.width, label: "Kalınlık", onInput: (v) => { ctx.setTool({ width: v }, true); widthValue.textContent = mm(v); } })),
        colorRow("Renk", tool.color, () => ctx.openColor())),
      section("Cetvel"),
      grup(
        toggleRow("Cetveli Göster", "Düz çizgiler çizmek için cetvel kullanın.", ctx.ruler.active(), () => ctx.ruler.toggle()),
        toggleRow("Açı Göstergesi", null, s.rulerAngle !== false, (v) => { ctx.store.setSetting("rulerAngle", v); ctx.ruler.refresh(); }),
        toggleRow("Yapışma", "Şekiller hizalama kılavuzlarına yapışsın.", s.rulerSnap !== false, (v) => ctx.store.setSetting("rulerSnap", v)))
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
  return shell("Seçim", ctx.close, grup(
    row("move", "Taşı", "Seçilen içeriği taşı", () => toast("Kutuyu sürükle, köşeden büyüt, üstten döndür"), "active"),
    row("copy", "Kopyala", "Panoya kopyala", sel.copy),
    row("duplicate", "Çoğalt", "Seçimi çoğalt", sel.duplicate),
    row("scissors", "Kes", "Seçimi kes", sel.cut),
    row("pen", "Renk Değiştir", "Seçilen içeriğin rengini değiştir", () => ctx.openColor({ onPick: sel.recolor, title: "Seçim Rengi" })),
    row("layerUp", "Öne Al", "Bir katman öne getir", sel.front),
    row("layerDown", "Arkaya Gönder", "Bir katman arkaya gönder", sel.back),
    sel.duzenle ? row("text", "Yazıyı Düzenle", "Boyu, satırı ve aralığı eşitle", sel.duzenle) : null),
    grup(row("trash", "Seçimi Sil", null, sel.remove, "danger")));
}

// ---------- Yazıyı düzenle ----------

/**
 * Seçilen el yazısını aynı boya, düz satıra, eşit aralığa getirir (tanıma yok; bkz. duzenle.js).
 * ctx: { close, varsayilan: { boy, aralik }, satirSayisi, cizgi: null | { aralik, ofset }, onizle(ayar), uygula() }
 * Kaydırırken sayfada canlı önizlenir; Vazgeç ya da paneli kapatmak her şeyi geri koyar.
 */
export function yaziPanel(ctx) {
  const v = ctx.varsayilan;
  const ayar = { boy: v.boy, aralik: v.aralik, siddet: 1 };
  let otur = !!ctx.cizgi;
  const sigdi = h("div", { class: "sp-row-sub", style: { minHeight: "1em" } });
  const gonder = () => {
    // Önizleme kullanılan boyu döndürür: sayfaya sığmak için küçüldüyse söylenir.
    const kullanilan = ctx.onizle({ ...ayar, cizgi: otur ? ctx.cizgi : null });
    sigdi.textContent = kullanilan && kullanilan < ayar.boy * 0.99 ? `Sayfaya sığsın diye %${Math.round((kullanilan / v.boy) * 100)} oldu` : "";
  };
  const boyDeger = h("span", { class: "sp-value" }, "%100");
  const aralikDeger = h("span", { class: "sp-value" }, ayar.aralik.toFixed(1) + "×");
  const siddetDeger = h("span", { class: "sp-value" }, "%100");
  // Adım "any": %1'lik adım değeri yuvarlıyordu (%250 yerine %248, başlangıç 7.18 → 7.25).
  const boyMin = v.boy * 0.4, boyMax = v.boy * 2.5;
  const panel = shell({ title: "Yazıyı Düzenle", icon: "text" }, ctx.close,
    h("div", { class: "sp-row-sub" }, "Kelimeler aynı boya, düz satıra ve eşit aralığa gelir; harflerin şekli değişmez."),
    h("div", { class: "sp-label-row", style: { marginTop: "16px" } }, h("span", {}, "Yazı boyu"), boyDeger),
    slider({ min: boyMin, max: boyMax, step: "any", value: v.boy, label: "Yazı boyu",
      onInput: (x) => { ayar.boy = x; boyDeger.textContent = "%" + Math.round((x / v.boy) * 100); gonder(); } }),
    sigdi,
    ctx.satirSayisi > 1 ? h("div", { class: "sp-label-row", style: { marginTop: "16px" } }, h("span", {}, "Satır aralığı"), aralikDeger) : null,
    ctx.satirSayisi > 1 ? slider({ min: 1.2, max: 8, step: 0.1, value: ayar.aralik, label: "Satır aralığı",
      onInput: (x) => { ayar.aralik = x; aralikDeger.textContent = x.toFixed(1) + "×"; gonder(); } }) : null,
    ctx.cizgi ? toggleRow("Çizgiye otur", "Satırlar sayfa çizgisinin üstüne oturur.", otur, (x) => { otur = x; gonder(); }) : null,
    h("div", { class: "sp-label-row", style: { marginTop: "16px" } }, h("span", {}, "Düzeltme şiddeti"), siddetDeger),
    slider({ min: 0, max: 100, step: 5, value: 100, label: "Düzeltme şiddeti",
      onInput: (x) => { ayar.siddet = x / 100; siddetDeger.textContent = "%" + x; gonder(); } }),
    h("div", { class: "yazi-dugmeler", style: { display: "flex", gap: "10px", marginTop: "20px" } },
      h("button", { type: "button", class: "btn", style: { flex: "1" }, onTap: ctx.close }, "Vazgeç"),
      h("button", { type: "button", class: "btn primary", style: { flex: "1" }, onTap: ctx.uygula }, "Uygula")));
  // Açılır açılmaz varsayılanla önizle: kullanıcı sonucu hemen görür.
  gonder();
  return panel;
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
      const del = h("button", { class: "fav-cikar", type: "button", "aria-label": pen.name + ": favoriden çıkar", disabled: s.pens.length <= 1, onTap: (e) => { e.stopPropagation(); ctx.favoridenCikar(pen); build(); } }, h("span", { "aria-hidden": "true" }));
      row.append(del, illo, dot, text, edit, handle);
      row.addEventListener("pointerup", (e) => { if (e.target.closest(".fav-icon-btn") || e.target.closest(".fav-cikar") || e.target.closest(".fav-drag")) return; ctx.applyPen(pen); build(); });
      /**
       * Sürükleyerek sıralama.
       *
       * Eskiden bırakınca `store.movePen` çağrılıyordu ve öyle bir metot yoktu;
       * sürükleme görünüyor ama sıra hiç değişmiyordu. Ayrıca sadece tutulan
       * satır kayıyordu, nereye düşeceği belli olmuyordu: diğer satırlar da
       * kayarak yer açıyor artık.
       */
      handle.addEventListener("pointerdown", (e) => {
        e.preventDefault(); e.stopPropagation();
        try { handle.setPointerCapture(e.pointerId); } catch (_) { /* sentetik */ }
        const rows = [...list.children];
        const boxes = rows.map((r) => r.getBoundingClientRect());
        const step = rows.length > 1 ? boxes[1].top - boxes[0].top : boxes[0].height + 8;
        const startY = e.clientY;
        let target = index;
        row.classList.add("dragging");

        const place = (y) => {
          // İşaretçinin üstünde kalan satır sayısı = bırakılırsa gideceği sıra.
          let over = 0;
          boxes.forEach((b, i) => { if (i !== index && y > b.top + b.height / 2) over++; });
          target = Math.max(0, Math.min(rows.length - 1, over));
          row.style.transform = `translateY(${y - startY}px)`;
          rows.forEach((r, i) => {
            if (i === index) return;
            const shift = i > index && i <= target ? -step : i < index && i >= target ? step : 0;
            r.style.transform = shift ? `translateY(${shift}px)` : "";
          });
        };

        const move = (ev) => place(ev.clientY);
        const up = (ev) => {
          handle.removeEventListener("pointermove", move); handle.removeEventListener("pointerup", up); handle.removeEventListener("pointercancel", up);
          rows.forEach((r) => { r.style.transform = ""; });
          row.classList.remove("dragging");
          // Sistem hareketi iptal ettiyse (kaydırma, çağrı) sıra değişmemeli.
          if (ev.type !== "pointercancel" && target !== index) { ctx.store.reorderPen(pen.id, target); build(); ctx.rerender(); }
        };
        handle.addEventListener("pointermove", move); handle.addEventListener("pointerup", up); handle.addEventListener("pointercancel", up);
      });
      list.append(row);
    });
    body.replaceChildren(
      list,
      h("p", { class: "sp-dipnot" }, "Kırmızı eksiyle favoriden çıkar, sağdaki tutamakla sürükleyip sırala."),
      h("button", { class: "sp-fav-dugme", type: "button", onTap: () => { ctx.addFavorite(); build(); } }, svgIcon("plus", 20), "Şu anki kalemi ekle"));
  };
  const editMenu = (pen) => {
    const s = ctx.store.settings;
    actionSheet(pen.name, [
      { title: "Yeniden Adlandır", onSelect: () => promptDialog("Kalem adı", "Ad", pen.name, (name) => { ctx.store.updatePen(pen.id, { name }); build(); ctx.rerender(); }) },
      { title: "Şu Anki Ayarlarla Güncelle", onSelect: () => {
        const t = ctx.tool();
        const uc = t.tool === "shape" ? "pen" : t.tool;
        // Silgi, kement ve buzlu kalemin rengi/ucu favori olamaz.
        if (!UCLAR.some(([k]) => k === uc) || uc === "frosted") { toast("Önce bir kalem seç"); return; }
        ctx.store.updatePen(pen.id, { tool: uc, color: t.color, width: t.width, alpha: t.alpha == null ? 1 : t.alpha, ...(uc === "desen" ? { desen: t.desen || "kalp" } : {}) });
        build(); ctx.rerender();
      } },
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
  let cikarmaModu = false;
  const favDuzenle = h("button", { class: "sp-metin-dugme", type: "button", onTap: () => { cikarmaModu = !cikarmaModu; paint(); } }, "Düzenle");
  const favKaydet = h("button", { class: "sp-fav-dugme", type: "button", onTap: () => {
    const hx = hex();
    if (ctx.store.settings.palette.some((c) => c.toUpperCase() === hx.toUpperCase())) {
      if (ctx.store.settings.palette.length <= 1) { toast("En az bir favori renk kalmalı"); return; }
      ctx.store.removePaletteColor(hx); toast("Favori renklerden çıkarıldı");
    } else { ctx.store.addPaletteColor(hx); toast("Favori renklere eklendi"); }
    paint();
  } }, svgIcon("star", 20), h("span", {}, "Favori renklere ekle"));
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
    if (s.palette.length <= 1) cikarmaModu = false;
    favRow.classList.toggle("cikarma", cikarmaModu);
    favDuzenle.textContent = cikarmaModu ? "Bitti" : "Düzenle";
    favDuzenle.hidden = s.palette.length <= 1;
    favRow.replaceChildren(...[
      ...s.palette.map((c) => {
        if (!cikarmaModu) return swatch(c, hx);
        return h("button", { class: "cp-swatch cikar", type: "button", style: { "--c": c }, "aria-label": `${colorName(c)} (${c}) favorilerden çıkar`,
          onTap: () => { ctx.store.removePaletteColor(c); ctx.rerender(); paint(); } });
      }),
      cikarmaModu ? null : h("button", { class: "cp-swatch add", type: "button", "aria-label": "Favori renklere ekle", onTap: () => { ctx.store.addPaletteColor(hx); paint(); } }, svgIcon("plus", 16))].filter(Boolean));
    const favoride = s.palette.some((c) => c.toUpperCase() === hx.toUpperCase());
    favKaydet.classList.toggle("dolu", favoride);
    favKaydet.lastChild.textContent = favoride ? "Favorilerden çıkar" : "Favori renklere ekle";
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
    h("div", { class: "sp-section-row" }, h("span", { class: "sp-section" }, "Favori Renkler"), favDuzenle), favRow,
    section("Son Kullanılan Renkler"), recentRow,
    favKaydet);
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
    tabs.replaceChildren(...[["postit", "Post-it"], ["benim", "Benim"], ["sticker", "Sticker"], ["marks", "İşaretler"], ["recent", "Sık Kullanılanlar"]].map(([k, t]) =>
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
    } else if (tab === "benim") {
      const liste = ctx.store.settings.myStickers || [];
      const izgara = h("div", { class: "st-grid" }, ...liste.map((giris) => {
        const resim = h("img", { class: "st-benim", alt: "", draggable: "false" });
        ctx.store.assetURL(giris.asset).then((url) => { if (url) resim.src = url; });
        const hucre = h("button", { class: "st-cell", type: "button", "aria-label": "Çıkartmam" }, resim);
        pressable(hucre, {
          onTap: () => ctx.putMySticker(giris),
          onLong: () => actionSheet("Çıkartma", [{ title: "Kitaplıktan kaldır", destructive: true, onSelect: () => { ctx.store.removeMySticker(giris.asset); build(); } }])
        });
        return hucre;
      }));
      body.replaceChildren(
        h("button", { class: "sp-primary-btn", type: "button", onTap: () => ctx.makeSticker() }, svgIcon("scissors", 18), "Fotoğraftan çıkartma yap"),
        h("p", { class: "sp-desc" }, liste.length
          ? "Dokununca sayfaya eklenir; basılı tutunca kitaplıktan kaldırırsın."
          : "Yaptığın çıkartmalar burada birikir, her defterde kullanabilirsin. Sayfadaki bir fotoğrafa dokunup \"Çıkartma yap\" da diyebilirsin."),
        izgara);
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

function navRow(icon, title, onTap, sub, renk) {
  return h("button", { class: "sp-nav-row", type: "button", onTap },
    h("span", { class: "sp-nav-icon", style: { "--s": renk || "#172a45" } }, svgIcon(icon, 20)),
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
  // Üstte ekleme karoları, altta son eklenenler ve sayfadaki nesnelerle yapılacaklar.
  // (Nesneleri Düzenle 13 Kas'ta Seçim'e taşınmıştı; 23 Kas: "nereye gitti" → burada da duruyor.)
  const duzenleniyor = ctx.isEditingObjects();
  return shell("Fotoğraf ve Dosya", ctx.close,
    h("div", { class: "sp-karolar" },
      karo("photos", "Fotoğraflar", "#2f7cf6", () => ctx.importPhoto()),
      karo("camera", "Kamera", "#5b6270", () => ctx.capturePhoto()),
      karo("scan", "Belge Tara", "#e79a1c", () => ctx.capturePhoto(true)),
      karo("folder", "Dosyalar", "#1f9d8b", () => ctx.importFile())),
    h("p", { class: "sp-dipnot" }, "Dosyalar'dan seçilen PDF, sayfa olarak eklenir."),
    h("div", { class: "sp-section" }, "Sayfadakiler"),
    h("div", { class: "sp-nav" },
      navRow("objects", duzenleniyor ? "Düzenlemeyi Bitir" : "Nesneleri Düzenle", () => ctx.toggleEditing(),
        duzenleniyor ? "Fotoğraf ve nesneler yerine otursun" : "Taşı, boyutlandır, döndür, sil. Fotoğrafa basılı tutmak da açar", "#172a45"),
      navRow("scissors", "Fotoğraftan Çıkartma Yap", () => ctx.makeSticker(), "Çevresini çiz ya da şekil seç", "#f2649a"),
      ctx.hasClipboard() ? navRow("copy", "Yapıştır", () => ctx.paste(), "Kopyaladığın yazı ya da nesne", "#34a853") : null),
    h("div", { class: "sp-section-row" }, h("span", { class: "sp-section" }, "Son Eklenenler"), recent.length ? h("span", { class: "sp-row-sub" }, `${recent.length} öğe`) : null),
    recent.length ? grid : h("p", { class: "sp-dipnot" }, "Eklediğin fotoğraf ve dosyalar burada birikir."));
}

export function textPanel(ctx) {
  const kayit = ctx.isRecording();
  const dinliyor = ctx.isListening();
  return shell("Metin ve Ses", ctx.close,
    h("div", { class: "sp-karolar" },
      karo("textTool", "Yazı Kutusu", "#172a45", () => ctx.addText(false)),
      karo("check", "Yapılacaklar", "#34a853", () => ctx.addText(true)),
      karo("lassoRect", "Onay Kutusu", "#e79a1c", () => ctx.addCheckBox()),
      karo("translate", "Çeviri", "#2f7cf6", () => ctx.openTranslate())),
    h("div", { class: "sp-section" }, "Ses"),
    h("div", { class: "sp-nav" },
      Object.assign(navRow("audio", kayit ? "Ses Kaydını Durdur" : "Sesli Not Kaydet", () => ctx.toggleAudio(), kayit ? "Kayıt sürüyor; dokun, sayfaya eklensin" : "Sayfaya oynatılabilir not düşer", "#e5484d"), { className: "sp-nav-row" + (kayit ? " kayitta" : "") }),
      navRow("mic", dinliyor ? "Sesle Yazmayı Bitir" : "Sesle Yaz", () => ctx.sesleYaz(), "Konuş, yazı kutusuna yazılsın", "#7a5af0")));
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
    // Renk çarkı: sistemin renk seçicisi açılır, sürüklerken sayfa anında boyanır.
    const ozelDeger = h("input", { type: "color", class: "pc-input", value: current.startsWith("#") ? current : "#F2F0E6",
      onInput: (e) => ctx.setPageColor(e.target.value, all),
      onChange: (e) => { ctx.setPageColor(e.target.value, all); build(); } });
    const ozel = h("label", { class: "pc-cell pc-wheel" + (PRESETS.every(([hex]) => hex.toUpperCase() !== current) ? " active" : ""), "aria-label": "Renk seç" },
      h("span", { class: "pc-chip pc-chip-wheel" }), h("span", { class: "pc-name" }, "Renk seç"), ozelDeger);
    const kapsam = h("div", { class: "sp-seg", style: { marginBottom: "10px" } },
      h("button", { type: "button", class: all ? "" : "active", onTap: () => { all = false; build(); } }, "Bu sayfa"),
      h("button", { type: "button", class: all ? "active" : "", onTap: () => { all = true; build(); } }, "Tüm sayfalar"));
    body.replaceChildren(
      kapsam,
      h("p", { class: "sp-desc" }, all ? "Seçtiğin renk defterdeki bütün sayfalara uygulanır." : "Sayfanın kağıt rengini seç. Çizgi ve kareler renge göre uyum sağlar."),
      h("div", { class: "sp-section" }, "Hazır tonlar"),
      h("div", { class: "pc-grid" }, ...PRESETS.map(([hex, name]) => cell(hex, name)), ozel),
      h("button", { class: "sp-outline-btn", type: "button", onTap: () => { ctx.setPageColor(null, all); build(); } }, svgIcon("undoTool", 18), "Varsayılana dön")
    );
  };
  build();
  return shell({ title: "Sayfa Rengi", icon: "page" }, ctx.close, body);
}
