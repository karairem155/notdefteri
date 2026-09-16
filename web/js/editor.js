// Editör (05-NotEditoru.png, 04-CiftSayfa.png). Lacivert masa, krem kağıt, altta koyu tezgah.
// Sayfa katmanları (alttan üste): şablon → nesneler (fotoğraf/çıkartma/post-it) → çizim → örtüler.
// Kipler: çizim / buzlu kalem (örtü katmanı çizgiyi buzlu şerit yapar) / nesne düzenleme.
import { store, TOOLS, uid } from "./store.js";
import { h, svgIcon, iconButton, openModal, closeModal, actionSheet, promptDialog, confirmDialog, toast, pickFile, formatPt, pressable } from "./ui.js";
import { renderBackground, paintPaper, drawImageURL, pdfPageImage, pdfTextLines, PAPER_COLOR } from "./paper.js";
import { InkCanvas, drawStroke, renderStrokesToDataURL, orderForDrawing } from "./ink.js";
import { openAddPageSheet, shrinkImage } from "./addpage.js";
import { createFlip } from "./flip.js";
import { attachEditorGestures } from "./gestures.js";
import { navigate } from "./app.js";

const SVG_NS = "http://www.w3.org/2000/svg";

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
  let tool = { tool: defaultPen.tool, color: defaultPen.color, width: defaultPen.width };
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

  const screen = h("div", { class: "screen screen-dark" });
  const topbar = h("div", { class: "topbar" });
  const editorBody = h("div", { class: "editor-body" });
  const stage = h("div", { class: "spread-stage" });
  const banner = h("div", { class: "mode-banner", hidden: true });
  const bench = h("div", { class: "bench" });
  editorBody.append(stage, banner);
  screen.append(topbar, editorBody, bench);
  root.append(screen);
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
        h("button", { class: "back-btn", type: "button", "aria-label": "Sayfalar", onTap: () => { flushInk(); navigate(`#/n/${notebookId}/fan?p=${selectedPageId}`); } }, svgIcon("back", 20)),
        page.pdf && h("span", { class: "badge-pdf" }, "PDF"),
        h("span", { class: "topbar-notebook" }, nb().title)),
      h("div", { class: "topbar-title" }, favoriteStrip()),
      h("div", { class: "topbar-side right" },
        iconButton("grid", "Sayfalar", () => { flushInk(); navigate(`#/n/${notebookId}/fan?p=${selectedPageId}`); }),
        Object.assign(iconButton("undo", "Geri al", () => activeInk && activeInk.undo()), { disabled: !(activeInk && activeInk.canUndo) }),
        Object.assign(iconButton("redo", "İleri al", () => activeInk && activeInk.redo()), { disabled: !(activeInk && activeInk.canRedo) }),
        iconButton("more", "Sayfa işlemleri: çoğalt, taşı, sil", pageActionsMenu),
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

  /** Üst çubuktaki favori kalemler: dokununca seçilir, seçiliye tekrar dokununca kalem paneli açılır. */
  function favoriteStrip() {
    const strip = h("div", { class: "fav-strip", role: "group", "aria-label": "Favori kalemler" });
    for (const pen of store.settings.pens) {
      const selected = penMatches(pen);
      strip.append(h("button", { class: `fav-mini ${pen.tool}` + (selected ? " selected" : ""), type: "button", style: { "--c": pen.color },
        "aria-label": pen.name, "aria-pressed": String(selected), title: pen.name,
        onTap: () => { if (selected) openPenPanel(); else { tool = { tool: pen.tool, color: pen.color, width: pen.width }; lastPen = { ...tool }; clearSelections(); renderBench(); renderTopbar(); applyModes(); } } }));
    }
    return strip;
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
    if (ruler) { const p = pages().find((x) => x.id === id); if (p) { ruler.x = Math.min(ruler.x, p.size.w - 40); ruler.y = Math.min(ruler.y, p.size.h - 40); } }
    renderStage();
    history.replaceState(null, "", `#/n/${notebookId}/p/${id}`);
  }

  function pageActionsMenu() {
    const page = selectedPage();
    const index = selectedIndex();
    const count = pages().length;
    actionSheet(`${index + 1}. sayfa`, [
      { title: "Şablonu Değiştir", onSelect: () => import("./addpage.js").then((m) => m.openTemplatePicker((t) => { store.setTemplate(notebookId, page.id, t); renderStage(); })) },
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
    stack.append(bg, objectsLayer, canvas, selectLayer, coversLayer);
    if (page.pdf && !textLines.has(page.id)) {
      pdfTextLines(page.pdf, page.size).then((lines) => textLines.set(page.id, lines)).catch(() => textLines.set(page.id, []));
    }
    const ink = new InkCanvas(canvas, page, {
      getTool: () => tool,
      pencilOnly: () => store.settings.pencilOnly,
      pressureWidth: () => store.settings.pressureWidth,
      fingerAction: () => store.settings.fingerAction,
      eraser: () => store.settings.eraser,
      shapeRecognition: () => store.settings.shapeRecognition,
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
      onChange: () => { activeInk = ink; store.mutate(notebookId, () => {}); renderTopbar(); invalidateSnapshot(page); refreshFrost(stack, page); }
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
    stack._layers = { objectsLayer, coversLayer, canvas, selectLayer };
    stack._pageId = page.id;
    renderRuler(stack, page);
    return stack;
  }

  // ---------- kement seçimi (kutuya alıp taşı / büyüt / döndür) ----------

  function renderSelection(stack, page, bounds) {
    const layer = stack._layers.selectLayer;
    layer.replaceChildren();
    if (!bounds) return;
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
    const menu = h("div", { class: "object-menu", style: { left: Math.min(Math.max(bounds.x + bounds.w / 2, 150), Math.max(page.size.w - 150, 150)) + "px", top: Math.max(bounds.y - 12, 60) + "px" } },
      h("button", { type: "button", onTap: () => ink.duplicateSelection() }, svgIcon("copy", 16), "Kopyala"),
      h("div", { class: "sep" }),
      h("button", { type: "button", onTap: () => { const b = ink.selectionBounds(); if (!b) return; ink.beginSelectionEdit(); ink.applySelectionTransform({ rotate: 90, center: { x: b.x + b.w / 2, y: b.y + b.h / 2 } }); ink.commit(); renderSelection(stack, page, ink.selectionBounds()); } }, svgIcon("rotate", 16), "Döndür"),
      h("div", { class: "sep" }),
      h("button", { type: "button", class: "danger", onTap: () => ink.deleteSelection() }, svgIcon("trash", 16), "Sil"));
    menu.addEventListener("pointerdown", (e) => e.stopPropagation());
    layer.append(box, menu);
  }

  // ---------- cetvel ----------

  function renderRuler(stack, page) {
    for (const old of stack.querySelectorAll(".ruler")) old.remove();
    if (!ruler || selectedPageId !== page.id) return;
    const el = h("div", { class: "ruler", style: { width: ruler.length + "px" }, "aria-label": "Cetvel" });
    const place = () => {
      el.style.left = (ruler.x - ruler.length / 2) + "px";
      el.style.top = ruler.y + "px";
      el.style.transform = `rotate(${ruler.angle}deg)`;
    };
    place();
    const move = h("div", { class: "ruler-grip move", role: "button", "aria-label": "Cetveli taşı" }, svgIcon("move", 18));
    const rotate = h("div", { class: "ruler-grip rotate", role: "button", "aria-label": "Cetveli döndür" }, svgIcon("rotate", 18));
    grip(move, stack, page, (p, session) => { ruler.x = session.base.x + (p.x - session.start.x); ruler.y = session.base.y + (p.y - session.start.y); place(); });
    grip(rotate, stack, page, (p) => { ruler.angle = Math.atan2(p.y - ruler.y, p.x - ruler.x) * 180 / Math.PI; place(); });
    el.append(move, rotate);
    stack.append(el);
  }

  function grip(el, stack, page, onMove) {
    let session = null;
    el.addEventListener("pointerdown", (e) => {
      e.stopPropagation();
      e.preventDefault();
      el.setPointerCapture(e.pointerId);
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
      canvas.classList.toggle("disabled", editingObjects || isFrosted());
      coversLayer.classList.toggle("capture", isFrosted() && !editingObjects);
    }
    renderBanner();
  }

  function renderBanner() {
    if (editingObjects) {
      banner.hidden = false;
      banner.replaceChildren(
        h("span", {}, selectedObjectId ? "Sürükle, köşeden büyüt, üstten döndür" : "Nesne düzenleme: bir nesneye dokun"),
        h("button", { class: "btn small primary", type: "button", onTap: () => setEditing(false) }, "Bitti"));
    } else if (isFrosted()) {
      banner.hidden = false;
      banner.replaceChildren(svgIcon("hand", 16), h("span", {}, "Buzlu kalem: yazının üstüne çek"));
    } else {
      banner.hidden = true;
    }
  }

  function setEditing(on) {
    editingObjects = on;
    if (!on) selectedObjectId = null;
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
      const el = h("div", { class: `placed ${object.kind}` + (object.id === selectedObjectId ? " selected" : ""), style: { "--tint": object.tint || "#FFE566" } });
      if (object.kind !== "postit") {
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
          layer.append(objectMenu(object, page, {
            rotate: () => store.updatePage(notebookId, page.id, (p) => { const o = p.objects.find((x) => x.id === object.id); if (o) o.rotation = (o.rotation + 90) % 360; }),
            duplicate: () => store.updatePage(notebookId, page.id, (p) => { const o = p.objects.find((x) => x.id === object.id); if (!o) return; const copy = structuredClone(o); copy.id = uid(); copy.rect = { ...o.rect, x: o.rect.x + 24, y: o.rect.y + 24 }; copy.z = maxZ(p) + 1; p.objects.push(copy); selectedObjectId = copy.id; }),
            front: () => store.updatePage(notebookId, page.id, (p) => { const o = p.objects.find((x) => x.id === object.id); if (o) o.z = maxZ(p) + 1; }),
            remove: () => { store.updatePage(notebookId, page.id, (p) => { p.objects = p.objects.filter((x) => x.id !== object.id); }); selectedObjectId = null; store.removeUnreferencedAssets(); }
          }, () => { touchPage(page); renderObjects(layer, page, stack); renderBanner(); }));
        }
      }
      layer.append(el);
    }
    if (editingObjects) {
      layer.addEventListener("pointerdown", (e) => { if (e.target === layer) { selectedObjectId = null; renderObjects(layer, page, stack); renderCovers(stack._layers.coversLayer, page, stack); renderBanner(); } });
    }
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
      ...["tl", "tr", "bl", "br"].map((c) => h("div", { class: "handle " + c, dataset: { handle: "resize" }, "aria-label": "Boyut tutamağı" }))
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
      el.setPointerCapture(e.pointerId);
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

  function addPlainPostIt(tint) {
    const page = selectedPage();
    const object = { id: uid(), kind: "postit", tint, rect: centeredRect(page, 200, 170), rotation: 0, z: maxZ(page) + 1 };
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
      layer.setPointerCapture(e.pointerId);
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
    return tool.tool === "pen" || tool.tool === "pencil" || tool.tool === "highlighter";
  }

  function renderBench() {
    const s = store.settings;
    const palette = h("div", { class: "palette" });
    for (const hex of s.palette) {
      const selected = isInking() && hex.toUpperCase() === tool.color.toUpperCase();
      palette.append(h("button", { class: "swatch" + (selected ? " selected" : ""), type: "button", style: { "--c": hex }, "aria-label": "Renk " + hex,
        onTap: () => { if (!isInking()) tool.tool = "pen"; tool.color = hex; renderBench(); applyModes(); } }));
    }
    const hasSelectedColor = s.palette.some((hex) => isInking() && hex.toUpperCase() === tool.color.toUpperCase());
    const paletteRow = h("div", { class: "palette-row" },
      Object.assign(iconButton("plus", "Seçili rengi palete ekle", () => { store.addPaletteColor(tool.color); renderBench(); }), { disabled: !isInking() || hasSelectedColor }),
      h("div", { class: "palette-scroll" }, palette),
      Object.assign(iconButton("trash", "Seçili rengi paletten çıkar", () => { store.removePaletteColor(tool.color); renderBench(); }), { disabled: s.palette.length <= 1 || !hasSelectedColor })
    );

    const pensRow = h("div", { class: "pens-row" });
    for (const pen of s.pens) {
      const selected = penMatches(pen);
      pensRow.append(h("button", { class: "pen-btn" + (selected ? " selected" : ""), type: "button", "aria-label": pen.name, "aria-pressed": String(selected),
        onTap: () => { if (selected) openPenPanel(); else { tool = { tool: pen.tool, color: pen.color, width: pen.width }; lastPen = { ...tool }; clearSelections(); renderBench(); renderTopbar(); applyModes(); } } },
        penIllustration(pen), h("span", { class: "tool-caption" }, pen.name)));
    }
    pensRow.append(h("div", { class: "bench-sep" }));
    pensRow.append(h("button", { class: "tool-btn" + (tool.tool === "eraser" ? " selected" : ""), type: "button", "aria-label": "Silgi", "aria-pressed": String(tool.tool === "eraser"),
      onTap: () => { if (tool.tool === "eraser") openEraserPanel(); else { tool.tool = "eraser"; clearSelections(); renderBench(); renderTopbar(); applyModes(); } } }, svgIcon("eraser", 22), h("span", { class: "tool-caption" }, "Silgi")));
    pensRow.append(toolButton("lasso", svgIcon("lasso", 22), "Kement", "Seç"));
    pensRow.append(h("button", { class: "tool-btn" + (ruler ? " selected" : ""), type: "button", "aria-label": "Cetvel", "aria-pressed": String(!!ruler), onTap: toggleRuler }, svgIcon("ruler", 22), h("span", { class: "tool-caption" }, "Cetvel")));
    pensRow.append(h("button", { class: "tool-btn", type: "button", "aria-label": "Çıkartma ve post-it", onTap: openStickerPanel }, svgIcon("note", 22), h("span", { class: "tool-caption" }, "Post-it")));
    pensRow.append(h("button", { class: "tool-btn" + (isFrosted() ? " selected" : ""), type: "button", "aria-label": "Buzlu kalem",
      onTap: () => { if (isFrosted()) openFrostedPanel(); else { tool.tool = "frosted"; renderBench(); renderTopbar(); applyModes(); } } }, h("div", { class: "frost-ring" }), h("span", { class: "tool-caption" }, "Buzlu")));
    pensRow.append(h("button", { class: "tool-btn" + (editingObjects ? " selected" : ""), type: "button", "aria-label": "Fotoğraf ve nesneler", onTap: photoMenu }, svgIcon("photo", 22), h("span", { class: "tool-caption" }, "Fotoğraf")));

    bench.replaceChildren(paletteRow, pensRow);
    if (popover) bench.append(popover);
  }

  function toolButton(name, icon, label, caption) {
    const selected = tool.tool === name;
    return h("button", { class: "tool-btn" + (selected ? " selected" : ""), type: "button", "aria-label": label, "aria-pressed": String(selected),
      onTap: () => { tool.tool = name; clearSelections(); renderBench(); renderTopbar(); applyModes(); } }, icon, h("span", { class: "tool-caption" }, caption || label));
  }

  function clearSelections() {
    for (const ink of inks.values()) ink.clearSelection();
  }

  // ---------- silgi paneli ----------

  function openEraserPanel() {
    closePopover();
    const e = { ...store.settings.eraser };
    const save = () => store.setSetting("eraser", { ...e });
    const tabs = h("div", { class: "segmented" });
    const buildTabs = () => tabs.replaceChildren(
      h("button", { type: "button", class: e.mode === "stroke" ? "active" : "", onTap: () => { e.mode = "stroke"; save(); buildTabs(); } }, "Dokunduğun çizgiyi sil"),
      h("button", { type: "button", class: e.mode === "pixel" ? "active" : "", onTap: () => { e.mode = "pixel"; save(); buildTabs(); } }, "Normal silgi"));
    buildTabs();
    const value = h("span", { class: "value" }, e.size + " px");
    popover = h("div", { class: "popover", role: "dialog", style: { width: "min(460px, calc(100vw - 32px))" } },
      h("div", { class: "panel-head" }, h("h3", {}, "Silgi"), h("span", { class: "panel-hint" }, "Parmak davranışı Ayarlar'da")),
      h("div", { class: "panel-row" }, tabs),
      h("div", { class: "panel-row" }, h("label", {}, "Boyut"), h("input", { type: "range", min: "4", max: "48", step: "2", value: String(e.size), "aria-label": "Silgi boyutu", onInput: (ev) => { e.size = Number(ev.target.value); value.textContent = e.size + " px"; save(); } }), value),
      h("div", { style: { textAlign: "right", marginTop: "12px" } }, h("button", { class: "btn small", type: "button", style: { background: "rgba(255,255,255,0.1)", color: "#fff" }, onTap: closePopover }, "Kapat"))
    );
    bench.append(popover);
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
    closePopover();
  };
  document.addEventListener("pointerdown", onOutsidePointer, true);

  function openPenPanel() {
    closePopover();
    const s = store.settings;
    const panel = h("div", { class: "popover", role: "dialog" });
    const build = () => {
      const preview = h("div", { class: "stroke-preview" }, h("span", { style: { "--c": tool.color, "--h": Math.max(2, Math.min(tool.width, 24)) + "px" } }));
      const value = h("span", { class: "value" }, formatPt(tool.width) + " pt");
      const widthRange = h("input", { type: "range", min: "1", max: "24", step: "0.5", value: String(tool.width), "aria-label": "Kalınlık",
        onInput: (e) => { tool.width = Number(e.target.value); value.textContent = formatPt(tool.width) + " pt"; preview.firstChild.style.setProperty("--h", Math.max(2, Math.min(tool.width, 24)) + "px"); renderBenchKeepPopover(); } });
      const toolTabs = h("div", { class: "segmented" }, ...["pen", "pencil", "highlighter"].map((t) =>
        h("button", { type: "button", class: tool.tool === t ? "active" : "", onTap: () => { tool.tool = t; build(); renderBenchKeepPopover(); } }, TOOLS[t].title)));
      const palette = h("div", { class: "palette", style: { flexWrap: "wrap" } });
      for (const hex of s.palette) {
        palette.append(h("button", { class: "swatch" + (hex.toUpperCase() === tool.color.toUpperCase() ? " selected" : ""), type: "button", style: { "--c": hex }, "aria-label": "Renk " + hex,
          onTap: () => { tool.color = hex; build(); renderBenchKeepPopover(); } }));
      }
      const wheel = h("div", { class: "color-input" }, h("input", { type: "color", value: toHex6(tool.color), "aria-label": "Renk çemberi", onInput: (e) => { tool.color = e.target.value.toUpperCase(); build(); renderBenchKeepPopover(); } }));
      const favs = h("div", { class: "fav-grid" });
      for (const pen of s.pens) {
        const cell = h("button", { class: "fav-cell" + (penMatches(pen) ? " selected" : ""), type: "button",
          style: { "--c": pen.color, "--h": Math.max(2, Math.min(pen.width, 14)) + "px" },
          onTap: () => { tool = { tool: pen.tool, color: pen.color, width: pen.width }; build(); renderBenchKeepPopover(); } },
          pen.id === s.defaultPenId && h("span", { class: "star" }, svgIcon("star", 11)),
          h("div", { class: "dot" }), h("div", { class: "line" }), h("div", { class: "name" }, pen.name));
        cell.addEventListener("contextmenu", (e) => { e.preventDefault(); actionSheet(pen.name, [
          { title: "Varsayılan Yap", onSelect: () => { store.setSetting("defaultPenId", pen.id); build(); } },
          { title: "Sil", destructive: true, disabled: s.pens.length <= 1, onSelect: () => { store.removePen(pen.id); build(); renderBenchKeepPopover(); } }
        ]); });
        favs.append(cell);
      }
      favs.append(h("button", { class: "fav-cell add", type: "button", onTap: addFavorite }, svgIcon("plus", 22), h("div", { class: "name" }, "Ekle")));
      const def = store.defaultPen;
      panel.replaceChildren(
        h("div", { class: "panel-head" }, toolTabs, h("button", { class: "btn small primary", type: "button", onTap: addFavorite }, "♥ Favorilere ekle")),
        h("div", { class: "panel-row" }, h("label", {}, "Kalınlık"), widthRange, value),
        preview,
        h("div", { class: "panel-row" }, h("label", {}, "Renk"), h("div", { style: { flex: "1", overflowX: "auto" } }, palette), wheel),
        h("div", { class: "panel-sep" }),
        h("div", { class: "panel-head" }, h("h3", {}, "Favorilerim"), h("span", { class: "panel-hint" }, "Uzun bas: varsayılan yap / sil")),
        favs,
        h("div", { class: "default-row" },
          h("div", {}, h("div", {}, "Varsayılan kalemim"), h("div", { class: "sub" }, "Yeni sayfa açınca bu seçili gelir")),
          def && h("div", { class: "who" }, h("div", { class: "dot", style: { "--c": def.color } }), `${def.name} · ${formatPt(def.width)} pt`)),
        h("div", { style: { textAlign: "right", marginTop: "12px" } }, h("button", { class: "btn small", type: "button", style: { background: "rgba(255,255,255,0.1)", color: "#fff" }, onTap: closePopover }, "Kapat"))
      );
    };
    function addFavorite() {
      promptDialog("Favori adı", "Örn. Kırmızı kalem", `${TOOLS[tool.tool].title} ${formatPt(tool.width)} pt`, (name) => {
        store.addPen({ tool: tool.tool, color: tool.color, width: tool.width, name });
        build();
        renderBenchKeepPopover();
      });
    }
    build();
    popover = panel;
    bench.append(panel);
  }

  function renderBenchKeepPopover() {
    const keep = popover;
    renderBench();
    if (keep && !keep.isConnected) { popover = keep; bench.append(keep); }
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
    bench.append(popover);
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
  const onSettings = (e) => { if (e.detail && (e.detail.key === "pens" || e.detail.key === "palette" || e.detail.key === "defaultPenId")) renderBenchKeepPopover(); };
  store.addEventListener("settings", onSettings);
  const onKey = (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") { e.preventDefault(); if (e.shiftKey) activeInk && activeInk.redo(); else activeInk && activeInk.undo(); }
  };
  window.addEventListener("keydown", onKey);

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
      flip.cancel();
      flushInk();
    }
  };
}
