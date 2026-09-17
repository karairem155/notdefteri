// Defter açılınca sayfa yelpazesi (Paper tarzı): sayfalar bir yay üzerinde açılır,
// parmakla kaydırılır, dokunulan sayfa editörde açılır. Altta sayfa ekle ve ızgara.
import { store } from "./store.js";
import { h, svgIcon, iconButton, pressable, actionSheet, confirmDialog } from "./ui.js";
import { renderBackground } from "./paper.js";
import { renderStrokesToDataURL } from "./ink.js";
import { openAddPageSheet, openTemplatePicker } from "./addpage.js";
import { navigate } from "./app.js";

const FAN_TILT = 7;        // komşu sayfalar arası yelpaze açısı (derece, aşağıdaki eksen etrafında)
const FAN_TURN = 16;       // komşu sayfalar arası 3B dönüş (derece)
const FAN_DEPTH = 36;      // her komşu için geriye kayma (px)
const VISIBLE = 7;         // ortadakinin her iki yanında görünen sayfa sayısı

export function renderFan(root, notebookId) {
  const notebook = store.notebook(notebookId);
  const params = new URLSearchParams(location.hash.split("?")[1] || "");
  let center = Math.max(0, notebook.pages.findIndex((p) => p.id === params.get("p")));
  let dragging = null;

  const screen = h("div", { class: "screen screen-paper" });
  const topbar = h("div", { class: "paper-topbar" },
    h("div", { class: "topbar-side" }, h("button", { class: "back-btn light", type: "button", "aria-label": "Defterlerim", onTap: () => navigate("#/") }, svgIcon("back", 20), "Defterlerim")),
    h("div", { class: "topbar-title" }),
    h("div", { class: "topbar-side right" }, iconButton("grid", "Sayfalar ızgarası", () => navigate(`#/n/${notebookId}/pages?p=${pages()[center] ? pages()[center].id : ""}`)))
  );
  const head = h("div", { class: "paper-head" });
  const stage = h("div", { class: "fan-stage" });
  const actions = h("div", { class: "paper-actions" });
  screen.append(topbar, head, stage, actions);
  root.append(screen);

  const pages = () => store.notebook(notebookId).pages;

  function render() {
    const list = pages();
    center = Math.min(Math.max(center, 0), list.length - 1);
    head.replaceChildren(
      h("h1", {}, store.notebook(notebookId).title + " · Sayfalar"),
      h("div", { class: "sub" }, `${list.length} sayfa · ${center + 1}. sayfa seçili · sağa sola kaydır, seçmek için dokun, açmak için "Aç"`));
    stage.replaceChildren();
    for (let i = Math.max(0, center - VISIBLE); i <= Math.min(list.length - 1, center + VISIBLE); i++) {
      stage.append(card(list[i], i));
    }
    actions.replaceChildren(
      iconButton("more", "Sayfa işlemleri", () => pageMenu(list[center])),
      h("button", { class: "btn primary", type: "button", onTap: () => navigate(`#/n/${notebookId}/p/${list[center].id}`) }, "Aç"),
      iconButton("plus", "Sayfa ekle", () => openAddPageSheet(notebookId, center, (id) => { center = pages().findIndex((p) => p.id === id); render(); }), "accent-fill")
    );
  }

  function card(page, index) {
    const offset = index - center;
    const el = h("div", { class: "fan-card" + (offset === 0 ? " current" : ""), style: { aspectRatio: `${page.size.w} / ${page.size.h}`, zIndex: String(100 - Math.abs(offset)) }, role: "button", tabindex: "0", "aria-label": `${index + 1}. sayfa` });
    // Paper'daki gibi deste yelpazesi: sayfalar çok aşağıdaki bir eksen etrafında yelpaze gibi açılır,
    // yanlar hem geriye kayar hem döner; ortadaki en önde ve düz durur.
    const abs = Math.abs(offset);
    const base = `rotate(${offset * FAN_TILT}deg) rotateY(${offset * FAN_TURN}deg) translateZ(${-abs * FAN_DEPTH}px)`;
    el.style.transform = base;
    const cast = h("div", { class: "fan-cast", style: { aspectRatio: `${page.size.w} / ${page.size.h}`, zIndex: String(50 - abs) } });
    cast.style.transform = base + " translateY(92%) skewX(-8deg) scaleY(1.1)";
    stage.append(cast);
    const bg = h("div", { class: "page-bg" });
    renderBackground(bg, page, { thumbnail: true });
    const ink = h("img", { class: "ink", alt: "", draggable: "false" });
    if (page.strokes.length) ink.src = renderStrokesToDataURL(page, 400);
    el.append(bg, ink, h("div", { class: "fan-num" }, String(index + 1)));
    pressable(el, {
      onTap: () => {
        if (offset !== 0) { center = index; render(); return; }
        navigate(`#/n/${notebookId}/p/${page.id}`);
      },
      onLong: () => pageMenu(page)
    });
    return el;
  }

  // Yatay sürükleme: yelpaze kayar.
  stage.addEventListener("pointerdown", (e) => { dragging = { x: e.clientX, start: center, moved: false }; });
  stage.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const dx = e.clientX - dragging.x;
    const steps = Math.round(-dx / 70);
    const next = Math.min(Math.max(dragging.start + steps, 0), pages().length - 1);
    if (next !== center) { center = next; dragging.moved = true; render(); }
  });
  const endDrag = () => { dragging = null; };
  stage.addEventListener("pointerup", endDrag);
  stage.addEventListener("pointercancel", endDrag);

  function pageMenu(page) {
    const list = pages();
    const index = list.findIndex((p) => p.id === page.id);
    actionSheet(`${index + 1}. sayfa`, [
      { title: "Aç", onSelect: () => navigate(`#/n/${notebookId}/p/${page.id}`) },
      { title: "Şablonu Değiştir", onSelect: () => openTemplatePicker((template) => { store.setTemplate(notebookId, page.id, template); render(); }) },
      { title: "Çoğalt", onSelect: () => { const id = store.duplicatePage(notebookId, page.id); if (id) center = pages().findIndex((p) => p.id === id); render(); } },
      { title: "Öne Taşı", disabled: index === 0, onSelect: () => { store.movePage(notebookId, page.id, index - 1); center = index - 1; render(); } },
      { title: "Arkaya Taşı", disabled: index >= list.length - 1, onSelect: () => { store.movePage(notebookId, page.id, index + 1); center = index + 1; render(); } },
      { title: "Sil", destructive: true, disabled: list.length <= 1, onSelect: () => confirmDialog("Bu sayfa silinsin mi?", "Sayfa ve üzerindeki yazılar silinir.", "Sayfayı Sil", () => { store.deletePage(notebookId, page.id); render(); }) }
    ]);
  }

  render();
  return { destroy() {} };
}
