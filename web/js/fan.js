// Defter seçilince açılan ekran: gerçek bir kitap gibi. Bütün sayfalar tek bir ciltten menteşelidir;
// ortadaki iki sayfa düz durur, öncekiler sola, sonrakiler sağa doğru ciltten yükselerek yelpazelenir.
// Kaydırınca yaprak cilt üstünden dönerek karşı tarafa geçer (sayfa çevirme animasyonu).
// Düz duran sayfaya dokununca editör açılır.
import { store } from "./store.js";
import { h, svgIcon, pressable, actionSheet, confirmDialog } from "./ui.js";
import { renderBackground } from "./paper.js";
import { renderStrokesToDataURL } from "./ink.js";
import { openAddPageSheet, openTemplatePicker } from "./addpage.js";
import { navigate } from "./app.js";

const STEP = 15;          // yelpazedeki yapraklar arası açı (derece)
const VISIBLE = 5;        // her yanda kaç yaprak görünsün

export function renderFan(root, notebookId) {
  const notebook = store.notebook(notebookId);
  const params = new URLSearchParams(location.hash.split("?")[1] || "");
  let center = Math.max(0, notebook.pages.findIndex((p) => p.id === params.get("p")));
  center -= center % 2;
  let dragging = null;
  const leaves = new Map();   // pageId -> yaprak elemanı (animasyon için korunur)

  const screen = h("div", { class: "screen screen-fan" });
  const topbar = h("div", { class: "fan-topbar" },
    h("button", { class: "fan-round", type: "button", "aria-label": "Defterlerim", onTap: () => navigate("#/") }, svgIcon("back", 22)),
    h("div", { style: { flex: "1" } }),
    h("button", { class: "fan-round", type: "button", "aria-label": "Sayfalar ızgarası", onTap: () => navigate(`#/n/${notebookId}/pages?p=${pages()[center] ? pages()[center].id : ""}`) }, svgIcon("grid", 22)),
    h("button", { class: "fan-round", type: "button", "aria-label": "Daha fazla", onTap: () => pageMenu(pages()[center]) }, svgIcon("more", 22))
  );
  const head = h("div", { class: "fan-head" });
  const stage = h("div", { class: "fan-stage" });
  const book = h("div", { class: "fan-bookroot" });
  stage.append(h("div", { class: "fan-floor" }), book);
  const foot = h("div", { class: "fan-foot" });
  screen.append(topbar, head, stage, foot);
  root.append(screen);

  const pages = () => store.notebook(notebookId).pages;

  /** Yaprağın açısı: ortadaki sol sayfa -180 (düz sol), sağ sayfa 0 (düz sağ); diğerleri ciltten yükselir. */
  function angleFor(index) {
    if (index <= center) { const k = center - index; return -180 + Math.min(k, VISIBLE) * STEP; }
    const k = index - center - 1;
    return -Math.min(k, VISIBLE) * STEP;
  }

  function render(animate = true) {
    const list = pages();
    center = Math.min(Math.max(center, 0), Math.max(0, list.length - 1));
    center -= center % 2;
    head.replaceChildren(h("h1", {}, store.notebook(notebookId).title), h("div", { class: "sub" }, `${list.length} sayfa`));
    const keep = new Set();
    list.forEach((page, index) => {
      const dist = index <= center ? center - index : index - center - 1;
      if (dist > VISIBLE) return;
      keep.add(page.id);
      let leaf = leaves.get(page.id);
      if (!leaf) { leaf = makeLeaf(page); leaves.set(page.id, leaf); book.append(leaf); }
      leaf.style.transition = animate ? "transform 0.7s cubic-bezier(0.3, 0.7, 0.2, 1)" : "none";
      leaf.style.transform = `rotateY(${angleFor(index)}deg)`;
      leaf.dataset.index = String(index);
      leaf.classList.toggle("flat", index === center || index === center + 1);
      leaf.querySelector(".fan-num").textContent = String(index + 1);
    });
    for (const [id, leaf] of leaves) if (!keep.has(id)) { leaf.remove(); leaves.delete(id); }
    foot.replaceChildren(
      h("button", { class: "fan-round small", type: "button", "aria-label": "Sayfa ekle", onTap: () => openAddPageSheet(notebookId, center + 1, (id) => { center = pages().findIndex((p) => p.id === id); render(); }) }, svgIcon("plus", 18)),
      h("div", { class: "fan-count" }, `${center + 1} / ${list.length}`)
    );
  }

  function pageFace(page) {
    const face = h("div", { class: "fan-face-content", style: { aspectRatio: `${page.size.w} / ${page.size.h}` } });
    const bg = h("div", { class: "page-bg" });
    renderBackground(bg, page, { thumbnail: true });
    const ink = h("img", { class: "ink", alt: "", draggable: "false" });
    if (page.strokes.length) ink.src = renderStrokesToDataURL(page, 520);
    face.append(bg, ink);
    return face;
  }

  /** Ciltten menteşeli yaprak: iki yüzünde de aynı sayfa (arka yüz aynalanmış ki her açıdan okunsun). */
  function makeLeaf(page) {
    const leaf = h("div", { class: "fan-leaf", style: { aspectRatio: `${page.size.w} / ${page.size.h}` }, role: "button", tabindex: "0", "aria-label": "Sayfa" });
    const front = h("div", { class: "fan-face front" }, pageFace(page));
    const back = h("div", { class: "fan-face back" }, pageFace(page));
    leaf.append(front, back, h("div", { class: "fan-num" }));
    pressable(leaf, {
      onTap: () => {
        if (dragging && dragging.moved) return;
        const index = Number(leaf.dataset.index);
        if (index === center || index === center + 1) navigate(`#/n/${notebookId}/p/${page.id}`);
        else { center = index - (index % 2); render(); }
      },
      onLong: () => pageMenu(page)
    });
    return leaf;
  }

  // Yatay kaydırma: sola → sonraki çift sayfa (yaprak cilt üstünden döner), sağa → önceki.
  stage.addEventListener("pointerdown", (e) => { dragging = { x: e.clientX, moved: false, done: false }; });
  stage.addEventListener("pointermove", (e) => {
    if (!dragging || dragging.done) return;
    const dx = e.clientX - dragging.x;
    if (Math.abs(dx) > 14) dragging.moved = true;
    if (dx < -60) { dragging.done = true; center += 2; render(); }
    else if (dx > 60) { dragging.done = true; center -= 2; render(); }
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
      { title: "Şablonu Değiştir", onSelect: () => openTemplatePicker((template) => { store.setTemplate(notebookId, page.id, template); leaves.clear(); book.replaceChildren(); render(false); }) },
      { title: "Çoğalt", onSelect: () => { const id = store.duplicatePage(notebookId, page.id); leaves.clear(); book.replaceChildren(); if (id) center = list.findIndex((p) => p.id === id); render(false); } },
      { title: "Öne Taşı", disabled: index === 0, onSelect: () => { store.movePage(notebookId, page.id, index - 1); render(); } },
      { title: "Arkaya Taşı", disabled: index >= list.length - 1, onSelect: () => { store.movePage(notebookId, page.id, index + 1); render(); } },
      { title: "Sil", destructive: true, disabled: list.length <= 1, onSelect: () => confirmDialog("Bu sayfa silinsin mi?", "Sayfa ve üzerindeki yazılar silinir.", "Sayfayı Sil", () => { store.deletePage(notebookId, page.id); leaves.clear(); book.replaceChildren(); render(false); }) }
    ]);
  }

  render(false);
  return { destroy() {} };
}
