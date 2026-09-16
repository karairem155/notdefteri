// Sayfa Ekle (11-SayfaEkle.png): Şablonlarım / Desenler / PDF'ten sekmeleri, "Ekleneceği yer" seçimi.
// Ayrıca tek başına şablon seçici (Sayfalar ekranındaki "Şablonu değiştir").
import { store, PAPER_STYLES, PAGE_SIZES, uid } from "./store.js";
import { h, svgIcon, openModal, closeModal, actionSheet, promptDialog, toast, pickFile } from "./ui.js";
import { drawPaper, pdfPageSizes } from "./paper.js";

/** Görseli küçültüp (en uzun kenar maxDim) blob olarak verir. */
export async function shrinkImage(file, maxDim = 2000, quality = 0.9) {
  const bitmap = await createImageBitmap(file);
  const longest = Math.max(bitmap.width, bitmap.height);
  const scale = longest > maxDim ? maxDim / longest : 1;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const hasAlpha = file.type === "image/png" || file.type === "image/webp";
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, hasAlpha ? "image/png" : "image/jpeg", quality));
  return { blob, width: canvas.width, height: canvas.height };
}

export async function importTemplateFromFile() {
  const file = await pickFile("file-image");
  if (!file) return null;
  try {
    const { blob } = await shrinkImage(file);
    const asset = await store.importAsset(blob, file.name);
    const name = (file.name || "").replace(/\.[^.]+$/, "") || `Şablon ${store.settings.templates.length + 1}`;
    const entry = { id: uid(), name, asset };
    store.setSetting("templates", [...store.settings.templates, entry]);
    return entry;
  } catch (error) {
    toast("Görsel kaydedilemedi: " + error.message);
    return null;
  }
}

function templateCell(title, selected, preview, onSelect, onLong) {
  const cell = h("div", { class: "template-cell" + (selected ? " selected" : ""), role: "button", tabindex: "0", onTap: onSelect },
    h("div", { class: "preview" }, preview), h("div", { class: "name" }, title));
  if (onLong) cell.addEventListener("contextmenu", (e) => { e.preventDefault(); onLong(); });
  return cell;
}

function builtinPreview(style) {
  const canvas = document.createElement("canvas");
  drawPaper(canvas, style, 150, 212);
  return canvas;
}

function customPreview(asset) {
  const image = h("img", { alt: "", draggable: "false" });
  store.assetURL(asset).then((url) => { if (url) image.src = url; });
  return image;
}

/**
 * Şablon ızgarasını kurar. `state.selection` "builtin:x" | "custom:id".
 */
function buildGrid(container, tab, state, rerender) {
  const grid = h("div", { class: "template-grid" });
  if (tab === "mine") {
    grid.append(h("div", { class: "template-cell add", role: "button", tabindex: "0", onTap: async () => {
      const entry = await importTemplateFromFile();
      if (entry) { state.selection = "custom:" + entry.id; rerender(); }
    } }, h("div", { class: "preview" }, svgIcon("plus", 32)), h("div", { class: "name" }, "Şablon Ekle")));
    for (const entry of store.settings.templates) {
      const key = "custom:" + entry.id;
      grid.append(templateCell(entry.name, state.selection === key, customPreview(entry.asset), () => { state.selection = key; rerender(); }, () => templateMenu(entry, state, rerender)));
    }
  } else {
    for (const [style, title] of Object.entries(PAPER_STYLES)) {
      const key = "builtin:" + style;
      grid.append(templateCell(title, state.selection === key, builtinPreview(style), () => { state.selection = key; rerender(); }));
    }
  }
  container.replaceChildren(grid);
}

function templateMenu(entry, state, rerender) {
  actionSheet(entry.name, [
    { title: "Yeniden Adlandır", onSelect: () => promptDialog("Şablonu yeniden adlandır", "Şablon adı", entry.name, (name) => {
      store.setSetting("templates", store.settings.templates.map((t) => (t.id === entry.id ? { ...t, name } : t)));
      rerender();
    }) },
    { title: "Sil", destructive: true, onSelect: async () => {
      store.setSetting("templates", store.settings.templates.filter((t) => t.id !== entry.id));
      if (state.selection === "custom:" + entry.id) state.selection = null;
      await store.removeUnreferencedAssets();
      rerender();
    } }
  ]);
}

