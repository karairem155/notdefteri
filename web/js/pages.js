// Sayfalar ekranı (12-Sayfalar.png): bütün sayfalar ızgarada, sürükle-sırala,
// uzun bas: şablonu değiştir / çoğalt / sil, dokununca o sayfaya git.
import { renderPageCanvas, spillFor } from "./pagerender.js";
import { store } from "./store.js";
import { h, svgIcon, iconButton, pressable, actionSheet, confirmDialog, openModal, closeModal } from "./ui.js";
import { openAddPageSheet, openTemplatePicker } from "./addpage.js";
import { navigate } from "./app.js";

export function renderPages(root, notebookId) {
  const notebook = store.notebook(notebookId);
  const params = new URLSearchParams(location.hash.split("?")[1] || "");
  let selectedId = params.get("p") || (notebook.pages[0] && notebook.pages[0].id);

  const screen = h("div", { class: "screen screen-light" });
  const body = h("div", { class: "pages-body" });
  const topbar = h("div", { class: "topbar" },
    h("div", { class: "topbar-side" }, h("button", { class: "back-btn", type: "button", onTap: () => navigate(`#/n/${notebookId}/p/${selectedId}`) }, svgIcon("back", 20), notebook.title)),
    h("div", { class: "topbar-title" }, "Sayfalar"),
    h("div", { class: "topbar-side right" },
      h("button", { class: "btn small", type: "button", style: { color: "var(--accent)", background: "var(--accent-soft)" },
        onTap: () => openAddPageSheet(notebookId, indexOf(selectedId), (id) => { selectedId = id; render(); }) }, "+ Sayfa Ekle"))
  );
  screen.append(topbar, body);
  root.append(screen);

  function indexOf(id) {
    return Math.max(0, store.notebook(notebookId).pages.findIndex((p) => p.id === id));
  }

  let drag = null;

  function render() {
    const pages = store.notebook(notebookId).pages;
    if (!pages.some((p) => p.id === selectedId)) selectedId = pages[0].id;
    const grid = h("div", { class: "pages-grid" });
    pages.forEach((page, index) => grid.append(cell(page, index)));
    body.replaceChildren(
      h("div", { class: "pages-hint" },
        h("span", {}, `${pages.length} sayfa · sürükleyerek sırayı değiştir`),
        h("span", {}, "Sayfaya uzun bas: şablonu değiştir, çoğalt, sil")),
      grid
    );
  }

  /** Izgaradan sayfa rengi: hazır tonlar ve sistem renk seçicisi. */
  function sayfaRengiSec(page) {
    const TONLAR = [["", "Varsayılan"], ["#FFFFFF", "Beyaz"], ["#FBF6E9", "Sıcak"], ["#F6EFE0", "Kraft"], ["#EFF4EC", "Nane"], ["#EAF1FA", "Gökyüzü"], ["#F3EEF9", "Lavanta"], ["#FBEEF1", "Gül"], ["#2A2C34", "Gece"]];
    const uygula = (renk) => { store.setPageColor(notebookId, page.id, renk || null, false); render(); };
    const girdi = h("input", { type: "color", class: "pc-input", value: page.bg || "#F2F0E6", onChange: (e) => { uygula(e.target.value); closeModal(); } });
    openModal(h("div", { class: "sheet-page" },
      h("div", { class: "sheet-head" }, h("span", {}, "Sayfa Rengi"), h("button", { class: "btn ghost", type: "button", onTap: closeModal }, "Kapat")),
      h("div", { class: "sheet-body" },
        h("div", { class: "pc-row" },
          ...TONLAR.map(([hex, ad]) => h("button", { type: "button", class: "pc-dot" + ((page.bg || "") === hex ? " active" : ""), "aria-label": ad, title: ad, style: { "--c": hex || "#F2F0E6" }, onTap: () => { uygula(hex); closeModal(); } })),
          h("label", { class: "pc-dot pc-dot-wheel", "aria-label": "Renk seç", title: "Renk seç" }, girdi)),
        h("div", { class: "note" }, "Seçtiğin renk yalnızca bu sayfaya uygulanır."))
    ));
  }

  function cell(page, index) {
    const thumb = h("div", { class: "thumb", style: { aspectRatio: `${page.size.w} / ${page.size.h}` } });
    // Önizleme sayfanın gerçeği: kağıt + nesneler + mürekkep aynı çizimle üretilir.
    const ink = h("img", { class: "ink", alt: "", draggable: "false" });
    renderPageCanvas(page, Math.min(1, 460 / page.size.w), { background: true, opaque: true, spill: spillFor(store.notebook(notebookId).pages, index) })
      .then((canvas) => { ink.src = canvas.toDataURL("image/jpeg", 0.85); })
      .catch(() => {});
    thumb.append(ink);
    const el = h("div", { class: "page-cell" + (page.id === selectedId ? " selected" : ""), dataset: { index: String(index) }, role: "button", tabindex: "0", "aria-label": `${index + 1}. sayfa` },
      thumb, h("div", { class: "num" }, String(index + 1)));

    // Kısa dokunuş: sayfaya git. Uzun basıp bırakmadan sürükleme: sıralama. Uzun basıp bırakma: menü.
    let timer = null;
    let startPoint = null;
    let dragging = false;
    el.addEventListener("pointerdown", (e) => {
      startPoint = { x: e.clientX, y: e.clientY };
      dragging = false;
      timer = setTimeout(() => {
        timer = null;
        dragging = true;
        el.classList.add("dragging");
        try { el.setPointerCapture(e.pointerId); } catch (_) { /* sentetik olay */ }
        drag = { pageId: page.id };
      }, 380);
    });
    el.addEventListener("pointermove", (e) => {
      if (!startPoint) return;
      if (!dragging) {
        if (timer && Math.hypot(e.clientX - startPoint.x, e.clientY - startPoint.y) > 10) { clearTimeout(timer); timer = null; startPoint = null; }
        return;
      }
      e.preventDefault();
      const target = document.elementFromPoint(e.clientX, e.clientY);
      const cellEl = target && target.closest(".page-cell");
      body.querySelectorAll(".page-cell.drop-target").forEach((c) => c.classList.remove("drop-target"));
      if (cellEl && cellEl !== el) cellEl.classList.add("drop-target");
    });
    const finish = (e) => {
      if (timer) { clearTimeout(timer); timer = null; }
      if (dragging) {
        const target = document.elementFromPoint(e.clientX, e.clientY);
        const cellEl = target && target.closest(".page-cell");
        el.classList.remove("dragging");
        body.querySelectorAll(".page-cell.drop-target").forEach((c) => c.classList.remove("drop-target"));
        const moved = Math.hypot(e.clientX - startPoint.x, e.clientY - startPoint.y) > 12;
        if (cellEl && cellEl !== el) {
          store.movePage(notebookId, page.id, Number(cellEl.dataset.index));
        } else if (!moved) {
          pageMenu(page);
        }
        drag = null;
        dragging = false;
        startPoint = null;
        render();
        return;
      }
      if (startPoint && e.type === "pointerup") {
        selectedId = page.id;
        navigate(`#/n/${notebookId}/p/${page.id}`);
      }
      startPoint = null;
    };
    el.addEventListener("pointerup", finish);
    el.addEventListener("pointercancel", finish);
    el.addEventListener("contextmenu", (e) => e.preventDefault());
    return el;
  }

  function pageMenu(page) {
    const pages = store.notebook(notebookId).pages;
    actionSheet(`${indexOf(page.id) + 1}. sayfa`, [
      { title: "Sayfa Rengi", onSelect: () => sayfaRengiSec(page) },
      { title: "Şablonu Değiştir", onSelect: () => openTemplatePicker((template) => { store.setTemplate(notebookId, page.id, template); render(); }) },
      { title: "Çoğalt", onSelect: () => { const id = store.duplicatePage(notebookId, page.id); if (id) selectedId = id; render(); } },
      { title: "Sil", destructive: true, disabled: pages.length <= 1, onSelect: () => confirmDialog("Bu sayfa silinsin mi?", "Sayfa ve üzerindeki yazılar silinir. Defterde en az bir sayfa kalmalı.", "Sayfayı Sil", () => { store.deletePage(notebookId, page.id); render(); }) }
    ]);
  }

  render();
  void drag;
  return { destroy() {} };
}
