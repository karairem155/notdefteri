// Defter seçilince açılan ekran: gerçek bir kitap gibi. Bütün sayfalar tek bir ciltten menteşelidir;
// ortadaki iki sayfa düz durur, öncekiler sola, sonrakiler sağa doğru ciltten yükselerek yelpazelenir.
// Kaydırınca yaprak cilt üstünden dönerek karşı tarafa geçer (sayfa çevirme animasyonu).
// Düz duran sayfaya dokununca editör açılır.
import { store } from "./store.js";
import { h, svgIcon, pressable, actionSheet, confirmDialog } from "./ui.js";
import { paintPaper, drawImageURL, pdfPageImage } from "./paper.js";
import { drawStroke, orderForDrawing } from "./ink.js";
import { openAddPageSheet, openTemplatePicker } from "./addpage.js";
import { navigate } from "./app.js";

const STEP = 16;          // yelpazedeki yapraklar arası açı (derece)
const SPREAD = 0;         // yaprakların ciltten dışarı kayma payı (px, yaprak başına)
const VISIBLE = 4;        // her yanda kaç yaprak görünsün

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
      // Yaprak ciltten hafifçe dışarı kayar ve döner: yelpaze gibi hepsi görünür (Paper).
      const k = Math.min(dist, VISIBLE);
      const shift = (index <= center ? -1 : 1) * k * SPREAD;
      leaf.style.transform = `translateX(${shift}px) rotateY(${angleFor(index)}deg)`;
      leaf.dataset.index = String(index);
      leaf.classList.toggle("flat", index === center || index === center + 1);
      leaf.querySelector(".fan-num").textContent = String(index + 1);
    });
    for (const [id, leaf] of leaves) if (!keep.has(id)) { leaf.remove(); leaves.delete(id); }
    foot.replaceChildren(
      h("div", { class: "fan-nav" },
        Object.assign(h("button", { class: "fan-round small", type: "button", "aria-label": "Önceki sayfa", onTap: () => turn(-1) }, svgIcon("back", 18)), { disabled: center <= 0 }),
        h("button", { class: "fan-round small", type: "button", "aria-label": "Sayfa ekle", onTap: () => openAddPageSheet(notebookId, center + 1, (id) => { center = pages().findIndex((p) => p.id === id); render(); }) }, svgIcon("plus", 18)),
        Object.assign(h("button", { class: "fan-round small", type: "button", "aria-label": "Sonraki sayfa", onTap: () => turn(1) }, svgIcon("forward", 18)), { disabled: center + 2 >= list.length })),
      h("div", { class: "fan-count" }, `${center + 1}${list[center + 1] ? "-" + (center + 2) : ""} / ${list.length}`)
    );
  }

  /** Sayfanın gerçek küçük resmi: kağıt deseni gerçek oranla, üstüne mürekkep (editördeki görünümün aynısı). */
  function pageFace(page) {
    const face = h("div", { class: "fan-face-content", style: { aspectRatio: `${page.size.w} / ${page.size.h}` } });
    const img = h("img", { class: "ink", alt: "", draggable: "false" });
    face.append(img);
    const scale = 0.75;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(page.size.w * scale);
    canvas.height = Math.round(page.size.h * scale);
    const ctx = canvas.getContext("2d");
    ctx.scale(scale, scale);
    const finish = () => { for (const stroke of orderForDrawing(page.strokes)) drawStroke(ctx, stroke); img.src = canvas.toDataURL("image/jpeg", 0.85); };
    if (page.pdf) {
      pdfPageImage(page.pdf, 600).then((url) => url ? drawImageURL(ctx, url, 0, 0, page.size.w, page.size.h) : false).then((ok) => { if (!ok) paintPaper(ctx, "blank", page.size.w, page.size.h); finish(); }).catch(() => { paintPaper(ctx, "blank", page.size.w, page.size.h); finish(); });
    } else if (page.templateAsset) {
      store.assetURL(page.templateAsset).then((url) => url ? drawImageURL(ctx, url, 0, 0, page.size.w, page.size.h) : false).then((ok) => { if (!ok) paintPaper(ctx, "blank", page.size.w, page.size.h); finish(); }).catch(() => { paintPaper(ctx, "blank", page.size.w, page.size.h); finish(); });
    } else {
      paintPaper(ctx, page.paper, page.size.w, page.size.h);
      finish();
    }
    return face;
  }

  /** Ciltten menteşeli yaprak: iki yüzünde de aynı sayfa (arka yüz aynalanmış ki her açıdan okunsun). */
  function makeLeaf(page) {
    const leaf = h("div", { class: "fan-leaf", style: { aspectRatio: `${page.size.w} / ${page.size.h}` }, role: "button", tabindex: "0", "aria-label": "Sayfa" });
    const front = h("div", { class: "fan-face front" }, pageFace(page));
    const back = h("div", { class: "fan-face back" }, pageFace(page));
    leaf.append(front, back, h("div", { class: "fan-num" }));
    pressable(leaf, { onTap: () => {}, onLong: () => pageMenu(page) });
    return leaf;
  }

  // Yatay kaydırma: her jestte yalnızca BİR yaprak döner (sola → sonraki, sağa → önceki). Parmak kalkmadan ikinci dönüş olmaz.
  let busyUntil = 0;
  function turn(dir) {
    const now = Date.now();
    if (now < busyUntil) return;
    busyUntil = now + 750;
    center += dir * 2;
    render();
  }
  stage.addEventListener("pointerdown", (e) => { if (e.pointerType === "mouse" && e.button !== 0) return; dragging = { id: e.pointerId, x: e.clientX, moved: false, done: false }; });
  stage.addEventListener("pointermove", (e) => {
    if (!dragging || dragging.done || e.pointerId !== dragging.id) return;
    const dx = e.clientX - dragging.x;
    if (Math.abs(dx) > 14) dragging.moved = true;
    if (dx < -70) { dragging.done = true; turn(1); }
    else if (dx > 70) { dragging.done = true; turn(-1); }
  });
  // Dokunma sahne düzeyinde, koordinatla: 3B döndürülmüş yapraklara dokunma bazı tarayıcılarda algılanmıyor.
  const endDrag = (e) => {
    if (!dragging || e.pointerId !== dragging.id) return;
    const wasTap = !dragging.moved && e.type === "pointerup";
    setTimeout(() => { dragging = null; }, 0);
    if (!wasTap || Date.now() < busyUntil) return;
    if (e.target && e.target.closest && e.target.closest("button")) return;
    const flat = book.querySelector(".fan-leaf.flat");
    if (!flat) return;
    const w = flat.getBoundingClientRect().width || 1;
    const br = book.getBoundingClientRect();
    const spineX = br.left;
    const top = br.top, bottom = br.bottom;
    const dx = e.clientX - spineX;
    if (e.clientY < top - 20 || e.clientY > bottom + 20) return;
    const list = pages();
    if (Math.abs(dx) <= w * 1.05) {
      const target = dx < 0 ? list[center] : (list[center + 1] || list[center]);
      if (target) navigate(`#/n/${notebookId}/p/${target.id}`);
    } else if (Math.abs(dx) <= w * 2.4) {
      turn(dx < 0 ? -1 : 1);
    }
  };
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
