// Ayarlar (13-Ayarlar.png): şablonlarım, kapak desenleri, renk paleti, varsayılan kalem, sayfa, yedekleme.
import { store, COVER_PRESETS, COVER_TITLES, PAGE_SIZES, PAPER_STYLES, TOOLS } from "./store.js";
import { h, svgIcon, actionSheet, promptDialog, toast, pickFile, formatPt } from "./ui.js";
import { coverElement, sameCover } from "./covers.js";
import { importTemplateFromFile, shrinkImage, openTemplatePicker } from "./addpage.js";
import { penIllustration } from "./editor.js";
import { exportBackup, importBackup } from "./backup.js";
import { navigate } from "./app.js";

export function renderSettings(root) {
  const screen = h("div", { class: "screen screen-light" });
  const body = h("div", { class: "settings-body" });
  screen.append(
    h("div", { class: "topbar" },
      h("div", { class: "topbar-side" }, h("button", { class: "back-btn", type: "button", onTap: () => navigate("#/") }, svgIcon("back", 20), "Defterlerim")),
      h("div", { class: "topbar-title" }, "Ayarlar"),
      h("div", { class: "topbar-side right" })),
    body
  );
  root.append(screen);

  function section(title, ...content) {
    return h("div", { class: "settings-section" }, h("h2", {}, title), ...content);
  }

  function render() {
    const s = store.settings;
    body.replaceChildren(h("div", { class: "settings-columns" },
      h("div", {},
        section("ŞABLONLARIM", h("div", { class: "card" }, templatesRow(), h("div", { class: "note" }, "Fotoğraflar veya Dosyalar'dan eklediğin her görsel buraya şablon olarak düşer. Birine dokununca yeni sayfalar hep onunla açılır; tekrar dokununca \"son kullanılan\" kuralına dönülür."))),
        section("KAPAK DESENLERİ", h("div", { class: "card" }, coversRow(), h("div", { class: "note" }, "Yeni defter açarken bu desenlerden seçersin. Seçili olan yeni defterlerin kapağıdır."))),
        section("YEDEKLEME", h("div", { class: "card" },
          h("div", { class: "backup-actions" },
            h("button", { class: "btn primary", type: "button", onTap: exportBackup }, "Yedekle"),
            h("button", { class: "btn", type: "button", onTap: importBackup }, "Yedekten Geri Yükle")),
          h("div", { class: "note" }, "Bütün defterler, ayarlar ve görseller tek bir dosyaya yazılır; Dosyalar'a ya da iCloud'a kaydet. Safari yer açmak için ana ekran uygulamasının verisini silebilir, bu yüzden ara sıra yedek al.")))
      ),
      h("div", {},
        section("RENK PALETİ", h("div", { class: "card" }, paletteRow(), h("div", { class: "note" }, "Alt bardaki renkler: kullandığın renkler kendiliğinden başa geçer (en çok 12). Bir renge uzun basınca değiştirir, taşır ya da çıkarırsın."))),
        section("VARSAYILAN KALEM", h("div", { class: "card" }, pensRow(), thicknessRow(), h("div", { class: "note" }, "Yeni sayfa açınca bu kalem seçili gelir. Kalınlık, seçili varsayılan kalemin kalınlığını değiştirir."))),
        section("SAYFA", h("div", { class: "settings-rows" },
          row("Varsayılan sayfa boyutu", select(Object.entries(PAGE_SIZES).map(([k, v]) => [k, v.title]), s.pageSize, (v) => store.setSetting("pageSize", v))),
          row("Varsayılan görünüm", select([["single", "Tek sayfa"], ["spread", "Çift sayfa"]], s.spreadMode ? "spread" : "single", (v) => store.setSetting("spreadMode", v === "spread"))),
          row("Defter açılınca", select([["page", "Doğrudan sayfa"], ["fan", "Sayfa yelpazesi"]], s.openMode || "page", (v) => { store.setSetting("openModeByUser", true); store.setSetting("openMode", v); })),
          row("Yeni sayfa şablonu", h("button", { class: "btn small", type: "button", style: { color: "var(--muted)" }, onTap: newPageTemplateMenu }, newPageTemplateTitle(), " ", svgIcon("forward", 14))),
          row("Basınca duyarlı kalınlık", toggle(s.pressureWidth, (v) => store.setSetting("pressureWidth", v))),
          row("Parmak ne yapsın", select([["navigate", "Sayfa çevirir, kaydırır"], ["draw", "Çizer"], ["erase", "Siler"]], s.fingerAction, (v) => store.setSetting("fingerAction", v))),
          row("Sabit tutunca şekle dönüştür", toggle(s.shapeRecognition !== false, (v) => store.setSetting("shapeRecognition", v))),
          row("Şekil bekleme süresi", select([["0", "Devre dışı"], ["350", "Kısa"], ["600", "Varsayılan"], ["950", "Uzun"]], String(s.shapeRecognition === false ? 0 : (s.shapeHoldMs == null ? 600 : s.shapeHoldMs)), (v) => { store.setSetting("shapeHoldMs", Number(v)); store.setSetting("shapeRecognition", Number(v) > 0); })),
          row("Sayfa çevirme sesi", toggle(s.flipSound !== false, (v) => store.setSetting("flipSound", v))),
          row("Stabilizatör", select([["0", "Temel"], ["1", "Yumuşak"], ["2", "İpek"], ["3", "Akıcı"]], String(s.smoothing == null ? 2 : s.smoothing), (v) => store.setSetting("smoothing", Number(v))))
        ))
      )
    ));
  }

  function row(title, control) {
    return h("div", { class: "settings-row" }, h("span", {}, title), control);
  }

  function select(options, value, onChange) {
    const el = h("select", { class: "select", onChange: (e) => onChange(e.target.value) }, ...options.map(([v, t]) => h("option", { value: v }, t)));
    el.value = value;
    return el;
  }

  function toggle(on, onChange) {
    const el = h("button", { class: "toggle" + (on ? " on" : ""), type: "button", role: "switch", "aria-checked": String(on), onTap: () => { on = !on; el.classList.toggle("on", on); el.setAttribute("aria-checked", String(on)); onChange(on); } });
    return el;
  }

  function templatesRow() {
    const scroll = h("div", { class: "hscroll" });
    for (const entry of store.settings.templates) {
      const key = "custom:" + entry.id;
      const selected = store.settings.newPageTemplate === key;
      const image = h("img", { alt: "", draggable: "false" });
      store.assetURL(entry.asset).then((url) => { if (url) image.src = url; });
      const cell = h("div", { class: "mini-template" + (selected ? " selected" : ""), role: "button", tabindex: "0",
        onTap: () => { store.setSetting("newPageTemplate", selected ? null : key); render(); } },
        h("div", { class: "preview" }, image), h("div", { class: "name" }, entry.name));
      cell.addEventListener("contextmenu", (e) => { e.preventDefault(); templateMenu(entry); });
      scroll.append(cell);
    }
    scroll.append(h("div", { class: "mini-template add", role: "button", tabindex: "0", onTap: async () => {
      const entry = await importTemplateFromFile();
      if (entry) { store.setSetting("newPageTemplate", "custom:" + entry.id); render(); }
    } }, h("div", { class: "preview" }, svgIcon("plus", 28)), h("div", { class: "name" }, "Ekle")));
    return scroll;
  }

  function templateMenu(entry) {
    actionSheet(entry.name, [
      { title: "Yeniden Adlandır", onSelect: () => promptDialog("Şablonu yeniden adlandır", "Şablon adı", entry.name, (name) => { store.setSetting("templates", store.settings.templates.map((t) => (t.id === entry.id ? { ...t, name } : t))); render(); }) },
      { title: "Sil", destructive: true, onSelect: async () => {
        store.setSetting("templates", store.settings.templates.filter((t) => t.id !== entry.id));
        if (store.settings.newPageTemplate === "custom:" + entry.id) store.setSetting("newPageTemplate", null);
        await store.removeUnreferencedAssets();
        render();
      } }
    ]);
  }

  function coversRow() {
    const scroll = h("div", { class: "hscroll" });
    const options = [...COVER_PRESETS, ...store.settings.customCovers.map((asset) => ({ pattern: "plain", color: "#DDDDDD", imageAsset: asset }))];
    for (const option of options) {
      const cell = h("div", { class: "mini-cover" + (sameCover(option, store.settings.defaultCover) ? " selected" : ""), role: "button", tabindex: "0",
        "aria-label": option.imageAsset ? "Kendi kapağım" : COVER_TITLES[option.pattern],
        onTap: () => { store.setSetting("defaultCover", option); render(); } }, coverElement(option));
      if (option.imageAsset) {
        cell.addEventListener("contextmenu", (e) => { e.preventDefault(); actionSheet("Kendi kapağım", [{ title: "Sil", destructive: true, onSelect: async () => {
          store.setSetting("customCovers", store.settings.customCovers.filter((a) => a !== option.imageAsset));
          if (store.settings.defaultCover.imageAsset === option.imageAsset) store.setSetting("defaultCover", COVER_PRESETS[5]);
          await store.removeUnreferencedAssets();
          render();
        } }]); });
      }
      scroll.append(cell);
    }
    scroll.append(h("div", { class: "mini-template add", style: { width: "112px" }, role: "button", tabindex: "0", onTap: async () => {
      const file = await pickFile("file-image");
      if (!file) return;
      try {
        const { blob } = await shrinkImage(file, 1200);
        const asset = await store.importAsset(blob, file.name);
        store.setSetting("customCovers", [...store.settings.customCovers, asset]);
        store.setSetting("defaultCover", { pattern: "plain", color: "#DDDDDD", imageAsset: asset });
        render();
      } catch (error) { toast("Kapak eklenemedi: " + error.message); }
    } }, h("div", { class: "preview", style: { width: "112px", height: "150px" } }, svgIcon("plus", 28)), h("div", { class: "name" }, "Ekle")));
    return scroll;
  }

  function paletteRow() {
    const wrap = h("div", { class: "settings-palette" });
    for (const hex of store.settings.palette) {
      const sw = h("button", { class: "swatch", type: "button", style: { "--c": hex }, "aria-label": "Renk " + hex });
      sw.addEventListener("contextmenu", (e) => { e.preventDefault(); actionSheet(hex, [{ title: "Paletten Çıkar", destructive: true, disabled: store.settings.palette.length <= 1, onSelect: () => { store.removePaletteColor(hex); render(); } }]); });
      wrap.append(sw);
    }
    const input = h("input", { type: "color", value: "#5d58d6", "aria-label": "Palete renk ekle", onChange: (e) => { store.addPaletteColor(e.target.value); render(); } });
    wrap.append(h("div", { class: "color-input" }, input));
    return wrap;
  }

  function pensRow() {
    const scroll = h("div", { class: "hscroll", style: { alignItems: "flex-end" } });
    for (const pen of store.settings.pens) {
      const selected = pen.id === store.defaultPen.id;
      scroll.append(h("div", { class: "pen-pick" + (selected ? " selected" : ""), role: "button", tabindex: "0", onTap: () => { store.setSetting("defaultPenId", pen.id); render(); } },
        penIllustration(pen), h("div", { class: "name" }, pen.name)));
    }
    return scroll;
  }

  function thicknessRow() {
    const pen = store.defaultPen;
    if (!pen) return null;
    const value = h("span", { class: "value" }, formatPt(pen.width) + " pt");
    const range = h("input", { type: "range", min: "1", max: "24", step: "0.5", value: String(pen.width), style: { flex: "1", accentColor: "var(--accent)" },
      onInput: (e) => { const w = Number(e.target.value); value.textContent = formatPt(w) + " pt"; store.updatePen(pen.id, { width: w }); } });
    return h("div", { class: "panel-row", style: { color: "var(--muted)" } }, h("label", {}, "Kalınlık"), range, value);
  }

  function newPageTemplateTitle() {
    const t = store.settings.newPageTemplate;
    if (!t) return "Son kullanılan";
    const [kind, value] = t.split(":");
    if (kind === "builtin") return PAPER_STYLES[value] || "Son kullanılan";
    const entry = store.template(value);
    return entry ? entry.name : "Son kullanılan";
  }

  function newPageTemplateMenu() {
    actionSheet("Yeni sayfa şablonu", [
      { title: "Son kullanılan", onSelect: () => { store.setSetting("newPageTemplate", null); render(); } },
      { title: "Şablon seç…", onSelect: () => openTemplatePicker((template) => { store.setSetting("newPageTemplate", template); render(); }, store.settings.newPageTemplate) }
    ]);
  }

  render();
  void TOOLS;
  return { destroy() {} };
}
