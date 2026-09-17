// Editör (05-NotEditoru.png, 04-CiftSayfa.png). Lacivert masa, krem kağıt, altta koyu tezgah.
// Sayfa katmanları (alttan üste): şablon → nesneler (fotoğraf/çıkartma/post-it) → çizim → örtüler.
// Kipler: çizim / buzlu kalem (örtü katmanı çizgiyi buzlu şerit yapar) / nesne düzenleme.
import { store, TOOLS, uid } from "./store.js";
import { h, svgIcon, iconButton, openModal, closeModal, actionSheet, promptDialog, confirmDialog, toast, pickFile, formatPt, pressable } from "./ui.js";
import { renderBackground, paintPaper, drawImageURL, pdfPageImage, pdfTextLines, pdfTextItems, PAPER_COLOR } from "./paper.js";
import { InkCanvas, drawStroke, renderStrokesToDataURL, orderForDrawing } from "./ink.js";
import { openAddPageSheet, shrinkImage } from "./addpage.js";
import { createFlip } from "./flip.js";
import { attachEditorGestures } from "./gestures.js";
import { penPanel, eraserPanel, shapesPanel, selectionPanel, favoritesPanel, colorPanel } from "./panels.js";
import { navigate } from "./app.js";

const SVG_NS = "http://www.w3.org/2000/svg";

// Uygulama içi pano: sayfalar ve defterler arasında çizgi/nesne taşımak için (oturum boyunca).
const clipboard = { strokes: [], objects: [] };

export const TEXT_FONTS = [
  ["-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", "Sistem"],
  ["'Bradley Hand', 'Segoe Script', cursive", "El yazısı"],
  ["'Noteworthy', 'Comic Sans MS', cursive", "Defter"],
  ["'Marker Felt', 'Segoe Print', fantasy", "Keçeli"],
  ["'Snell Roundhand', 'Brush Script MT', cursive", "Süslü"],
  ["'Chalkduster', 'Segoe Print', fantasy", "Tebeşir"],
  ["Georgia, 'Times New Roman', serif", "Kitap"]
];

const LANGS = [["tr", "Türkçe"], ["en", "İngilizce"], ["de", "Almanca"], ["fr", "Fransızca"], ["es", "İspanyolca"], ["it", "İtalyanca"], ["ar", "Arapça"], ["ru", "Rusça"], ["ja", "Japonca"], ["ko", "Korece"], ["zh-CN", "Çince"]];

/** Metni Google Çeviri'de açar (internet gerekir; cihazda çevrimdışı çeviri motoru yok). */
export function openTranslate(text, target) {
  const clean = (text || "").trim();
  if (!clean) { toast("Çevrilecek metin yok."); return; }
  const tl = target || localStorage.getItem("notdefteri.translateTo") || "tr";
  const url = `https://translate.google.com/?sl=auto&tl=${encodeURIComponent(tl)}&op=translate&text=${encodeURIComponent(clean.slice(0, 4000))}`;
  window.open(url, "_blank", "noopener");
}

/** Çeviri penceresi: yaz (klavye ya da Apple Pencil ile Scribble), dili seç, çevir. */
export function openTranslateDialog(initial = "") {
  const area = h("textarea", { class: "text-input", rows: "5", placeholder: "Çevrilecek metni buraya yaz (Apple Pencil ile de yazabilirsin)", style: { fontFamily: "'Bradley Hand', 'Segoe Script', cursive", fontSize: "20px", resize: "vertical" } }, initial);
  const select = h("select", { class: "select", "aria-label": "Hedef dil" }, ...LANGS.map(([code, name]) => h("option", { value: code }, name)));
  select.value = localStorage.getItem("notdefteri.translateTo") || "tr";
  openModal(h("div", { class: "dialog", style: { width: "min(520px, 100%)" } },
    h("h3", {}, "Çeviri"),
    h("p", {}, "Metin, Google Çeviri'de yeni sekmede açılır. Sayfadaki el yazısını çevirmek için buraya kalemle yeniden yaz; iPad onu metne çevirir."),
    area,
    h("div", { class: "panel-row", style: { color: "var(--muted)" } }, h("label", {}, "Hedef dil"), select),
    h("div", { class: "dialog-buttons" },
      h("button", { class: "btn", type: "button", onTap: closeModal }, "Kapat"),
      h("button", { class: "btn primary", type: "button", onTap: () => { localStorage.setItem("notdefteri.translateTo", select.value); openTranslate(area.value, select.value); } }, "Çevir"))
  ));
  setTimeout(() => area.focus(), 50);
}

/** Bu oturumda açılmış defterler: hızlı geçiş için (Paper'daki gibi birden çok defter). */
function openNotebooks() {
  try { return JSON.parse(sessionStorage.getItem("notdefteri.open") || "[]"); } catch (_) { return []; }
}
function rememberOpen(notebookId, pageId) {
  const list = openNotebooks().filter((o) => o.id !== notebookId);
  list.unshift({ id: notebookId, pageId });
  sessionStorage.setItem("notdefteri.open", JSON.stringify(list.slice(0, 8)));
}

/** Tezgahtaki kalem çizimi: üstte uç, altta gövde; araç türüne göre biçim değişir. */
export function penIllustration(pen) {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 46 104");
  svg.setAttribute("width", "46");
  svg.setAttribute("height", "104");
  svg.setAttribute("aria-hidden", "true");
  const isPencil = pen.tool === "pencil";
  const isHighlighter = pen.tool === "highlighter";
  const bodyW = isHighlighter ? 40 : 30;
  const tipW = isPencil ? 22 : isHighlighter ? 28 : 14;
  const tipH = isPencil ? 26 : isHighlighter ? 18 : 26;
  const tipColor = isPencil ? "#e6c89a" : isHighlighter ? pen.color : "#c9ccd4";
  const bodyColor = isPencil ? pen.color : isHighlighter ? pen.color : "#3a3b42";
  const bandColor = isPencil ? "transparent" : isHighlighter ? "rgba(255,255,255,0.35)" : pen.color;
  const cx = 23;
  const parts = [
    `<polygon points="${cx},0 ${cx + tipW / 2},${tipH} ${cx - tipW / 2},${tipH}" fill="${tipColor}" opacity="${isHighlighter ? 0.65 : 1}"/>`,
    `<rect x="${cx - bodyW / 2}" y="${tipH}" width="${bodyW}" height="${104 - tipH}" rx="5" fill="${bodyColor}" opacity="${isHighlighter ? 0.8 : 1}"/>`,
    `<rect x="${cx - bodyW / 2}" y="${tipH + 12}" width="${bodyW}" height="9" fill="${bandColor}"/>`,
    `<rect x="${cx - bodyW / 2 + 3}" y="${tipH + 3}" width="5" height="${104 - tipH - 6}" rx="2" fill="rgba(255,255,255,0.14)"/>`
  ];
  svg.innerHTML = parts.join("");
  return svg;
}