export function openAddPageSheet(notebookId, currentIndex, onAdded) {
  const notebook = store.notebook(notebookId);
  const pageCount = Math.max(notebook.pages.length, 1);
  const current = notebook.pages[currentIndex];
  const fallback = current ? (current.templateAsset ? ("custom:" + (store.settings.templates.find((t) => t.asset === current.templateAsset) || {}).id) : "builtin:" + current.paper) : "builtin:ruled";
  const state = { selection: store.initialTemplate(fallback), insertIndex: Math.min(currentIndex + 1, pageCount) };
  let tab = state.selection.startsWith("custom:") || store.settings.templates.length ? "mine" : "patterns";

  const gridHost = h("div");
  const note = h("div", { class: "note" });
  const tabs = h("div", { class: "segmented" });
  const addButton = h("button", { class: "btn ghost", type: "button", onTap: add }, "Ekle");

  function rerender() {
    tabs.replaceChildren(
      ...[["mine", "Şablonlarım"], ["patterns", "Desenler"], ["pdf", "PDF'ten"]].map(([key, title]) =>
        h("button", { type: "button", class: tab === key ? "active" : "", onTap: () => { tab = key; rerender(); } }, title))
    );
    addButton.hidden = tab === "pdf";
    addButton.disabled = !state.selection;
    if (tab === "pdf") {
      gridHost.replaceChildren(h("div", {},
        h("button", { class: "btn primary", type: "button", onTap: importPDF }, "PDF Seç"),
        h("div", { class: "note" }, "Seçtiğin PDF'in bütün sayfaları \"Ekleneceği yer\"den başlayarak defterine eklenir. PDF sayfası arkada durur, el yazın ayrı katmanda üstüne yazılır. Her sayfa kendi oranını korur.")
      ));
      note.textContent = "";
    } else {
      buildGrid(gridHost, tab, state, rerender);
      note.textContent = `Fotoğraflar veya Dosyalar'dan eklediğin her görsel burada şablon olarak kalır; her sayfaya ayrı şablon seçebilirsin. Yeni sayfa boyutu: ${PAGE_SIZES[store.settings.pageSize].title} (Ayarlar'dan değişir).`;
    }
  }

  const positionSelect = h("select", { class: "select", "aria-label": "Ekleneceği yer", onChange: (e) => { state.insertIndex = Number(e.target.value); } },
    h("option", { value: "0" }, "Başa"),
    ...Array.from({ length: pageCount }, (_, i) => h("option", { value: String(i + 1) }, `${i + 1}. sayfadan sonra`))
  );
  positionSelect.value = String(state.insertIndex);

  function add() {
    if (!state.selection) return;
    const id = store.addPage(notebookId, state.insertIndex, state.selection);
    closeModal();
    if (id && onAdded) onAdded(id);
  }

  async function importPDF() {
    const file = await pickFile("file-pdf");
    if (!file) return;
    toast("PDF açılıyor…");
    try {
      const asset = await store.importAsset(file, file.name);
      const sizes = await pdfPageSizes(asset);
      if (!sizes.length) { toast("PDF açılamadı ya da boş."); await store.removeAsset(asset); return; }
      const id = store.addPDFPages(notebookId, state.insertIndex, asset, sizes);
      closeModal();
      toast(`${sizes.length} PDF sayfası eklendi`);
      if (id && onAdded) onAdded(id);
    } catch (error) {
      toast("PDF eklenemedi: " + error.message);
    }
  }

  rerender();
  openModal(h("div", { class: "sheet-page" },
    h("div", { class: "sheet-head" },
      h("button", { class: "btn ghost", type: "button", onTap: closeModal }, "İptal"),
      h("span", {}, "Sayfa Ekle"),
      addButton),
    h("div", { class: "sheet-body" },
      h("div", { class: "sheet-toolbar" }, tabs, h("div", { style: { display: "flex", alignItems: "center", gap: "10px", color: "var(--muted)" } }, "Ekleneceği yer", positionSelect)),
      gridHost,
      note)
  ), { wide: true });
}

/** Yalnızca şablon seçimi: Sayfalar ekranı ve Ayarlar için. */
export function openTemplatePicker(onSelect, initial = null) {
  const state = { selection: initial };
  let tab = store.settings.templates.length ? "mine" : "patterns";
  const gridHost = h("div");
  const tabs = h("div", { class: "segmented" });
  function rerender() {
    tabs.replaceChildren(
      ...[["mine", "Şablonlarım"], ["patterns", "Desenler"]].map(([key, title]) =>
        h("button", { type: "button", class: tab === key ? "active" : "", onTap: () => { tab = key; rerender(); } }, title))
    );
    buildGrid(gridHost, tab, state, rerender);
  }
  rerender();
  openModal(h("div", { class: "sheet-page" },
    h("div", { class: "sheet-head" },
      h("button", { class: "btn ghost", type: "button", onTap: closeModal }, "İptal"),
      h("span", {}, "Şablon Seç"),
      h("button", { class: "btn ghost", type: "button", onTap: () => { if (state.selection) { closeModal(); onSelect(state.selection); } } }, "Seç")),
    h("div", { class: "sheet-body" }, h("div", { class: "sheet-toolbar" }, tabs), gridHost)
  ), { wide: true });
}
