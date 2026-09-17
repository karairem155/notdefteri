// Defter seçilince açılan ekran: ortada açık defter (iki sayfa), iki yanda yelpaze gibi açılan sayfalar.
// Parmakla kaydırılır; yandaki sayfaya dokununca ortaya gelir; ortadaki açık deftere dokununca editör açılır.
import { store } from "./store.js";
import { h, svgIcon, iconButton, pressable, actionSheet, confirmDialog } from "./ui.js";
import { renderBackground } from "./paper.js";
import { renderStrokesToDataURL } from "./ink.js";
import { openAddPageSheet, openTemplatePicker } from "./addpage.js";
import { navigate } from "./app.js";

const SIDE = 6;            // her yanda görünen sayfa sayısı
const GAP = 46;            // yan sayfalar arası kayma (px)
const TURN = 48;           // yan sayfaların dönüş açısı (derece)

export function renderFan(root, notebookId) {
  const notebook = store.notebook(notebookId);
  const params = new URLSearchParams(location.hash.split("?")[1] || "");
  let center = Math.max(0, notebook.pages.findIndex((p) => p.id === params.get("p")));
  center -= center % 2;
  let dragging = null;

  const screen = h("div", { class: "screen screen-fan" });
  const topbar = h("div", { class: "fan-topbar" },
    h("button", { class: "fan-round", type: "button", "aria-label": "Defterlerim", onTap: () => navigate("#/") }, svgIcon("back", 22)),
    h("div", { style: { flex: "1" } }),
    h("button", { class: "fan-round", type: "button", "aria-label": "Sayfalar ızgarası", onTap: () => navigate(`#/n/${notebookId}/pages?p=${pages()[center] ? pages()[center].id : ""}`) }, svgIcon("grid", 22)),
    h("button", { class: "fan-round", type: "button", "aria-label": "Daha fazla", onTap: () => pageMenu(pages()[center]) }, svgIcon("more", 22))
  );
  const head = h("div", { class: "fan-head" });
  const stage = h("div", { class: "fan-stage" });
  const foot = h("div", { class: "fan-foot" });
  const tagline = h("div", { class: "fan-tagline" }, h("div", { class: "t1" }, "Defterini düzenli tut"), h("div", { class: "t2" }, "Sayfaları hızlıca gözden geçir."));
  screen.append(topbar, head, stage, foot, tagline);
  root.append(screen);

  const pages = () => store.notebook(notebookId).pages;

  function render() {
    const list = pages();
    center = Math.min(Math.max(center, 0), Math.max(0, list.length - 1));
    head.replaceChildren(h("h1", {}, store.notebook(notebookId).title), h("div", { class: "sub" }, `${list.length} sayfa`));
    stage.replaceChildren(h("div", { class: "fan-floor" }));
    // Sol yelpaze: ortadaki açık defterden önceki sayfalar (en yakını en üstte)
    for (let k = SIDE; k >= 1; k--) {
      const i = center - k;
      if (i >= 0) stage.append(sideCard(list[i], i, -k));
      const j = center + 1 + k;
      if (j < list.length) stage.append(sideCard(list[j], j, k));
    }
    stage.append(book(list[center], list[center + 1]));
    foot.replaceChildren(
      h("button", { class: "fan-round small", type: "button", "aria-label": "Sayfa ekle", onTap: () => openAddPageSheet(notebookId, center + 1, (id) => { center = pages().findIndex((p) => p.id === id); center -= center % 2; render(); }) }, svgIcon("plus", 18)),
      h("div", { class: "fan-count" }, `${center + 1} / ${list.length}`)
    );
  }

  function thumb(page, size) {
    const el = h("div", { class: "fan-page", style: { aspectRatio: `${page.size.w} / ${page.size.h}` } });
    const bg = h("div", { class: "page-bg" });
    renderBackground(bg, page, { thumbnail: true });
    const ink = h("img", { class: "ink", alt: "", draggable: "false" });
    if (page.strokes.length) ink.src = renderStrokesToDataURL(page, size || 420);
    el.append(bg, ink);
    return el;
  }

  /** Ortadaki açık defter: sol ve sağ sayfa; dokununca editör. */
  function book(left, right) {
    const el = h("div", { class: "fan-book", role: "button", tabindex: "0", "aria-label": "Defteri aç" });
    const leftEl = left ? thumb(left, 600) : h("div", { class: "fan-page empty" });
    const rightEl = right ? thumb(right, 600) : h("div", { class: "fan-page empty", style: { aspectRatio: left ? `${left.size.w} / ${left.size.h}` : "3 / 4" } }, h("span", {}, "+"));
    leftEl.classList.add("left");
    rightEl.classList.add("right");
    el.append(leftEl, h("div", { class: "fan-spine" }), rightEl);
    pressable(el, {
      onTap: (e) => {
        if (dragging && dragging.moved) return;
        const target = (right && e.clientX > el.getBoundingClientRect().left + el.getBoundingClientRect().width / 2) ? right : left;
        if (target) navigate(`#/n/${notebookId}/p/${target.id}`);
      },
      onLong: () => pageMenu(left)
    });
    return el;
  }

  function sideCard(page, index, offset) {
    const k = Math.abs(offset);
    const el = thumb(page, 300);
    el.classList.add("fan-side");
    el.style.zIndex = String(50 - k);
    const dir = Math.sign(offset);
    const stageW = stage.clientWidth || 800;
    const x = dir * (stageW * 0.30 + k * Math.max(34, stageW * 0.045));
    el.style.transform = `translateX(${x}px) translateZ(${-k * 30}px) rotateY(${-dir * TURN}deg) scale(${0.92 - k * 0.045})`;
    el.append(h("div", { class: "fan-num" }, String(index + 1)));
    pressable(el, {
      onTap: () => { if (dragging && dragging.moved) return; center = index - (index % 2); render(); },
      onLong: () => pageMenu(page)
    });
    return el;
  }

  // Yatay sürükleme: yelpaze kayar.
  stage.addEventListener("pointerdown", (e) => { dragging = { x: e.clientX, start: center, moved: false }; });
  stage.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const dx = e.clientX - dragging.x;
    const steps = Math.round(-dx / 90) * 2;
    const next = Math.min(Math.max(dragging.start + steps, 0), Math.max(0, pages().length - 1));
    if (Math.abs(dx) > 12) dragging.moved = true;
    if (next !== center) { center = next - (next % 2); render(); }
  });
  const endDrag = () => { setTimeout(() => { dragging = null; }, 0); };
  stage.addEventListener("pointerup", endDrag);
  stage.addEventListener("pointercancel", endDrag);

  function pageMenu(page) {
    if (!page) return;
    const list = pages();
    const index = list.findIndex((p) => p.id === page.id);
    actionSheet(`${index + 1}. sayfa`, [
      { title: "Aç", onSelect: () => navigate(`#/n/${notebookId}/p/${page.id}`) },
      { title: "Şablonu Değiştir", onSelect: () => openTemplatePicker((template) => { store.setTemplate(notebookId, page.id, template); render(); }) },
      { title: "Çoğalt", onSelect: () => { const id = store.duplicatePage(notebookId, page.id); if (id) { center = list.findIndex((p) => p.id === id); center -= center % 2; } render(); } },
      { title: "Öne Taşı", disabled: index === 0, onSelect: () => { store.movePage(notebookId, page.id, index - 1); render(); } },
      { title: "Arkaya Taşı", disabled: index >= list.length - 1, onSelect: () => { store.movePage(notebookId, page.id, index + 1); render(); } },
      { title: "Sil", destructive: true, disabled: list.length <= 1, onSelect: () => confirmDialog("Bu sayfa silinsin mi?", "Sayfa ve üzerindeki yazılar silinir.", "Sayfayı Sil", () => { store.deletePage(notebookId, page.id); render(); }) }
    ]);
  }

  render();
  return { destroy() {} };
}