export function renderEditor(root, notebookId, initialPageId) {
  const notebook = store.notebook(notebookId);
  let selectedPageId = (initialPageId && notebook.pages.some((p) => p.id === initialPageId)) ? initialPageId : notebook.pages[0].id;
  const defaultPen = store.defaultPen;
  let tool = { tool: defaultPen.tool, color: defaultPen.color, width: defaultPen.width, alpha: 1 };
  const toolMemory = {};         // "pen" / "highlighter" grubu için son ayarlar
  let recording = null;          // sesli not kaydı (MediaRecorder)
  let editingObjects = false;
  let selectedObjectId = null;
  let activeInk = null;
  let liveBand = null;
  const inks = new Map();
  let popover = null;
  let lastPen = { ...tool };     // silgiden sonra dönülecek kalem
  let fitScale = 1;
  let zoom = 1;
  let pan = { x: 0, y: 0 };
  let flipDir = 0;
  const snapshots = new Map();   // pageId -> { version, url, pending }
  const pageVersions = new Map();
  const textLines = new Map();   // pageId -> PDF metin satırları
  let ruler = null;              // { x, y, angle, length, edgeOffset } sayfa koordinatında; null = kapalı
  let textSelectMode = false;    // PDF metnini seçme (kopyala / çevir) kipi
  let editingTextId = null;      // klavye/Scribble ile düzenlenen yazı nesnesi

  const screen = h("div", { class: "screen screen-dark" });
  const topbar = h("div", { class: "topbar" });
  const editorBody = h("div", { class: "editor-body" });
  const stage = h("div", { class: "spread-stage" });
  const banner = h("div", { class: "mode-banner", hidden: true });
  const bench = h("div", { class: "bench" });
  editorBody.append(stage, banner);
  screen.append(topbar, editorBody, bench);
  root.append(screen);
  // Alt bar paleti: ilk kez, favori kalemlerin renkleriyle başlar; sonra kullandıkça kendi kendine sıralanır.
  if (!store.settings.paletteSeeded) {
    const seed = [...new Set(store.settings.pens.map((p) => p.color.toUpperCase()))];
    store.setSetting("paletteSeeded", true);
    if (seed.length) store.setSetting("palette", seed);
  }
  const flip = createFlip(stage, buildSheet);

  const nb = () => store.notebook(notebookId);
  const pages = () => nb().pages;
  const selectedIndex = () => Math.max(0, pages().findIndex((p) => p.id === selectedPageId));
  const selectedPage = () => pages()[selectedIndex()];
  const spreadMode = () => store.settings.spreadMode;
  const spreadLeft = () => selectedIndex() - (selectedIndex() % 2);
  const isFrosted = () => tool.tool === "frosted";

  // ---------- üst çubuk ----------

  function renderTopbar() {
    const count = pages().length;
    const left = spreadLeft();
    const counter = spreadMode()
      ? (pages()[left + 1] ? `${left + 1}-${left + 2} / ${count}` : `${left + 1} / ${count}`)
      : `${selectedIndex() + 1} / ${count}`;
    const canBack = spreadMode() ? left > 0 : selectedIndex() > 0;
    const atEnd = spreadMode() ? left + 2 >= count : selectedIndex() >= count - 1;
    const canForward = true;   // son sayfada ileri = yeni sayfa
    const page = selectedPage();
    topbar.replaceChildren(
      h("div", { class: "topbar-side" },
        h("button", { class: "back-btn", type: "button", "aria-label": "Defterlerim", onTap: () => { flushInk(); navigate("#/"); } }, svgIcon("back", 24)),
        h("span", { class: "topbar-notebook" }, nb().title),
        page.pdf && h("span", { class: "badge-pdf" }, "PDF")),
      h("div", { class: "topbar-title" }),
      h("div", { class: "topbar-side right" },
        iconButton("share", "Paylaş", shareMenu),
        Object.assign(iconButton("undo", "Geri al", () => activeInk && activeInk.undo()), { disabled: !(activeInk && activeInk.canUndo) }),
        Object.assign(iconButton("redo", "İleri al", () => activeInk && activeInk.redo()), { disabled: !(activeInk && activeInk.canRedo) }),
        iconButton("more", "Daha fazla", pageActionsMenu),
        iconButton("plus", "Sayfa ekle", () => openAddPageSheet(notebookId, insertAnchor(), (id) => selectPage(id))),
        h("div", { class: "segmented", role: "group", "aria-label": "Görünüm" },
          h("button", { type: "button", class: spreadMode() ? "" : "active", onTap: () => { store.setSetting("spreadMode", false); renderStage(); } }, "Tek"),
          h("button", { type: "button", class: spreadMode() ? "active" : "", onTap: () => { store.setSetting("spreadMode", true); renderStage(); } }, "Çift")),
        h("div", { class: "pill" },
          Object.assign(iconButton("back", "Önceki sayfa", () => movePage(-1)), { disabled: !canBack }),
          h("span", {}, counter),
          Object.assign(iconButton(atEnd ? "plus" : "forward", atEnd ? "Yeni sayfa ekle" : "Sonraki sayfa", () => movePage(1)), { disabled: !canForward }))
      )
    );
  }

  function shareMenu() {
    const page = selectedPage();
    actionSheet("Paylaş", [
      { title: "Sayfayı Görsel Olarak Paylaş", onSelect: sharePageImage },
      { title: "Çeviri", onSelect: () => openTranslateDialog(getSelectionText()) },
      page.pdf ? { title: textSelectMode ? "Metin Seçmeyi Bitir" : "PDF Metnini Seç (kopyala, çevir)", onSelect: () => { textSelectMode = !textSelectMode; applyModes(); renderTopbar(); } } : null,
      { title: "Yedekle", onSelect: () => import("./backup.js").then((m) => m.exportBackup()) }
    ].filter(Boolean));
  }

  async function sharePageImage() {
    const page = selectedPage();
    try {
      const url = await pageSnapshot(page);
      const blob = await (await fetch(url)).blob();
      const name = `${nb().title}-sayfa-${selectedIndex() + 1}.png`;
      const file = new File([blob], name, { type: "image/png" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: nb().title }); return; }
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    } catch (error) {
      toast("Paylaşılamadı: " + error.message);
    }
  }

  /** Üst çubuktaki favori kalemler: dokununca seçilir, seçiliye tekrar dokununca kalem paneli açılır. */
  function favoriteStrip() {
    const strip = h("div", { class: "fav-strip", role: "group", "aria-label": "Favori kalemler" });
    if (isInking() && !store.settings.pens.some((p) => penMatches(p))) {
      const mini = h("button", { class: `fav-mini current ${tool.tool} selected`, type: "button", style: { "--c": tool.color }, "aria-label": "Şu anki kalem (favori değil). Dokun: ayarlar" });
      pressable(mini, { onTap: () => openPenPanel() });
      const add = h("button", { class: "fav-add", type: "button", "aria-label": "Bu kalemi favorilere ekle", onTap: addCurrentToFavorites }, svgIcon("plus", 14));
      strip.append(mini, add, h("span", { class: "fav-sep" }));
    }
    for (const pen of store.settings.pens) {
      const selected = penMatches(pen);
      const mini = h("button", { class: `fav-mini ${pen.tool}` + (selected ? " selected" : ""), type: "button", style: { "--c": pen.color },
        "aria-label": pen.name + ", uzun bas: düzenle", "aria-pressed": String(selected), title: pen.name });
      pressable(mini, {
        onTap: () => { if (selected) openPenPanel(); else { tool = { tool: pen.tool, color: pen.color, width: pen.width }; lastPen = { ...tool }; clearSelections(); renderBench(); renderTopbar(); applyModes(); } },
        onLong: () => penMenu(pen)
      });
      strip.append(mini);
    }
    return strip;
  }

  function openNotebooksMenu() {
    const list = openNotebooks().filter((o) => store.notebook(o.id) && !store.notebook(o.id).isTrashed);
    const actions = list.map((o) => ({
      title: (o.id === notebookId ? "\u2713 " : "") + store.notebook(o.id).title,
      onSelect: () => { if (o.id !== notebookId) { flushInk(); navigate(`#/n/${o.id}/p/${o.pageId}`); } }
    }));
    actions.push({ title: "Başka defter aç…", onSelect: () => { flushInk(); navigate("#/"); } });
    if (list.length > 1) actions.push({ title: "Listeyi temizle", destructive: true, onSelect: () => sessionStorage.setItem("notdefteri.open", JSON.stringify([{ id: notebookId, pageId: selectedPageId }])) });
    actionSheet("Açık defterler", actions);
  }

  function insertAnchor() {
    return spreadMode() ? Math.min(spreadLeft() + 1, pages().length - 1) : selectedIndex();
  }

  /** Son sayfadan ileri geçilince yeni sayfa eklenir (son kullanılan şablonla). */
  function ensureNextPage(dir) {
    if (dir !== 1 || editingObjects) return;
    const list = pages();
    const atEnd = spreadMode() ? spreadLeft() + 2 >= list.length : selectedIndex() >= list.length - 1;
    if (!atEnd) return;
    const template = store.initialTemplate();
    store.addPage(notebookId, list.length, template);
    if (spreadMode() && pages().length % 2 === 1) store.addPage(notebookId, pages().length, template);
    renderTopbar();
  }

  function flipTargetId(dir) {
    const list = pages();
    let index;
    if (spreadMode()) {
      index = Math.min(Math.max(spreadLeft() + dir * 2, 0), list.length - 1);
      if (index === spreadLeft()) return null;
    } else {
      index = selectedIndex() + dir;
      if (index < 0 || index >= list.length) return null;
    }
    return list[index].id;
  }

  function movePage(offset) {
    ensureNextPage(offset);
    const target = flipTargetId(offset);
    if (!target) return;
    if (editingObjects || zoom > 1 || flip.active || !flip.run(offset, (committed) => { if (committed) selectPage(target); })) {
      selectPage(target);
    }
  }

  function selectPage(id) {
    flushInk();
    selectedPageId = id;
    selectedObjectId = null;
    rememberOpen(notebookId, id);
    if (ruler) { const p = pages().find((x) => x.id === id); if (p) { ruler.x = Math.min(ruler.x, p.size.w - 40); ruler.y = Math.min(ruler.y, p.size.h - 40); } }
    renderStage();
    history.replaceState(null, "", `#/n/${notebookId}/p/${id}`);
  }

  function pageActionsMenu() {
    const page = selectedPage();
    const index = selectedIndex();
    const count = pages().length;
    actionSheet(`${index + 1}. sayfa`, [
      { title: "Açık Defterler", onSelect: openNotebooksMenu },
      { title: "Şablonu Değiştir", onSelect: () => import("./addpage.js").then((m) => m.openTemplatePicker((t) => { store.setTemplate(notebookId, page.id, t); renderStage(); })) },
      { title: "Çeviri", onSelect: () => openTranslateDialog(getSelectionText()) },
      { title: "Sayfa Yelpazesi", onSelect: () => { flushInk(); navigate(`#/n/${notebookId}/fan?p=${page.id}`); } },
      { title: "Sayfayı Çoğalt", onSelect: () => { const id = store.duplicatePage(notebookId, page.id); if (id) selectPage(id); } },
      { title: "Sayfayı Öne Taşı", disabled: index === 0, onSelect: () => { store.movePage(notebookId, page.id, index - 1); renderStage(); } },
      { title: "Sayfayı Arkaya Taşı", disabled: index >= count - 1, onSelect: () => { store.movePage(notebookId, page.id, index + 1); renderStage(); } },
      { title: "Defteri Yeniden Adlandır", onSelect: () => promptDialog("Defteri Yeniden Adlandır", "Defter adı", nb().title, (title) => { store.mutate(notebookId, (n) => { n.title = title; }); renderTopbar(); }) },
      { title: "Sayfayı Sil", destructive: true, disabled: count <= 1, onSelect: () => confirmDialog("Bu sayfa silinsin mi?", "Sayfa ve üzerindeki yazılar silinir. Defterde en az bir sayfa kalmalı.", "Sayfayı Sil", () => {
        const oldIndex = index;
        if (store.deletePage(notebookId, page.id)) {
          const remaining = pages();
          selectPage(remaining[Math.min(oldIndex, remaining.length - 1)].id);
        }
      }) }
    ]);
  }

  // ---------- sahne ----------

  function renderStage() {
    for (const ink of inks.values()) ink.canvas.remove();
    inks.clear();
    activeInk = null;
    stage.replaceChildren();
    const list = pages();
    if (!list.some((p) => p.id === selectedPageId)) selectedPageId = list[0].id;
    let content;
    if (spreadMode()) {
      const left = list[spreadLeft()];
      const right = list[spreadLeft() + 1];
      const leftSize = (left || right).size;
      const rightSize = (right || left).size;
      content = h("div", { class: "spread", style: { width: (leftSize.w + rightSize.w) + "px", height: Math.max(leftSize.h, rightSize.h) + "px" } },
        h("div", { class: "back-sheets" }),
        left ? pageStack(left) : emptyPage(leftSize),
        right ? pageStack(right) : emptyPage(rightSize),
        h("div", { class: "spine" }));
    } else {
      const page = selectedPage();
      content = h("div", { class: "spread", style: { width: page.size.w + "px", height: page.size.h + "px" } }, h("div", { class: "back-sheets" }), pageStack(page));
    }
    stage.append(content);
    activeInk = inks.get(selectedPageId) || inks.values().next().value || null;
    fit();
    renderTopbar();
    renderBanner();
  }

  function fit() {
    const spread = stage.querySelector(".spread");
    if (!spread) return;
    const w = parseFloat(spread.style.width);
    const hgt = parseFloat(spread.style.height);
    fitScale = Math.max(0.1, Math.min((editorBody.clientWidth - 40) / w, (editorBody.clientHeight - 40) / hgt));
    stage.style.width = w + "px";
    stage.style.height = hgt + "px";
    applyTransform();
  }

  /** Yakınlaştırma sayfanın ortasına göre; kaydırma ekran pikseli cinsinden. */
  function applyTransform() {
    if (zoom <= 1) pan = { x: 0, y: 0 };
    stage.style.transform = `translate(${pan.x}px, ${pan.y}px) scale(${fitScale * zoom})`;
    stage.dataset.scale = String(fitScale * zoom);
  }

  function emptyPage(size) {
    return h("div", { class: "empty-page", style: { width: size.w + "px", height: size.h + "px" }, role: "button", tabindex: "0",
      onTap: () => openAddPageSheet(notebookId, pages().length - 1, (id) => selectPage(id)) }, svgIcon("plus", 44), "Sayfa ekle");
  }

  function toPageCoords(e, stackEl, page) {
    const rect = stackEl.getBoundingClientRect();
    return { x: (e.clientX - rect.left) * page.size.w / rect.width, y: (e.clientY - rect.top) * page.size.h / rect.height };
  }

  function pageStack(page) {
    const stack = h("div", { class: "page-stack", style: { width: page.size.w + "px", height: page.size.h + "px" } });
    const bg = h("div", { class: "page-bg" });
    renderBackground(bg, page);
    const objectsLayer = h("div", { class: "layer-objects" });
    const canvas = h("canvas", { class: "layer-ink", "aria-label": "Çizim alanı" });
    const coversLayer = h("div", { class: "layer-covers" });
    const selectLayer = h("div", { class: "layer-select" });
    const textLayer = h("div", { class: "layer-text" + (textSelectMode ? " active" : "") });
    stack.append(bg, objectsLayer, canvas, selectLayer, coversLayer, textLayer);
    if (page.pdf && !textLines.has(page.id)) {
      pdfTextLines(page.pdf, page.size).then((lines) => textLines.set(page.id, lines)).catch(() => textLines.set(page.id, []));
    }
    if (page.pdf) {
      pdfTextItems(page.pdf, page.size).then((items) => {
        for (const item of items) {
          const span = h("span", { style: { left: item.x + "px", top: item.y + "px", fontSize: item.h + "px" } }, item.str + (item.eol ? "\n" : ""));
          textLayer.append(span);
          requestAnimationFrame(() => { const w = span.getBoundingClientRect().width / (fitScale * zoom || 1); if (w > 0 && item.w > 0) span.style.transform = `scaleX(${item.w / w})`; });
        }
      }).catch(() => {});
    }
    const ink = new InkCanvas(canvas, page, {
      getTool: () => tool,
      pencilOnly: () => store.settings.pencilOnly,
      pressureWidth: () => store.settings.pressureWidth,
      fingerAction: () => store.settings.fingerAction,
      eraser: () => store.settings.eraser,
      shapeRecognition: () => store.settings.shapeRecognition,
      rulerSnap: () => store.settings.rulerSnap !== false,
      smoothing: () => (store.settings.smoothing == null ? 2 : store.settings.smoothing),
      ruler: () => (ruler && selectedPageId === page.id ? ruler : null),
      textLines: () => textLines.get(page.id) || null,
      onSelection: (bounds) => renderSelection(stack, page, bounds),
      onEraseEnd: () => { if (tool.tool === "eraser" && lastPen) { tool = { ...lastPen }; renderBench(); renderTopbar(); applyModes(); } },
      toPageCoords: (e) => toPageCoords(e, stack, page),
      neighborFor: (dir) => {
        if (!spreadMode()) return null;
        const list = pages();
        const index = list.findIndex((p) => p.id === page.id);
        const left = index - (index % 2);
        const otherIndex = index + dir;
        if (otherIndex < left || otherIndex > left + 1 || !list[otherIndex]) return null;
        const other = list[otherIndex];
        const ink = inks.get(other.id);
        if (!ink) return null;
        return { ink, offset: dir === 1 ? -page.size.w : other.size.w };
      },
      onChange: () => { activeInk = ink; if (isInking()) store.noteColorUsed(tool.color); store.mutate(notebookId, () => {}); renderTopbar(); invalidateSnapshot(page); refreshFrost(stack, page); }
    });
    inks.set(page.id, ink);
    canvas.addEventListener("pointerdown", () => {
      activeInk = ink;
      if (selectedPageId !== page.id) { selectedPageId = page.id; history.replaceState(null, "", `#/n/${notebookId}/p/${page.id}`); }
      renderTopbar();
    });
    // Çift sayfada örtü/nesne katmanına dokununca da o sayfa "seçili" olur (post-it oraya gider).
    stack.addEventListener("pointerdown", () => { if (selectedPageId !== page.id) { selectedPageId = page.id; renderTopbar(); } }, true);
    renderObjects(objectsLayer, page, stack);
    renderCovers(coversLayer, page, stack);
    stack._layers = { objectsLayer, coversLayer, canvas, selectLayer, textLayer };
    stack._pageId = page.id;
    renderRuler(stack, page);
    return stack;
  }

  // ---------- kement seçimi (kutuya alıp taşı / büyüt / döndür) ----------

  function renderSelection(stack, page, bounds) {
    const layer = stack._layers.selectLayer;
    layer.replaceChildren();
    if (!bounds) { if (popover && popover.dataset.kind === "selection") closePopover(); return; }
    const ink = inks.get(page.id);
    const item = { id: "selection", rect: { ...bounds }, rotation: 0 };
    const start = { rect: { ...bounds } };
    const box = h("div", { class: "selection-box" });
    placeItem(box, item);
    let editing = false;
    makeTransformable(box, item, stack, page, () => {
      ink.commit();
      editing = false;
      renderSelection(stack, page, ink.selectionBounds());
    }, null, (rect, rotation) => {
      if (!editing) { ink.beginSelectionEdit(); editing = true; }
      ink.applySelectionTransform({
        dx: (rect.x + rect.w / 2) - (start.rect.x + start.rect.w / 2),
        dy: (rect.y + rect.h / 2) - (start.rect.y + start.rect.h / 2),
        scale: rect.w / start.rect.w,
        rotate: rotation,
        center: { x: start.rect.x + start.rect.w / 2, y: start.rect.y + start.rect.h / 2 }
      });
    });
    addHandles(box);
    layer.append(box);
    if (!(popover && popover.dataset.kind === "selection" && popover._ink === ink)) openSelectionPanel(ink, stack, page);
  }

  // ---------- cetvel ----------

  function renderRuler(stack, page) {
    for (const old of stack.querySelectorAll(".ruler")) old.remove();
    if (!ruler || selectedPageId !== page.id) return;
    const el = h("div", { class: "ruler", style: { width: ruler.length + "px" }, "aria-label": "Cetvel" });
    for (let i = 0; i * 50 < ruler.length - 20; i++) el.append(h("span", { class: "ruler-num", style: { left: (i * 50) + "px" } }, String(i)));
    const angleBadge = store.settings.rulerAngle !== false ? h("div", { class: "ruler-angle" }) : null;
    const place = () => {
      el.style.left = (ruler.x - ruler.length / 2) + "px";
      el.style.top = ruler.y + "px";
      el.style.transform = `rotate(${ruler.angle}deg)`;
      if (angleBadge) angleBadge.textContent = Math.round(((ruler.angle % 360) + 360) % 360) + "°";
    };
    place();
    const move = h("div", { class: "ruler-grip move", role: "button", "aria-label": "Cetveli taşı" }, svgIcon("move", 18));
    const rotate = h("div", { class: "ruler-grip rotate", role: "button", "aria-label": "Cetveli döndür" }, svgIcon("rotate", 18));
    grip(move, stack, page, (p, session) => { ruler.x = session.base.x + (p.x - session.start.x); ruler.y = session.base.y + (p.y - session.start.y); place(); });
    grip(rotate, stack, page, (p) => { ruler.angle = Math.atan2(p.y - ruler.y, p.x - ruler.x) * 180 / Math.PI; place(); });
    el.append(move, rotate);
    if (angleBadge) el.append(angleBadge);
    stack.append(el);
  }

  function refreshRulers() {
    for (const stack of stage.querySelectorAll(".page-stack:not(.static)")) {
      const page = pages().find((p) => p.id === stack._pageId);
      if (page) renderRuler(stack, page);
    }
  }

  function grip(el, stack, page, onMove) {
    let session = null;
    el.addEventListener("pointerdown", (e) => {
      e.stopPropagation();
      e.preventDefault();
      try { el.setPointerCapture(e.pointerId); } catch (_) { /* sentetik olay */ }
      session = { id: e.pointerId, start: toPageCoords(e, stack, page), base: { x: ruler.x, y: ruler.y } };
    });
    el.addEventListener("pointermove", (e) => { if (session && e.pointerId === session.id) { e.preventDefault(); onMove(toPageCoords(e, stack, page), session); } });
    const end = (e) => { if (session && e.pointerId === session.id) session = null; };
    el.addEventListener("pointerup", end);
    el.addEventListener("pointercancel", end);
  }

  function toggleRuler() {
    if (ruler) { ruler = null; }
    else {
      const page = selectedPage();
      ruler = { x: page.size.w / 2, y: page.size.h / 2, angle: 0, length: Math.min(page.size.w * 0.9, 560), edgeOffset: -22 };
    }
    for (const stack of stage.querySelectorAll(".page-stack:not(.static)")) {
      const page = pages().find((p) => p.id === stack._pageId);
      if (page) renderRuler(stack, page);
    }
    renderBench();
  }

  /** Etkileşimsiz sayfa kopyası: sayfa çevirme yaprağı için. */
  function staticPage(page) {
    const stack = h("div", { class: "page-stack static", style: { width: page.size.w + "px", height: page.size.h + "px" } });
    const bg = h("div", { class: "page-bg" });
    renderBackground(bg, page);
    const objectsLayer = h("div", { class: "layer-objects" });
    const wasEditing = editingObjects;
    editingObjects = false;
    renderObjects(objectsLayer, page, stack);
    editingObjects = wasEditing;
    const ink = h("img", { class: "layer-ink-img", alt: "", draggable: "false" });
    if (page.strokes.length) ink.src = renderStrokesToDataURL(page, page.size.w * 2);
    const coversLayer = h("div", { class: "layer-covers static" });
    for (const cover of page.covers) {
      const el = h("div", { class: `cover-mark static ${cover.style === "band" ? "band" : "postit"}`, style: { "--tint": cover.tint, "--tint-opacity": String(cover.tintOpacity), "--blur": cover.blur + "px" } });
      el.append(h("div", { class: "frost-tint" }));
      placeItem(el, cover);
      coversLayer.append(el);
    }
    stack.append(bg, objectsLayer, ink, coversLayer);
    return stack;
  }

  function paperFace(size) {
    return h("div", { style: { width: size.w + "px", height: size.h + "px", background: PAPER_COLOR } });
  }

  /** Çevrilecek yaprağı kurar (docs/tasarim/03-KapakAcilis.png ruhunda). dir: 1 ileri, -1 geri. */
  function buildSheet(dir) {
    const list = pages();
    if (spreadMode()) {
      const left = spreadLeft();
      if (dir === 1) {
        const curRight = list[left + 1];
        const nextLeft = list[left + 2];
        const nextRight = list[left + 3];
        if (!curRight || !nextLeft) return null;
        const leftW = list[left].size.w;
        return { x: leftW, y: 0, width: curRight.size.w, height: curRight.size.h, origin: "left",
          front: staticPage(curRight), back: staticPage(nextLeft),
          under: nextRight ? staticPage(nextRight) : paperFace(curRight.size), underX: leftW, underY: 0, startAngle: 0, endAngle: -180 };
      }
      const curLeft = list[left];
      const prevLeft = list[left - 2];
      const prevRight = list[left - 1];
      if (!curLeft || !prevLeft) return null;
      return { x: 0, y: 0, width: curLeft.size.w, height: curLeft.size.h, origin: "right",
        front: staticPage(curLeft), back: staticPage(prevRight),
        under: staticPage(prevLeft), underX: 0, underY: 0, startAngle: 0, endAngle: 180 };
    }
    const index = selectedIndex();
    const current = list[index];
    if (dir === 1) {
      const next = list[index + 1];
      if (!next) return null;
      return { x: 0, y: 0, width: current.size.w, height: current.size.h, origin: "left",
        front: staticPage(current), back: paperFace(current.size), under: staticPage(next), underX: 0, underY: 0, startAngle: 0, endAngle: -180 };
    }
    const prev = list[index - 1];
    if (!prev) return null;
    return { x: 0, y: 0, width: prev.size.w, height: prev.size.h, origin: "left",
      front: staticPage(prev), back: paperFace(prev.size), under: null, startAngle: -180, endAngle: 0 };
  }

  function refreshLayers() {
    for (const stack of stage.querySelectorAll(".page-stack")) {
      const page = pages().find((p) => p.size && stack._pageId === p.id) || null;
      void page;
    }
    // Basit yol: sahneyi katman katman yeniden kurmak yerine bütün sahneyi kur (çizim tuvali korunmaz ama veri store'da).
    renderStage();
  }

  function applyModes() {
    for (const stack of stage.querySelectorAll(".page-stack")) {
      const { objectsLayer, coversLayer, canvas } = stack._layers;
      objectsLayer.classList.toggle("editing", editingObjects);
      canvas.classList.toggle("disabled", editingObjects || isFrosted() || textSelectMode);
      coversLayer.classList.toggle("capture", isFrosted() && !editingObjects);
      if (stack._layers.textLayer) stack._layers.textLayer.classList.toggle("active", textSelectMode);
    }
    renderBanner();
  }

  function renderBanner() {
    if (editingObjects) {
      banner.hidden = false;
      banner.replaceChildren(
        h("span", {}, selectedObjectId ? "Sürükle, köşeden büyüt, üstten döndür" : "Nesne düzenleme: bir nesneye dokun"),
        h("button", { class: "btn small primary", type: "button", onTap: () => setEditing(false) }, "Bitti"));
    } else if (textSelectMode) {
      banner.hidden = false;
      banner.replaceChildren(h("span", {}, "Basılı tutup metni seç, sonra:"),
        h("button", { class: "btn small", type: "button", style: { background: "rgba(255,255,255,0.15)", color: "#fff" }, onTap: () => { const t = getSelectionText(); if (!t) { toast("Önce metni seç."); return; } navigator.clipboard.writeText(t).then(() => toast("Kopyalandı")).catch(() => toast("Kopyalanamadı")); } }, "Kopyala"),
        h("button", { class: "btn small", type: "button", style: { background: "rgba(255,255,255,0.15)", color: "#fff" }, onTap: () => { const t = getSelectionText(); if (!t) { openTranslateDialog(""); return; } openTranslate(t); } }, "Çevir"),
        h("button", { class: "btn small primary", type: "button", onTap: () => { textSelectMode = false; applyModes(); renderTopbar(); } }, "Bitti"));
    } else if (isFrosted()) {
      banner.hidden = false;
      banner.replaceChildren(svgIcon("hand", 16), h("span", {}, "Buzlu kalem: yazının üstüne çek"));
    } else {
      banner.hidden = true;
    }
  }

  function getSelectionText() {
    const sel = window.getSelection();
    return sel ? sel.toString().trim() : "";
  }

  function setEditing(on) {
    editingObjects = on;
    if (!on) { selectedObjectId = null; editingTextId = null; }
    renderStage();
    applyModes();
    renderBench();
  }

  // ---------- nesneler (fotoğraf / çıkartma / post-it) ----------

  function renderObjects(layer, page, stack) {
    layer.replaceChildren();
    layer.classList.toggle("editing", editingObjects);
    const sorted = page.objects.slice().sort((a, b) => a.z - b.z);
    for (const object of sorted) {
      const el = h("div", { class: `placed ${object.kind}` + (object.id === selectedObjectId ? " selected" : "") + (object.id === editingTextId ? " editing" : ""), style: { "--tint": object.tint || "#FFE566" } });
      if (object.kind === "tape") {
        el.classList.add(object.pattern || "plain");
        el.append(h("div", { class: "tape-body" }));
      } else if (object.kind === "text") {
        el.style.setProperty("--font", object.font || TEXT_FONTS[1][0]);
        el.style.setProperty("--size", (object.size || 22) + "px");
        el.style.setProperty("--text-color", object.color || "#1C1C1E");
        if (object.todo && object.id !== editingTextId) {
          // Yapılacaklar listesi: her satırın başında dokununca işaretlenen kutu.
          el.classList.add("todo");
          const list = h("div", { class: "text-content todo-list" });
          (object.text || "").split("\n").forEach((line, i) => {
            const m = /^\[( |x)\]\s?(.*)$/i.exec(line);
            const checked = m ? m[1].toLowerCase() === "x" : false;
            const label = m ? m[2] : line;
            const box = h("button", { class: "todo-box" + (checked ? " checked" : ""), type: "button", "aria-label": checked ? "İşareti kaldır" : "İşaretle",
              onTap: (e) => { e.stopPropagation(); toggleTodoLine(object, page, i); renderObjects(layer, page, stack); } }, svgIcon("check", 14));
            box.addEventListener("pointerdown", (e) => e.stopPropagation());
            list.append(h("div", { class: "todo-row" + (checked ? " done" : "") }, box, h("span", {}, label)));
          });
          el.append(list);
          placeItem(el, object);
          if (editingObjects) {
            makeTransformable(el, object, stack, page, (rect, rotation) => {
              store.updatePage(notebookId, page.id, (p) => { const o = p.objects.find((x) => x.id === object.id); if (o) { o.rect = rect; o.rotation = rotation; } });
              placeItem(el, object);
              touchPage(page);
            }, () => { selectedObjectId = object.id; renderObjects(layer, page, stack); renderCovers(stack._layers.coversLayer, page, stack); renderBanner(); });
            if (object.id === selectedObjectId) { addHandles(el); layer.append(objectMenu(object, page, textActions(object, page, stack, layer), () => { touchPage(page); renderObjects(layer, page, stack); renderBanner(); })); }
          }
          layer.append(el);
          continue;
        }
        const content = h("div", { class: "text-content", contenteditable: object.id === editingTextId ? "true" : "false", spellcheck: "false" }, object.text || "");
        content.addEventListener("input", () => { object.text = content.textContent; });
        if (object.todo) content.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); document.execCommand("insertText", false, "\n[ ] "); } });
        content.addEventListener("blur", () => {
          store.updatePage(notebookId, page.id, (p) => { const o = p.objects.find((x) => x.id === object.id); if (o) o.text = content.textContent; });
          touchPage(page);
          if (editingTextId === object.id) { editingTextId = null; renderObjects(layer, page, stack); }
        });
        content.addEventListener("pointerdown", (e) => { if (object.id === editingTextId) e.stopPropagation(); });
        el.append(content);
        if (object.id === editingTextId) setTimeout(() => { content.focus(); }, 30);
      } else if (object.kind === "check") {
        const box = h("button", { class: "todo-box" + (object.checked ? " checked" : ""), type: "button", "aria-label": object.checked ? "İşareti kaldır" : "İşaretle",
          onTap: (e) => { e.stopPropagation(); store.updatePage(notebookId, page.id, (p) => { const o = p.objects.find((x) => x.id === object.id); if (o) o.checked = !o.checked; }); touchPage(page); renderObjects(layer, page, stack); } }, svgIcon("check", 20));
        if (!editingObjects) box.addEventListener("pointerdown", (e) => e.stopPropagation());
        el.append(box);
      } else if (object.kind === "audio") {
        const audio = h("audio", { preload: "metadata" });
        store.assetURL(object.asset).then((url) => { if (url) audio.src = url; });
        const play = h("button", { class: "audio-play", type: "button", "aria-label": "Sesli notu çal / durdur", onTap: (e) => { e.stopPropagation(); if (audio.paused) { audio.play().catch(() => toast("Ses çalınamadı")); el.classList.add("playing"); } else { audio.pause(); el.classList.remove("playing"); } } }, svgIcon("play", 16));
        audio.addEventListener("ended", () => el.classList.remove("playing"));
        el.append(play, h("div", { class: "audio-wave" }, ...Array.from({ length: 16 }, () => h("i"))), h("span", { class: "audio-time" }, formatDuration(object.duration || 0)), audio);
      } else if (object.kind !== "postit" && object.kind !== "tape") {
        const image = h("img", { alt: "", draggable: "false" });
        store.assetURL(object.asset).then((url) => { if (url) image.src = url; });
        el.append(image);
      }
      placeItem(el, object);
      if (editingObjects) {
        makeTransformable(el, object, stack, page, (rect, rotation) => {
          store.updatePage(notebookId, page.id, (p) => { const o = p.objects.find((x) => x.id === object.id); if (o) { o.rect = rect; o.rotation = rotation; } });
          placeItem(el, object);
          touchPage(page);
        }, () => { selectedObjectId = object.id; renderObjects(layer, page, stack); renderCovers(stack._layers.coversLayer, page, stack); renderBanner(); });
        if (object.id === selectedObjectId) {
          addHandles(el);
          layer.append(objectMenu(object, page, textActions(object, page, stack, layer), () => { touchPage(page); renderObjects(layer, page, stack); renderBanner(); }));
        }
      }
      layer.append(el);
    }
    if (editingObjects) {
      layer.addEventListener("pointerdown", (e) => { if (e.target === layer) { selectedObjectId = null; renderObjects(layer, page, stack); renderCovers(stack._layers.coversLayer, page, stack); renderBanner(); } });
    }
  }

  function textActions(object, page, stack, layer) {
    return {
            edit: object.kind === "text" ? () => { editingTextId = object.id; } : null,
            todo: object.kind === "text" ? () => toggleTodoMode(object, page) : null,
            cut: (object.kind === "photo" || object.kind === "sticker") ? () => startCut(object, page, stack) : null,
            font: object.kind === "text" ? () => textStyleMenu(object, page) : null,
            translate: object.kind === "text" ? () => openTranslate(object.text) : null,
            rotate: () => store.updatePage(notebookId, page.id, (p) => { const o = p.objects.find((x) => x.id === object.id); if (o) o.rotation = (o.rotation + 90) % 360; }),
            duplicate: () => { clipboard.objects = [structuredClone(object)]; clipboard.strokes = []; toast("Panoya kopyalandı; Yapıştır ile başka sayfaya koy"); renderBench(); },
            front: () => store.updatePage(notebookId, page.id, (p) => { const o = p.objects.find((x) => x.id === object.id); if (o) o.z = maxZ(p) + 1; }),
            remove: () => { store.updatePage(notebookId, page.id, (p) => { p.objects = p.objects.filter((x) => x.id !== object.id); }); selectedObjectId = null; store.removeUnreferencedAssets(); }
    };
  }

  /** Bir satırın onay kutusunu değiştirir: "[ ] " ↔ "[x] ". */
  function toggleTodoLine(object, page, index) {
    const lines = (object.text || "").split("\n");
    const line = lines[index] || "";
    if (/^\[x\]/i.test(line)) lines[index] = "[ ]" + line.slice(3);
    else if (/^\[ \]/.test(line)) lines[index] = "[x]" + line.slice(3);
    else lines[index] = "[x] " + line;
    object.text = lines.join("\n");
    store.updatePage(notebookId, page.id, (p) => { const o = p.objects.find((x) => x.id === object.id); if (o) o.text = object.text; });
    touchPage(page);
  }

  /** Yazı kutusunu yapılacaklar listesine çevirir (ya da geri): satır başlarına kutu ekler/kaldırır. */
  function toggleTodoMode(object, page) {
    const on = !object.todo;
    const lines = (object.text || "").split("\n").map((line) => on
      ? (/^\[( |x)\]/i.test(line) ? line : "[ ] " + line)
      : line.replace(/^\[( |x)\]\s?/i, ""));
    object.todo = on;
    object.text = lines.join("\n");
    store.updatePage(notebookId, page.id, (p) => { const o = p.objects.find((x) => x.id === object.id); if (o) { o.todo = on; o.text = object.text; } });
    touchPage(page);
  }

  function maxZ(page) {
    return page.objects.reduce((m, o) => Math.max(m, o.z || 0), 0);
  }

  // ---------- sayfa anlık görüntüsü (buzlu örtülerin altındaki bulanık resim) ----------

  function invalidateSnapshot(page) {
    pageVersions.set(page.id, (pageVersions.get(page.id) || 0) + 1);
  }

  /** Sayfayı (şablon + nesneler + çizim) tek görsele çevirir; örtüler bu görselin bulanık kesitini gösterir. */
  async function pageSnapshot(page) {
    const version = pageVersions.get(page.id) || 0;
    const cached = snapshots.get(page.id);
    if (cached && cached.version === version) return cached.url;
    if (cached && cached.pending && cached.pendingVersion === version) return cached.pending;
    const pending = (async () => {
      const { w, h } = page.size;
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      let drewBackground = false;
      if (page.pdf) {
        const url = await pdfPageImage(page.pdf, 800);
        if (url) drewBackground = await drawImageURL(ctx, url, 0, 0, w, h);
      } else if (page.templateAsset) {
        const url = await store.assetURL(page.templateAsset);
        if (url) drewBackground = await drawImageURL(ctx, url, 0, 0, w, h);
      }
      if (!drewBackground) paintPaper(ctx, page.pdf || page.templateAsset ? "blank" : page.paper, w, h);
      for (const object of page.objects.slice().sort((a, b) => a.z - b.z)) {
        ctx.save();
        ctx.translate(object.rect.x + object.rect.w / 2, object.rect.y + object.rect.h / 2);
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
          const words = (object.text || "").replace(/\[x\]/gi, "\u2611").replace(/\[ \]/g, "\u2610").split(/\s+/);
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
      const url = canvas.toDataURL("image/jpeg", 0.85);
      snapshots.set(page.id, { version, url });
      return url;
    })();
    snapshots.set(page.id, { version: -1, url: cached ? cached.url : null, pending, pendingVersion: version });
    return pending;
  }

  function refreshFrost(stack, page) {
    if (!page.covers.length) return;
    pageSnapshot(page).then((url) => {
      for (const inner of stack.querySelectorAll(".frost-inner")) inner.style.backgroundImage = `url("${url}")`;
    });
  }

  function placeItem(el, item) {
    el.style.left = item.rect.x + "px";
    el.style.top = item.rect.y + "px";
    el.style.width = item.rect.w + "px";
    el.style.height = item.rect.h + "px";
    el.style.transform = `rotate(${item.rotation || 0}deg)`;
  }

  function addHandles(el) {
    el.append(
      h("div", { class: "handle-stem" }),
      h("div", { class: "handle rotate", dataset: { handle: "rotate" }, "aria-label": "Döndürme kolu" }),
      ...["tl", "tr", "bl", "br", "tm", "bm", "ml", "mr"].map((c) => h("div", { class: "handle " + c, dataset: { handle: "resize" }, "aria-label": "Boyut tutamağı" }))
    );
  }

  /** Sürükle → taşı, köşe → ölçekle (merkez sabit), üstteki yuvarlak → döndür. Hepsi sayfa koordinatında. */
  function makeTransformable(el, item, stack, page, onTransform, onSelect, onLive) {
    let session = null;
    el.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      e.stopPropagation();
      e.preventDefault();
      const handle = e.target.dataset && e.target.dataset.handle;
      const start = toPageCoords(e, stack, page);
      const center = { x: item.rect.x + item.rect.w / 2, y: item.rect.y + item.rect.h / 2 };
      session = { pointerId: e.pointerId, handle, start, center, rect: { ...item.rect }, rotation: item.rotation || 0, moved: false };
      try { el.setPointerCapture(e.pointerId); } catch (_) { /* sentetik olay */ }
    });
    el.addEventListener("pointermove", (e) => {
      if (!session || e.pointerId !== session.pointerId) return;
      e.preventDefault();
      const p = toPageCoords(e, stack, page);
      session.moved = true;
      if (session.handle === "rotate") {
        const a0 = Math.atan2(session.start.y - session.center.y, session.start.x - session.center.x);
        const a1 = Math.atan2(p.y - session.center.y, p.x - session.center.x);
        item.rotation = session.rotation + (a1 - a0) * 180 / Math.PI;
      } else if (session.handle === "resize") {
        const d0 = Math.max(1, Math.hypot(session.start.x - session.center.x, session.start.y - session.center.y));
        const d1 = Math.max(1, Math.hypot(p.x - session.center.x, p.y - session.center.y));
        const f = Math.max(0.1, d1 / d0);
        const w = Math.max(24, session.rect.w * f);
        const hh = Math.max(24, session.rect.h * f);
        item.rect = { x: session.center.x - w / 2, y: session.center.y - hh / 2, w, h: hh };
      } else {
        item.rect = { ...session.rect, x: session.rect.x + (p.x - session.start.x), y: session.rect.y + (p.y - session.start.y) };
      }
      placeItem(el, item);
      if (onLive) onLive(item.rect, item.rotation || 0);
    });
    const end = (e) => {
      if (!session || e.pointerId !== session.pointerId) return;
      const moved = session.moved;
      session = null;
      if (moved) onTransform(item.rect, item.rotation || 0);
      // Seçim jestin sonunda yapılır; ortasında katmanı yeniden kurmak sürüklemeyi keserdi.
      if (onSelect && (item.id !== selectedObjectId || moved)) onSelect();
    };
    el.addEventListener("pointerup", end);
    el.addEventListener("pointercancel", end);
  }

  function objectMenu(item, page, actions, rerender) {
    const x = Math.min(Math.max(item.rect.x + item.rect.w / 2, 150), Math.max(page.size.w - 150, 150));
    const y = Math.max(item.rect.y - 12, 60);
    const btn = (title, icon, fn, cls = "") => h("button", { type: "button", class: cls, onTap: (e) => { e.stopPropagation(); fn(); rerender(); } }, svgIcon(icon, 16), title);
    const menu = h("div", { class: "object-menu", style: { left: x + "px", top: y + "px" } },
      actions.edit && btn("Düzenle", "pen", actions.edit), actions.edit && h("div", { class: "sep" }),
      actions.todo && btn(item.todo ? "Kutuları kaldır" : "Onay kutuları", "check", actions.todo), actions.todo && h("div", { class: "sep" }),
      actions.cut && btn("Kes", "scissors", actions.cut), actions.cut && h("div", { class: "sep" }),
      actions.font && btn("Yazı tipi", "note", actions.font), actions.font && h("div", { class: "sep" }),
      actions.translate && btn("Çevir", "share", actions.translate), actions.translate && h("div", { class: "sep" }),
      btn("Döndür", "rotate", actions.rotate), h("div", { class: "sep" }),
      btn("Kopyala", "copy", actions.duplicate), h("div", { class: "sep" }),
      btn("Öne al", "front", actions.front), h("div", { class: "sep" }),
      btn("Sil", "trash", actions.remove, "danger"));
    menu.addEventListener("pointerdown", (e) => e.stopPropagation());
    return menu;
  }

  function touchPage(page) {
    invalidateSnapshot(page);
    for (const stack of stage.querySelectorAll(".page-stack")) {
      if (stack._pageId === page.id) refreshFrost(stack, page);
    }
  }

  // ---------- makas: fotoğrafı kesip beyaz kenarlı çıkartma yapma ----------

  function startCut(object, page, stack) {
    const layer = h("div", { class: "layer-cut" });
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", `0 0 ${page.size.w} ${page.size.h}`);
    svg.setAttribute("width", page.size.w);
    svg.setAttribute("height", page.size.h);
    const path = document.createElementNS(SVG_NS, "path");
    path.setAttribute("class", "cut-path");
    svg.append(path);
    layer.append(svg);
    stack.append(layer);
    banner.hidden = false;
    banner.replaceChildren(svgIcon("scissors", 16), h("span", {}, "Kes: fotoğrafın üstünde kesmek istediğin şeklin çevresini çiz"),
      h("button", { class: "btn small", type: "button", style: { background: "rgba(255,255,255,0.15)", color: "#fff" }, onTap: () => { layer.remove(); renderBanner(); } }, "Vazgeç"));
    let points = null;
    layer.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      try { layer.setPointerCapture(e.pointerId); } catch (_) { /* sentetik olay */ }
      const p = toPageCoords(e, stack, page);
      points = [[p.x, p.y]];
    });
    layer.addEventListener("pointermove", (e) => {
      if (!points) return;
      const p = toPageCoords(e, stack, page);
      const last = points[points.length - 1];
      if (Math.hypot(p.x - last[0], p.y - last[1]) < 2) return;
      points.push([p.x, p.y]);
      path.setAttribute("d", "M" + points.map((q) => q[0].toFixed(1) + " " + q[1].toFixed(1)).join(" L") + " Z");
    });
    const end = async () => {
      if (!points) return;
      const pts = points;
      points = null;
      layer.remove();
      renderBanner();
      if (pts.length < 8) { toast("Kesmek için kapalı bir şekil çiz."); return; }
      try {
        await cutObject(object, page, pts);
      } catch (error) {
        toast("Kesilemedi: " + error.message);
      }
    };
    layer.addEventListener("pointerup", end);
    layer.addEventListener("pointercancel", end);
  }

  /** Çizilen yol fotoğrafın yerel koordinatına çevrilir, görsel kırpılır, beyaz kenar eklenir, yeni çıkartma olur. */
  async function cutObject(object, page, pagePoints) {
    const url = await store.assetURL(object.asset);
    if (!url) throw new Error("görsel bulunamadı");
    const image = await new Promise((resolve, reject) => { const im = new Image(); im.onload = () => resolve(im); im.onerror = () => reject(new Error("görsel yüklenemedi")); im.src = url; });
    const cx = object.rect.x + object.rect.w / 2;
    const cy = object.rect.y + object.rect.h / 2;
    const rad = -(object.rotation || 0) * Math.PI / 180;
    const cos = Math.cos(rad), sin = Math.sin(rad);
    // Sayfa → nesne yerel (döndürülmemiş, sol üst 0,0)
    const local = pagePoints.map(([x, y]) => {
      const dx = x - cx, dy = y - cy;
      return [dx * cos - dy * sin + object.rect.w / 2, dx * sin + dy * cos + object.rect.h / 2];
    });
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const [x, y] of local) { minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); }
    const border = 10;
    const pad = border + 4;
    const bw = maxX - minX + pad * 2;
    const bh = maxY - minY + pad * 2;
    if (bw < 12 || bh < 12) throw new Error("çok küçük");
    // Görsel "cover" ile yerleşir: ölçek ve kayma
    const isPhoto = object.kind === "photo";
    const inset = isPhoto ? 6 : 0;   // fotoğrafın beyaz çerçevesi
    const areaW = object.rect.w - inset * 2;
    const areaH = object.rect.h - inset * 2;
    const scale = Math.max(areaW / image.width, areaH / image.height);
    const drawW = image.width * scale;
    const drawH = image.height * scale;
    const offX = inset + (areaW - drawW) / 2;
    const offY = inset + (areaH - drawH) / 2;
    const pixelScale = 2;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bw * pixelScale);
    canvas.height = Math.round(bh * pixelScale);
    const ctx = canvas.getContext("2d");
    ctx.scale(pixelScale, pixelScale);
    ctx.translate(-minX + pad, -minY + pad);
    const trace = () => { ctx.beginPath(); ctx.moveTo(local[0][0], local[0][1]); for (const [x, y] of local) ctx.lineTo(x, y); ctx.closePath(); };
    // Beyaz çıkartma kenarı
    trace();
    ctx.lineJoin = "round";
    ctx.lineWidth = border * 2;
    ctx.strokeStyle = "#ffffff";
    ctx.stroke();
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    // Kırpılmış görsel
    ctx.save();
    trace();
    ctx.clip();
    ctx.drawImage(image, offX, offY, drawW, drawH);
    ctx.restore();
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    const asset = await store.importAsset(blob, "cutout.png");
    // Yeni nesne: yerel kutunun merkezini sayfa koordinatına geri döndür
    const lcx = minX - pad + bw / 2 - object.rect.w / 2;
    const lcy = minY - pad + bh / 2 - object.rect.h / 2;
    const rad2 = (object.rotation || 0) * Math.PI / 180;
    const pcx = cx + lcx * Math.cos(rad2) - lcy * Math.sin(rad2);
    const pcy = cy + lcx * Math.sin(rad2) + lcy * Math.cos(rad2);
    const sticker = { id: uid(), kind: "sticker", asset, rect: { x: pcx - bw / 2 + 18, y: pcy - bh / 2 + 18, w: bw, h: bh }, rotation: object.rotation || 0, z: maxZ(page) + 1 };
    store.updatePage(notebookId, page.id, (p) => { p.objects.push(sticker); });
    touchPage(page);
    selectedObjectId = sticker.id;
    setEditing(true);
    toast("Çıkartma kesildi; istersen fotoğrafı silebilirsin");
  }

  function centeredRect(page, w, hh) {
    const count = page.objects.length + page.covers.length;
    const shift = (count % 5) * 18;
    return { x: (page.size.w - w) / 2 + shift, y: (page.size.h - hh) / 2 + shift, w, h: hh };
  }

  async function importImage(kind) {
    const file = await pickFile("file-image");
    if (!file) return;
    const page = selectedPage();
    try {
      const { blob, width, height } = await shrinkImage(file, 1600);
      const asset = await store.importAsset(blob, file.name);
      const maxW = kind === "sticker" ? 180 : 300;
      const maxH = kind === "sticker" ? 180 : 380;
      let w = maxW;
      let hh = width > 0 ? maxW * height / width : maxW;
      if (hh > maxH) { w = maxH * w / hh; hh = maxH; }
      const object = { id: uid(), kind, asset, rect: centeredRect(page, w, hh), rotation: 0, z: maxZ(page) + 1 };
      store.updatePage(notebookId, page.id, (p) => { p.objects.push(object); });
      touchPage(page);
      selectedObjectId = object.id;
      setEditing(true);
    } catch (error) {
      toast("Görsel eklenemedi: " + error.message);
    }
  }

  function textMenu() {
    actionSheet("Yazı", [
      { title: "Yazı Kutusu (klavye ya da Apple Pencil)", onSelect: () => addText(false) },
      { title: "Yapılacaklar Listesi (onay kutulu)", onSelect: () => addText(true) },
      { title: "Onay Kutusu (el yazısının yanına)", onSelect: addCheckBox }
    ]);
  }

  function addCheckBox() {
    const page = selectedPage();
    const object = { id: uid(), kind: "check", checked: false, rect: centeredRect(page, 38, 38), rotation: 0, z: maxZ(page) + 1 };
    store.updatePage(notebookId, page.id, (p) => { p.objects.push(object); });
    touchPage(page);
    selectedObjectId = object.id;
    setEditing(true);
    toast("Kutuyu yazının yanına sürükle, sonra Bitti");
  }

  function addText(todo = false) {
    const page = selectedPage();
    const object = { id: uid(), kind: "text", todo, text: todo ? "[ ] " : "", font: TEXT_FONTS[1][0], size: 24, color: isInking() ? tool.color : "#1C1C1E", rect: centeredRect(page, 260, todo ? 140 : 90), rotation: 0, z: maxZ(page) + 1 };
    store.updatePage(notebookId, page.id, (p) => { p.objects.push(object); });
    selectedObjectId = object.id;
    editingTextId = object.id;
    setEditing(true);
  }

  function textStyleMenu(object, page) {
    const apply = (change) => {
      store.updatePage(notebookId, page.id, (p) => { const o = p.objects.find((x) => x.id === object.id); if (o) Object.assign(o, change); });
      Object.assign(object, change);
      touchPage(page);
      renderStage();
      setEditing(true);
      selectedObjectId = object.id;
      renderStage();
    };
    const fonts = h("div", { class: "fav-grid" });
    for (const [family, name] of TEXT_FONTS) {
      fonts.append(h("button", { class: "fav-cell" + (object.font === family ? " selected" : ""), type: "button", style: { fontFamily: family, fontSize: "20px" }, onTap: () => apply({ font: family }) }, name));
    }
    const sizeValue = h("span", { class: "value" }, (object.size || 24) + " px");
    openModal(h("div", { class: "dialog", style: { color: "rgba(255,255,255,0.85)" } },
      h("h3", { style: { color: "#fff" } }, "Yazı tipi"),
      h("div", { class: "note", style: { color: "rgba(255,255,255,0.5)" } }, "Yazıyı Apple Pencil ile kutuya yazarsan iPad (Scribble) onu metne çevirir."),
      fonts,
      h("div", { class: "panel-row" }, h("label", {}, "Boyut"), h("input", { type: "range", min: "12", max: "72", step: "2", value: String(object.size || 24), "aria-label": "Yazı boyutu",
        onInput: (e) => { sizeValue.textContent = e.target.value + " px"; }, onChange: (e) => apply({ size: Number(e.target.value) }) }), sizeValue),
      h("div", { class: "panel-row" }, h("label", {}, "Renk"), h("div", { class: "color-input" }, h("input", { type: "color", value: /^#[0-9a-f]{6}$/i.test(object.color || "") ? object.color : "#1c1c1e", "aria-label": "Yazı rengi", onChange: (e) => apply({ color: e.target.value.toUpperCase() }) }))),
      h("div", { class: "dialog-buttons" }, h("button", { class: "btn primary", type: "button", onTap: closeModal }, "Tamam"))
    ), { dark: true });
  }

  /** Panodaki çizgileri/nesneleri seçili sayfanın ortasına yapıştırır. */
  function pasteClipboard() {
    const page = selectedPage();
    if (clipboard.strokes.length) {
      const ink = inks.get(page.id);
      if (!ink) return;
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const s of clipboard.strokes) for (const p of s.points) { minX = Math.min(minX, p[0]); minY = Math.min(minY, p[1]); maxX = Math.max(maxX, p[0]); maxY = Math.max(maxY, p[1]); }
      const dx = page.size.w / 2 - (minX + maxX) / 2;
      const dy = page.size.h / 2 - (minY + maxY) / 2;
      ink.pushHistory();
      const copies = clipboard.strokes.map((s) => ({ ...s, id: uid(), points: s.points.map(([x, y, p]) => [Math.round((x + dx) * 10) / 10, Math.round((y + dy) * 10) / 10, p]) }));
      page.strokes.push(...copies);
      ink.selection = { ids: new Set(copies.map((c) => c.id)) };
      ink.redraw();
      ink.commit();
      tool.tool = "lasso";
      renderBench();
      renderSelection(stage.querySelector(`.page-stack[data-page="${page.id}"]`) || [...stage.querySelectorAll(".page-stack")].find((st) => st._pageId === page.id), page, ink.selectionBounds());
    } else if (clipboard.objects.length) {
      const copies = clipboard.objects.map((o) => { const c = structuredClone(o); c.id = uid(); c.rect = centeredRect(page, o.rect.w, o.rect.h); c.z = maxZ(page) + 1; return c; });
      store.updatePage(notebookId, page.id, (p) => { p.objects.push(...copies); });
      touchPage(page);
      selectedObjectId = copies[copies.length - 1].id;
      setEditing(true);
    }
  }

  function addPlainPostIt(tint) {
    const page = selectedPage();
    const object = { id: uid(), kind: "postit", tint, rect: centeredRect(page, 200, 170), rotation: Math.round((Math.random() * 6 - 3) * 10) / 10, z: maxZ(page) + 1 };
    store.updatePage(notebookId, page.id, (p) => { p.objects.push(object); });
    touchPage(page);
    selectedObjectId = object.id;
    setEditing(true);
  }

  function addTape(tint, pattern) {
    const page = selectedPage();
    const object = { id: uid(), kind: "tape", tint, pattern, assetName: "", rect: centeredRect(page, 220, 34), rotation: Math.round((Math.random() * 16 - 8) * 10) / 10, z: maxZ(page) + 1 };
    store.updatePage(notebookId, page.id, (p) => { p.objects.push(object); });
    touchPage(page);
    selectedObjectId = object.id;
    setEditing(true);
  }

  function addEmojiSticker(emoji) {
    const page = selectedPage();
    const object = { id: uid(), kind: "text", text: emoji, font: "-apple-system, 'Apple Color Emoji', 'Segoe UI Emoji', sans-serif", size: 64, color: "#000000", rect: centeredRect(page, 96, 96), rotation: Math.round((Math.random() * 20 - 10) * 10) / 10, z: maxZ(page) + 1 };
    store.updatePage(notebookId, page.id, (p) => { p.objects.push(object); });
    touchPage(page);
    selectedObjectId = object.id;
    setEditing(true);
  }

  function addFrostedPostIt(tint) {
    const page = selectedPage();
    const cover = { id: uid(), style: "postit", rect: centeredRect(page, 220, 150), rotation: 0, tint, tintOpacity: 0.55, blur: store.settings.frosted.blur, revealOnTap: true };
    store.updatePage(notebookId, page.id, (p) => { p.covers.push(cover); });
    selectedObjectId = cover.id;
    setEditing(true);
  }

  // ---------- örtüler (buzlu şerit / buzlu post-it) ----------

  function renderCovers(layer, page, stack) {
    layer.replaceChildren();
    layer.classList.toggle("capture", isFrosted() && !editingObjects);
    for (const cover of page.covers) {
      const el = h("div", { class: `cover-mark ${cover.style === "band" ? "band" : "postit"}` + (cover.id === selectedObjectId && editingObjects ? " selected" : "") + (layer.classList.contains("static") ? " static" : ""),
        style: { "--tint": cover.tint, "--tint-opacity": String(cover.tintOpacity), "--blur": cover.blur + "px" },
        role: "button", "aria-label": "Cevap gizli, açmak için dokun" });
      el.append(frostInner(cover, page), h("div", { class: "frost-tint" }));
      el._coverId = cover.id;
      placeItem(el, cover);
      if (editingObjects) {
        makeTransformable(el, cover, stack, page, (rect, rotation) => {
          store.updatePage(notebookId, page.id, (p) => { const c = p.covers.find((x) => x.id === cover.id); if (c) { c.rect = rect; c.rotation = rotation; } });
          placeItem(el, cover);
          const inner = el.querySelector(".frost-inner");
          if (inner) inner.replaceWith(frostInner(cover, page));
        }, () => { selectedObjectId = cover.id; renderCovers(layer, page, stack); renderObjects(stack._layers.objectsLayer, page, stack); renderBanner(); });
        if (cover.id === selectedObjectId) {
          addHandles(el);
          layer.append(objectMenu(cover, page, {
            rotate: () => store.updatePage(notebookId, page.id, (p) => { const c = p.covers.find((x) => x.id === cover.id); if (c) c.rotation = (c.rotation + 90) % 360; }),
            duplicate: () => store.updatePage(notebookId, page.id, (p) => { const c = p.covers.find((x) => x.id === cover.id); if (!c) return; const copy = structuredClone(c); copy.id = uid(); copy.rect = { ...c.rect, x: c.rect.x + 24, y: c.rect.y + 24 }; p.covers.push(copy); selectedObjectId = copy.id; }),
            front: () => store.updatePage(notebookId, page.id, (p) => { const i = p.covers.findIndex((x) => x.id === cover.id); if (i >= 0) p.covers.push(p.covers.splice(i, 1)[0]); }),
            remove: () => { store.updatePage(notebookId, page.id, (p) => { p.covers = p.covers.filter((x) => x.id !== cover.id); }); selectedObjectId = null; }
          }, () => { renderCovers(layer, page, stack); renderBanner(); }));
        }
      } else {
        pressable(el, {
          onTap: () => {
            if (!cover.revealOnTap) return;
            el.classList.toggle("revealed");
            el.setAttribute("aria-label", el.classList.contains("revealed") ? "Cevap açık" : "Cevap gizli, açmak için dokun");
          },
          onLong: () => coverMenu(cover, page)
        });
        el.addEventListener("pointerdown", (e) => e.stopPropagation());
      }
      layer.append(el);
    }
    if (page.covers.length) refreshFrost(stack, page);
    if (!editingObjects) attachBandGesture(layer, page, stack);
    else layer.addEventListener("pointerdown", (e) => { if (e.target === layer) { selectedObjectId = null; renderCovers(layer, page, stack); renderObjects(stack._layers.objectsLayer, page, stack); renderBanner(); } });
  }

  /** Örtünün altındaki bulanık sayfa kesiti: sayfa görseli örtünün içine ters kaydırılıp ters döndürülür. */
  function frostInner(cover, page) {
    const inner = h("div", { class: "frost-inner" });
    inner.style.width = page.size.w + "px";
    inner.style.height = page.size.h + "px";
    inner.style.left = -cover.rect.x + "px";
    inner.style.top = -cover.rect.y + "px";
    inner.style.transformOrigin = `${cover.rect.x + cover.rect.w / 2}px ${cover.rect.y + cover.rect.h / 2}px`;
    inner.style.transform = `rotate(${-(cover.rotation || 0)}deg)`;
    const cached = snapshots.get(page.id);
    if (cached && cached.url) inner.style.backgroundImage = `url("${cached.url}")`;
    else inner.style.backgroundColor = PAPER_COLOR;
    return inner;
  }

  /** Uzun basınca: örtüyü sil ya da düzenleme kipine geç. */
  function coverMenu(cover, page) {
    actionSheet(cover.style === "band" ? "Buzlu şerit" : "Buzlu post-it", [
      { title: "Bulanıklığı Ayarla", onSelect: () => coverBlurDialog(cover, page) },
      { title: "Taşı / Düzenle", onSelect: () => { selectedObjectId = cover.id; setEditing(true); } },
      { title: "Sil", destructive: true, onSelect: () => {
        store.updatePage(notebookId, page.id, (p) => { p.covers = p.covers.filter((c) => c.id !== cover.id); });
        renderStage();
      } }
    ]);
  }

  /** Tek bir örtünün bulanıklığı ve renk yoğunluğu; canlı olarak uygulanır. */
  function coverBlurDialog(cover, page) {
    const apply = () => {
      store.updatePage(notebookId, page.id, (p) => { const c = p.covers.find((x) => x.id === cover.id); if (c) { c.blur = cover.blur; c.tintOpacity = cover.tintOpacity; } });
      for (const el of stage.querySelectorAll(".cover-mark")) {
        if (el._coverId === cover.id) { el.style.setProperty("--blur", cover.blur + "px"); el.style.setProperty("--tint-opacity", String(cover.tintOpacity)); }
      }
    };
    const blurValue = h("span", { class: "value" }, cover.blur + " px");
    const tintValue = h("span", { class: "value" }, Math.round(cover.tintOpacity * 100) + "%");
    openModal(h("div", { class: "dialog", style: { color: "rgba(255,255,255,0.85)" } },
      h("h3", { style: { color: "#fff" } }, "Bulanıklık"),
      h("div", { class: "panel-row" }, h("label", {}, "Bulanıklık"), h("input", { type: "range", min: "0", max: "30", step: "1", value: String(cover.blur), "aria-label": "Bulanıklık",
        onInput: (e) => { cover.blur = Number(e.target.value); blurValue.textContent = cover.blur + " px"; apply(); } }), blurValue),
      h("div", { class: "panel-row" }, h("label", {}, "Renk yoğunluğu"), h("input", { type: "range", min: "0", max: "100", step: "5", value: String(Math.round(cover.tintOpacity * 100)), "aria-label": "Renk yoğunluğu",
        onInput: (e) => { cover.tintOpacity = Number(e.target.value) / 100; tintValue.textContent = e.target.value + "%"; apply(); } }), tintValue),
      h("div", { class: "note", style: { color: "rgba(255,255,255,0.5)" } }, "0 px bulanıklık: altı tamamen görünür; renk yoğunluğu %100: altı hiç görünmez."),
      h("div", { class: "dialog-buttons" }, h("button", { class: "btn primary", type: "button", onTap: closeModal }, "Tamam"))
    ), { dark: true });
  }

  function attachBandGesture(layer, page, stack) {
    let session = null;
    const settings = () => store.settings.frosted;
    const bandFor = (a, b) => {
      const dx = b.x - a.x, dy = b.y - a.y;
      const length = Math.hypot(dx, dy);
      if (length < 8) return null;
      const t = settings().thickness;
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      return { id: uid(), style: "band", rect: { x: mid.x - (length + t) / 2, y: mid.y - t / 2, w: length + t, h: t }, rotation: Math.atan2(dy, dx) * 180 / Math.PI, tint: "#E9EDF3", tintOpacity: 0.45, blur: settings().blur, revealOnTap: settings().revealOnTap };
    };
    layer.addEventListener("pointerdown", (e) => {
      if (!isFrosted() || editingObjects || e.target !== layer) return;
      if (e.pointerType === "touch" && store.settings.pencilOnly) return;
      e.preventDefault();
      try { layer.setPointerCapture(e.pointerId); } catch (_) { /* sentetik olay */ }
      session = { pointerId: e.pointerId, start: toPageCoords(e, stack, page) };
      liveBand = h("div", { class: "live-band" });
      layer.append(liveBand);
    });
    layer.addEventListener("pointermove", (e) => {
      if (!session || e.pointerId !== session.pointerId) return;
      const band = bandFor(session.start, toPageCoords(e, stack, page));
      if (band && liveBand) placeItem(liveBand, band);
    });
    const end = (e) => {
      if (!session || e.pointerId !== session.pointerId) return;
      const band = bandFor(session.start, toPageCoords(e, stack, page));
      session = null;
      if (liveBand) { liveBand.remove(); liveBand = null; }
      if (band) {
        store.updatePage(notebookId, page.id, (p) => { p.covers.push(band); });
        renderCovers(layer, page, stack);
      }
    };
    layer.addEventListener("pointerup", end);
    layer.addEventListener("pointercancel", end);
  }

  // ---------- tezgah ----------

  function penMatches(pen) {
    return pen.tool === tool.tool && pen.color.toUpperCase() === tool.color.toUpperCase() && Math.abs(pen.width - tool.width) < 0.01;
  }

  function isInking() {
    return tool.tool === "pen" || tool.tool === "pencil" || tool.tool === "highlighter" || tool.tool === "fineliner";
  }

  function usesColor() {
    return isInking() || tool.tool === "shape";
  }

  function isPenTool() {
    return tool.tool === "pen" || tool.tool === "pencil" || tool.tool === "fineliner";
  }

  function groupOf(name) {
    return name === "highlighter" ? "highlighter" : "pen";
  }

  /** Araç seçimi: kalem/fosforlu grupları kendi kalınlık ve rengini hatırlar. */
  function selectTool(name) {
    if (isInking()) toolMemory[groupOf(tool.tool)] = { ...tool };
    if (name === "pen" || name === "highlighter") {
      const saved = toolMemory[groupOf(name)];
      if (saved) tool = { ...saved };
      else tool = { tool: name, color: tool.color, width: name === "highlighter" ? 14 : (tool.width > 10 ? 3 : tool.width), alpha: 1 };
      if (name === "pen" && tool.tool === "highlighter") tool.tool = "pen";
      lastPen = { ...tool };
    } else if (name === "shape") {
      tool.tool = "shape";
      tool.shape = tool.shape || "line";
      if (tool.width > 10) tool.width = 3;
    } else {
      tool.tool = name;
    }
    if (name !== "lasso") clearSelections();
    if (editingObjects && name !== "image") setEditing(false);
    renderBench();
    renderTopbar();
    applyModes();
  }

  function renderBench() {
    const s = store.settings;
    const collapsed = !!s.benchCollapsed;
    const current = usesColor() ? tool.color.toUpperCase() : null;
    // Renk hapı = favori kalemler: dokun → o kalem; seçiliye tekrar dokun → ayarlar; uzun bas → düzenle.
    const pill = h("div", { class: "palette-pill", role: "group", "aria-label": "Favori kalemler" });
    pill.append(h("button", { class: "swatch heart", type: "button", "aria-label": "Favori kalemler listesi", onTap: openFavoritesPanel }, svgIcon("heart", 18)));
    for (const pen of s.pens) {
      const selected = penMatches(pen);
      const sw = h("button", { class: `swatch ${pen.tool}` + (selected ? " selected" : ""), type: "button", style: { "--c": pen.color }, "aria-label": pen.name + (selected ? ", tekrar dokun: kalem ayarları" : "") + ", uzun bas: düzenle" });
      pressable(sw, {
        onTap: () => { if (selected) openPenPanel(); else panelCtx.applyPen(pen); },
        onLong: () => penMenu(pen)
      });
      pill.append(sw);
    }
    if (usesColor() && !s.pens.some((p) => penMatches(p))) {
      pill.append(h("button", { class: "swatch current", type: "button", style: { "--c": tool.color }, "aria-label": "Şu anki kalem favori değil; dokun: favorilere ekle", onTap: addCurrentToFavorites }, svgIcon("plus", 14)));
    }

    const tb = (icon, label, active, onTap, extra = "") => h("button", { class: "tb-btn" + (active ? " active" : "") + (extra ? " " + extra : ""), type: "button", "aria-label": label, "aria-pressed": String(!!active), onTap }, svgIcon(icon, 24));
    const sep = () => h("div", { class: "tb-sep" });
    const toolbar = h("div", { class: "toolbar" + (collapsed ? " collapsed" : "") });
    toolbar.append(tb("grid", "Sayfalar", false, () => { flushInk(); navigate(`#/n/${notebookId}/pages?p=${selectedPageId}`); }));
    if (!collapsed) {
      toolbar.append(...[sep(),
        tb("pen", isPenTool() ? "Kalem ayarları" : "Kalem", isPenTool(), () => { if (isPenTool()) openPenPanel(); else selectTool("pen"); }),
        tb("eraser", tool.tool === "eraser" ? "Silgi ayarları" : "Silgi", tool.tool === "eraser", () => { if (tool.tool === "eraser") openEraserPanel(); else selectTool("eraser"); }),
        tb("highlighter", tool.tool === "highlighter" ? "Fosforlu ayarları" : "Fosforlu", tool.tool === "highlighter", () => { if (tool.tool === "highlighter") openPenPanel(); else selectTool("highlighter"); }),
        tb("lasso", "Seçim (kement)", tool.tool === "lasso", () => { if (tool.tool === "lasso") { if (activeInk && activeInk.selectionBounds()) { const stack = stage.querySelector(".page-stack:not(.static)"); openSelectionPanel(activeInk, stack, pages().find((p) => inks.get(p.id) === activeInk)); } else toast("Seçmek için çizginin çevresini kementle çiz"); } else selectTool("lasso"); }),
        tb("ruler", ruler ? "Şekiller ve cetvel" : "Cetvel", !!ruler, () => { if (ruler) openShapesPanel(); else toggleRuler(); }),
        tb("shapes", "Şekiller", tool.tool === "shape", () => { if (tool.tool !== "shape") selectTool("shape"); openShapesPanel(); }),
        tb("photo", "Fotoğraf, çıkartma, post-it", editingObjects || isFrosted(), imageMenu),
        tb("text", "Yazı, yapılacaklar listesi, onay kutusu", false, textMenu),
        tb("mic", recording ? "Kaydı durdur" : "Sesli not", !!recording, toggleAudioNote, recording ? "recording" : ""),
        (clipboard.strokes.length || clipboard.objects.length) ? tb("copy", "Yapıştır", false, pasteClipboard) : false,
        sep(),
        Object.assign(tb("undo", "Geri al", false, () => activeInk && activeInk.undo()), { disabled: !(activeInk && activeInk.canUndo) }),
        Object.assign(tb("redo", "İleri al", false, () => activeInk && activeInk.redo()), { disabled: !(activeInk && activeInk.canRedo) })].filter(Boolean));
    }
    toolbar.append(tb(collapsed ? "up" : "down", collapsed ? "Araçları göster" : "Araçları gizle", false, () => { store.setSetting("benchCollapsed", !collapsed); renderBench(); }, "tb-collapse"));
    bench.replaceChildren(pill, toolbar);
  }

  function imageMenu() {
    actionSheet("Ekle", [
      { title: "Fotoğraf Ekle", onSelect: () => importImage("photo") },
      { title: "Çıkartma, Post-it, Bant", onSelect: openStickerPanel },
      { title: "Yapılacaklar Listesi", onSelect: () => addText(true) },
      { title: "Onay Kutusu", onSelect: addCheckBox },
      { title: isFrosted() ? "\u2713 Buzlu Kalem (kapat)" : "Buzlu Kalem (cevabı örter)", onSelect: () => { if (isFrosted()) selectTool("pen"); else { selectTool("frosted"); openFrostedPanel(); } } },
      { title: editingObjects ? "Düzenlemeyi Bitir" : "Nesneleri Düzenle (taşı, döndür, kes)", onSelect: () => setEditing(!editingObjects) },
      (clipboard.strokes.length || clipboard.objects.length) ? { title: "Yapıştır", onSelect: pasteClipboard } : null
    ].filter(Boolean));
  }

  function formatDuration(seconds) {
    const s = Math.max(0, Math.round(seconds));
    return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
  }

  /** Sesli not: mikrofona dokun → kayıt; tekrar dokun → sayfaya oynatılabilir bir not düşer. */
  async function toggleAudioNote() {
    if (recording) { recording.stop(); return; }
    if (!navigator.mediaDevices || !window.MediaRecorder) { toast("Bu tarayıcıda ses kaydı desteklenmiyor"); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      const chunks = [];
      const startedAt = Date.now();
      rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        recording = null;
        renderBench();
        const blob = new Blob(chunks, { type: rec.mimeType || "audio/webm" });
        if (!blob.size) { toast("Kayıt boş kaldı"); return; }
        const asset = await store.importAsset(blob, "sesli-not." + (blob.type.includes("mp4") ? "m4a" : "webm"));
        const page = selectedPage();
        const object = { id: uid(), kind: "audio", asset, rect: centeredRect(page, 190, 48), rotation: 0, z: maxZ(page) + 1, duration: Math.round((Date.now() - startedAt) / 1000) };
        store.updatePage(notebookId, page.id, (p) => { p.objects.push(object); });
        touchPage(page);
        renderStage();
        toast("Sesli not sayfaya eklendi");
      };
      rec.start();
      recording = rec;
      renderBench();
      toast("Kayıt başladı; durdurmak için mikrofona tekrar dokun");
    } catch (error) {
      toast("Mikrofon açılamadı: " + error.message);
    }
  }

  // ---------- paneller (tasarım: sol kenar kartları) ----------

  const panelCtx = {
    store,
    tool: () => tool,
    setTool: (patch) => {
      if (patch.tool && patch.tool !== tool.tool) { tool.tool = patch.tool; delete patch.tool; }
      Object.assign(tool, patch);
      if (isInking()) { lastPen = { ...tool }; toolMemory[groupOf(tool.tool)] = { ...tool }; }
      renderBench();
      applyModes();
    },
    setColor: (hex, alpha) => {
      if (!usesColor()) selectTool("pen");
      tool.color = hex;
      if (alpha != null) tool.alpha = alpha;
      if (isInking()) { lastPen = { ...tool }; toolMemory[groupOf(tool.tool)] = { ...tool }; }
      renderBench();
    },
    openColor: (opts) => openColorPanel(opts),
    openFavorites: () => openFavoritesPanel(),
    addFavorite: () => addCurrentToFavorites(),
    applyPen: (pen) => { tool = { tool: pen.tool, color: pen.color, width: pen.width, alpha: 1 }; lastPen = { ...tool }; toolMemory[groupOf(pen.tool)] = { ...tool }; clearSelections(); renderBench(); renderTopbar(); applyModes(); },
    penMatches,
    penIllustration,
    ruler: { active: () => !!ruler, toggle: () => toggleRuler(), refresh: () => refreshRulers() },
    selection: null,
    clearPage: () => confirmDialog("Sayfadaki her şey silinsin mi?", "Bu sayfadaki bütün çizgiler silinir; Geri al ile geri getirilebilir.", "Sil", () => { const ink = inks.get(selectedPageId); if (ink) ink.clearPage(); }),
    rerender: () => renderBench(),
    close: () => closePopover()
  };

  function mountPanel(el, kind) {
    closePopover();
    el.dataset.kind = kind;
    popover = el;
    screen.append(el);
  }

  function openPenPanel() { if (!isInking()) selectTool("pen"); mountPanel(penPanel(panelCtx), "pen"); }
  function openEraserPanel() { mountPanel(eraserPanel(panelCtx), "eraser"); }
  function openShapesPanel() { mountPanel(shapesPanel(panelCtx), "shapes"); }
  function openFavoritesPanel() { mountPanel(favoritesPanel(panelCtx), "favorites"); }
  function openColorPanel(opts) { mountPanel(colorPanel(panelCtx, opts || {}), "color"); }
  function openSelectionPanel(ink, stack, page) {
    panelCtx.selection = {
      copy: () => { clipboard.strokes = ink.selectedStrokes().map((s) => structuredClone(s)); clipboard.objects = []; toast("Panoya kopyalandı; Yapıştır ile başka sayfaya koy"); renderBench(); },
      duplicate: () => ink.duplicateSelection(),
      cut: () => { clipboard.strokes = ink.selectedStrokes().map((s) => structuredClone(s)); clipboard.objects = []; ink.deleteSelection(); toast("Kesildi; Yapıştır ile başka yere koy"); renderBench(); },
      recolor: (hex) => ink.recolorSelection(hex),
      front: () => { ink.bringSelectionFront(); toast("Öne alındı"); },
      back: () => { ink.sendSelectionBack(); toast("Arkaya gönderildi"); },
      remove: () => ink.deleteSelection()
    };
    const el = selectionPanel(panelCtx);
    mountPanel(el, "selection");
    el._ink = ink;
  }

  /** Seçili kalem hiçbir favoriyle eşleşmiyorsa: onu gösteren kalem + "favorilere ekle". */
  function currentPenIndicator() {
    const current = { tool: tool.tool, color: tool.color, width: tool.width, name: "Şu an" };
    const shown = h("button", { class: "pen-btn selected current", type: "button", "aria-label": `Şu anki kalem: ${TOOLS[tool.tool].title}, ${formatPt(tool.width)} pt. Dokun: ayarlar` },
      penIllustration(current), h("span", { class: "tool-caption" }, "Şu an"));
    pressable(shown, { onTap: () => openPenPanel() });
    const add = h("button", { class: "tool-btn add-fav", type: "button", "aria-label": "Bu kalemi favorilere ekle", onTap: addCurrentToFavorites }, svgIcon("heart", 20), h("span", { class: "tool-caption" }, "Favori"));
    return [shown, add, h("div", { class: "bench-sep" })];
  }

  function addCurrentToFavorites() {
    if (!usesColor()) { toast("Önce bir kalem seç"); return; }
    store.addPen({ tool: tool.tool === "shape" ? "pen" : tool.tool, color: tool.color, width: tool.width, name: autoPenName() });
    toast("Favorilere eklendi");
    renderBench();
    renderTopbar();
  }

  /** Otomatik ad: araç + kalınlık; aynı ad varsa numara eklenir. Uzun basıp değiştirilebilir. */
  function autoPenName() {
    const base = `${(TOOLS[tool.tool === "shape" ? "pen" : tool.tool] || TOOLS.pen).title} ${formatPt(tool.width)}`;
    const names = new Set(store.settings.pens.map((p) => p.name));
    if (!names.has(base)) return base;
    let n = 2;
    while (names.has(`${base} (${n})`)) n++;
    return `${base} (${n})`;
  }

  /** Paletteki bir rengi değiştir, taşı, çıkar. */
  function paletteColorMenu(hex) {
    const s = store.settings;
    const index = s.palette.findIndex((c) => c.toUpperCase() === hex.toUpperCase());
    const picker = h("input", { type: "color", value: /^#[0-9a-f]{6}$/i.test(hex) ? hex : "#000000", "aria-label": "Yeni renk",
      onChange: (e) => { store.replacePaletteColor(hex, e.target.value); if (tool.color.toUpperCase() === hex.toUpperCase()) tool.color = e.target.value.toUpperCase(); renderBench(); renderTopbar(); } });
    picker.style.position = "fixed"; picker.style.opacity = "0"; picker.style.pointerEvents = "none";
    actionSheet("Renk " + hex, [
      { title: "Rengi Değiştir...", onSelect: () => { document.body.append(picker); picker.click(); setTimeout(() => picker.remove(), 60000); } },
      { title: "Sola Taşı", disabled: index <= 0, onSelect: () => { store.movePaletteColor(hex, -1); renderBench(); } },
      { title: "Sağa Taşı", disabled: index >= s.palette.length - 1, onSelect: () => { store.movePaletteColor(hex, 1); renderBench(); } },
      { title: "Paletten Çıkar", destructive: true, disabled: s.palette.length <= 1, onSelect: () => { store.removePaletteColor(hex); renderBench(); } }
    ]);
  }

  /** Favori kalemi düzenle: ayarlar, ad, sıra, varsayılan, sil. */
  function penMenu(pen) {
    const s = store.settings;
    const index = s.pens.findIndex((p) => p.id === pen.id);
    actionSheet(pen.name, [
      { title: "Kalem Ayarları", onSelect: () => { tool = { tool: pen.tool, color: pen.color, width: pen.width }; lastPen = { ...tool }; renderBench(); renderTopbar(); applyModes(); openPenPanel(); } },
      { title: "Yeniden Adlandır", onSelect: () => promptDialog("Kalem adı", "Ad", pen.name, (name) => { store.updatePen(pen.id, { name }); renderBench(); renderTopbar(); }) },
      { title: "Sola Taşı", disabled: index <= 0, onSelect: () => { store.movePen(pen.id, -1); renderBench(); renderTopbar(); } },
      { title: "Sağa Taşı", disabled: index >= s.pens.length - 1, onSelect: () => { store.movePen(pen.id, 1); renderBench(); renderTopbar(); } },
      { title: pen.id === s.defaultPenId ? "\u2713 Varsayılan kalem" : "Varsayılan Yap", onSelect: () => { store.setSetting("defaultPenId", pen.id); renderBench(); } },
      { title: "Sil", destructive: true, disabled: s.pens.length <= 1, onSelect: () => { store.removePen(pen.id); renderBench(); renderTopbar(); } }
    ]);
  }

  function toolButton(name, icon, label, caption) {
    const selected = tool.tool === name;
    return h("button", { class: "tool-btn" + (selected ? " selected" : ""), type: "button", "aria-label": label, "aria-pressed": String(selected),
      onTap: () => { tool.tool = name; clearSelections(); renderBench(); renderTopbar(); applyModes(); } }, icon, h("span", { class: "tool-caption" }, caption || label));
  }

  function clearSelections() {
    for (const ink of inks.values()) ink.clearSelection();
  }

  function photoMenu() {
    actionSheet("Fotoğraf ve nesneler", [
      { title: "Fotoğraf Ekle", onSelect: () => importImage("photo") },
      { title: "Çıkartma Ekle (kendi görselin)", onSelect: () => importImage("sticker") },
      { title: editingObjects ? "Düzenlemeyi Bitir" : "Nesneleri Düzenle", onSelect: () => setEditing(!editingObjects) }
    ]);
  }

  // ---------- kalem paneli (07-KalemPaneli.png) ----------

  function closePopover() {
    if (popover) { popover.remove(); popover = null; }
  }

  // Panel açıkken başka bir yere dokununca kapanır (Kapat'a basmak gerekmez).
  const onOutsidePointer = (e) => {
    if (!popover) return;
    if (popover.contains(e.target)) return;
    if (e.target.closest && e.target.closest(".modal-backdrop")) return;
    if (popover.dataset.kind === "selection" && e.target.closest && e.target.closest(".layer-select")) return;
    closePopover();
  };
  document.addEventListener("pointerdown", onOutsidePointer, true);

  function renderBenchKeepPopover() {
    renderBench();
    applyModes();
  }

  function openFrostedPanel() {
    closePopover();
    const f = { ...store.settings.frosted };
    const save = () => store.setSetting("frosted", { ...f });
    const toggle = h("button", { class: "toggle" + (f.revealOnTap ? " on" : ""), type: "button", role: "switch", "aria-checked": String(f.revealOnTap),
      onTap: () => { f.revealOnTap = !f.revealOnTap; toggle.classList.toggle("on", f.revealOnTap); toggle.setAttribute("aria-checked", String(f.revealOnTap)); save(); } });
    popover = h("div", { class: "popover", role: "dialog", style: { width: "min(460px, calc(100vw - 32px))" } },
      h("div", { class: "panel-head" }, h("h3", {}, "Buzlu kalem"), h("span", { class: "panel-hint" }, "yazının üstüne çek")),
      h("div", { class: "panel-row" }, h("label", {}, "Bulanıklık"), h("input", { type: "range", min: "1", max: "24", step: "1", value: String(f.blur), "aria-label": "Bulanıklık", onInput: (e) => { f.blur = Number(e.target.value); save(); } })),
      h("div", { class: "panel-row" }, h("label", {}, "Şerit kalınlığı"), h("input", { type: "range", min: "12", max: "60", step: "2", value: String(f.thickness), "aria-label": "Şerit kalınlığı", onInput: (e) => { f.thickness = Number(e.target.value); save(); } })),
      h("div", { class: "default-row" }, h("div", {}, h("div", {}, "Dokununca açılsın"), h("div", { class: "sub" }, "Kapalıyken kalıcı bulanık kalır")), toggle),
      h("div", { style: { textAlign: "right", marginTop: "12px" } }, h("button", { class: "btn small", type: "button", style: { background: "rgba(255,255,255,0.1)", color: "#fff" }, onTap: closePopover }, "Kapat"))
    );
    popover.dataset.kind = "frosted";
    screen.append(popover);
  }

  // ---------- çıkartma / post-it paneli (08-CikartmaPaneli.png) ----------

  function openStickerPanel() {
    closePopover();
    const plain = [["Sarı", "#FFE566"], ["Pembe", "#FFB8CC"], ["Mavi", "#A9D3F5"], ["Yeşil", "#B4E6A8"], ["Turuncu", "#FFC48F"]];
    const frosted = [["Buzlu sarı", "#F6EEC2"], ["Buzlu pembe", "#F6CDD6"], ["Buzlu mavi", "#CBDFF0"], ["Buzlu gri", "#E3E3E7"], ["Buzlu yeşil", "#D2EAD0"]];
    let tab = "postit";
    const body = h("div");
    const tabs = h("div", { class: "segmented" });
    const build = () => {
      tabs.replaceChildren(...[["stickers", "Çıkartmalar"], ["postit", "Post-it"], ["tape", "Bant"], ["mine", "Çıkartmalarım"]].map(([k, t]) =>
        h("button", { type: "button", class: tab === k ? "active" : "", onTap: () => { tab = k; build(); } }, t)));
      if (tab === "postit") {
        const custom = h("input", { type: "color", value: "#FFE566", "aria-label": "Kendi rengim" });
        body.replaceChildren(
          h("div", { class: "sticker-section-title" }, "DÜZ POST-IT", h("span", {}, "üstüne yazı yazılabilir")),
          h("div", { class: "postit-grid" },
            ...plain.map(([name, hex]) => h("button", { class: "postit-cell", type: "button", onTap: () => { closeModal(); addPlainPostIt(hex); } }, h("div", { class: "paper", style: { "--tint": hex } }), name)),
            h("div", { class: "postit-cell" }, h("div", { class: "paper custom" }, h("div", { class: "color-input", style: { width: "44px", height: "44px" } }, custom), h("button", { class: "btn small primary", type: "button", onTap: () => { closeModal(); addPlainPostIt(custom.value.toUpperCase()); } }, "Ekle")), "Kendi rengim")),
          h("div", { class: "sticker-section-title" }, "BUZLU POST-IT", h("span", {}, "cevabı örter, dokununca açılır")),
          h("div", { class: "postit-grid" },
            ...frosted.map(([name, hex]) => h("button", { class: "postit-cell", type: "button", onTap: () => { closeModal(); addFrostedPostIt(hex); } }, h("div", { class: "paper frosted", style: { "--tint": hex } }), name))),
          h("div", { class: "info-box" }, svgIcon("hand", 18), h("span", {}, "Buzlu post-it'i cevabın üstüne koy. Altındaki yazı bulanık görünür; parmağınla dokununca açılır, tekrar dokununca kapanır."))
        );
      } else if (tab === "mine") {
        body.replaceChildren(
          h("div", { class: "sticker-section-title" }, "ÇIKARTMALARIM", h("span", {}, "kendi görsellerin; PNG'de saydamlık korunur")),
          h("div", { style: { display: "flex", gap: "12px" } },
            h("button", { class: "btn", type: "button", style: { background: "rgba(255,255,255,0.1)", color: "#fff" }, onTap: () => { closeModal(); importImage("sticker"); } }, "Görsel Seç")),
          h("div", { class: "note", style: { color: "rgba(255,255,255,0.5)" } }, "Eklenen çıkartma sayfaya yerleşir; sürükleyip döndürebilirsin.")
        );
      } else if (tab === "tape") {
        const tapes = [["Sarı", "#F5D76E", "plain"], ["Pembe", "#F4A7C0", "plain"], ["Mavi", "#8FC6F0", "plain"], ["Mint", "#9EDCC6", "plain"], ["Kraft", "#D3B482", "plain"],
          ["Çizgili", "#F4A7C0", "stripes"], ["Çizgili mavi", "#8FC6F0", "stripes"], ["Puantiyeli", "#F5D76E", "dots"], ["Puantiyeli mor", "#C9B6F2", "dots"], ["Pötikare", "#9EDCC6", "gingham"], ["Pötikare kırmızı", "#F08C8C", "gingham"]];
        const customTape = h("input", { type: "color", value: "#F5D76E", "aria-label": "Kendi bant rengim" });
        body.replaceChildren(
          h("div", { class: "sticker-section-title" }, "BANT", h("span", {}, "yarı saydam, yırtık uçlu; taşı, döndür, boyutla")),
          h("div", { class: "postit-grid" },
            ...tapes.map(([name, hex, pattern]) => h("button", { class: "postit-cell", type: "button", onTap: () => { closeModal(); addTape(hex, pattern); } },
              h("div", { class: "tape-preview " + pattern, style: { "--tint": hex } }, h("div", { class: "tape-body" })), name)),
            h("div", { class: "postit-cell" }, h("div", { class: "paper custom", style: { aspectRatio: "auto", height: "80px" } }, h("div", { class: "color-input", style: { width: "44px", height: "44px" } }, customTape), h("button", { class: "btn small primary", type: "button", onTap: () => { closeModal(); addTape(customTape.value.toUpperCase(), "plain"); } }, "Ekle")), "Kendi rengim")),
          h("div", { class: "info-box" }, svgIcon("hand", 18), h("span", {}, "Bant fotoğrafın köşesine yapıştırılır: fotoğrafı koy, bandı ekle, üstüne sürükle ve döndür."))
        );
      } else if (tab === "stickers") {
        const emojis = ["\u2B50", "\u2764\uFE0F", "\u2705", "\u274C", "\u2757", "\u2753", "\u{1F4CC}", "\u{1F4CD}", "\u{1F31F}", "\u{1F338}", "\u{1F33F}", "\u{1F340}", "\u{1F4A1}", "\u{1F525}", "\u{1F389}", "\u{1F3AF}", "\u{1F4DA}", "\u{1F4DD}", "\u{1F4C5}", "\u23F0", "\u{1F60A}", "\u{1F62D}", "\u{1F914}", "\u{1F44D}", "\u{1F449}", "\u2B06\uFE0F", "\u27A1\uFE0F", "\u{1F4B0}", "\u2615", "\u{1F35C}", "\u{1F3B5}", "\u{1F4F7}"];
        body.replaceChildren(
          h("div", { class: "sticker-section-title" }, "ÇIKARTMALAR", h("span", {}, "dokun: sayfaya eklenir; boyutunu ve açısını değiştirebilirsin")),
          h("div", { class: "emoji-grid" }, ...emojis.map((e) => h("button", { class: "emoji-cell", type: "button", "aria-label": "Çıkartma " + e, onTap: () => { closeModal(); addEmojiSticker(e); } }, e))),
          h("div", { class: "info-box" }, svgIcon("photo", 18), h("span", {}, "Kendi görsellerinden çıkartma yapmak için \"Çıkartmalarım\" sekmesi; fotoğrafı kesip çıkartma yapmak için Nesneleri düzenle → Kes."))
        );
      } else {
        body.replaceChildren(h("div", { class: "info-box", style: { marginTop: "30px", flexDirection: "column", alignItems: "center", textAlign: "center", padding: "40px 20px" } },
          svgIcon(tab === "stickers" ? "star" : "note", 36),
          h("div", { style: { fontSize: "17px", fontWeight: "600", color: "#fff" } }, tab === "stickers" ? "Hazır çıkartmalar yakında" : "Hazır bantlar yakında"),
          h("div", {}, tab === "stickers" ? "Şimdilik kendi görsellerini \"Çıkartmalarım\" sekmesinden ekleyebilirsin." : "Şimdilik bant yerine düz post-it ya da kendi görselini kullanabilirsin."),
          h("button", { class: "btn primary small", type: "button", onTap: () => { tab = "mine"; build(); } }, "Çıkartmalarım'a git")));
      }
    };
    build();
    openModal(h("div", { class: "sticker-panel" },
      h("div", { class: "sticker-head" }, tabs, h("button", { class: "btn ghost", type: "button", style: { color: "#8c85f5", fontWeight: "700" }, onTap: closeModal }, "Bitti")),
      body), { dark: true, wide: true });
  }

  function toHex6(color) {
    return /^#[0-9a-f]{6}$/i.test(color) ? color : "#1c1c1e";
  }

  // ---------- yaşam döngüsü ----------

  function flushInk() {
    store.flush();
  }

  const resizeObserver = new ResizeObserver(() => fit());
  resizeObserver.observe(editorBody);
  attachEditorGestures(editorBody, {
    acceptsMouse: (e) => !e.target.closest(".page-stack") && !e.target.closest(".mode-banner"),
    getZoom: () => zoom,
    getPan: () => pan,
    setZoom: (z, p) => { zoom = z; pan = p; applyTransform(); },
    beginFlip: (dir) => {
      if (editingObjects || flip.active) return false;
      ensureNextPage(dir);
      if (!flipTargetId(dir)) return false;
      flipDir = dir;
      return flip.begin(dir);
    },
    flipWidth: () => flip.sheetWidth * fitScale * zoom,
    updateFlip: (progress) => flip.update(progress),
    endFlip: (commit) => {
      const target = flipTargetId(flipDir);
      flip.finish(commit, (committed) => { if (committed && target) selectPage(target); });
    }
  });
  const onSettings = (e) => { if (e.detail && ["pens", "palette", "defaultPenId", "benchCollapsed"].includes(e.detail.key)) renderBenchKeepPopover(); };
  store.addEventListener("settings", onSettings);
  const onKey = (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") { e.preventDefault(); if (e.shiftKey) activeInk && activeInk.redo(); else activeInk && activeInk.undo(); }
  };
  window.addEventListener("keydown", onKey);

  rememberOpen(notebookId, selectedPageId);
  renderStage();
  renderBench();
  applyModes();

  return {
    destroy() {
      resizeObserver.disconnect();
      store.removeEventListener("settings", onSettings);
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onOutsidePointer, true);
      closePopover();
      if (recording) { try { recording.stop(); } catch (_) { /* yok sayılır */ } }
      flip.cancel();
      flushInk();
    }
  };
}
