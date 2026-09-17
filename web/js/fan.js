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

const STRIP = 18;         // destedeki sayfalar arası kayma (px): ince şeritler görünür
const TILT = 16;          // destedeki sayfaların dönüşü (derece)
const OPEN = 6;           // açık çift sayfanın "V" açısı (derece)
const VISIBLE = 9;        // her yanda kaç sayfa görünsün

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

  /** Sayfa genişliği (px): kitabın yüksekliğinden ve ortadaki sayfanın oranından. */
  function leafWidth(page) {
    const H = book.clientHeight || 400;
    return H * page.size.w / page.size.h;
  }

  /** Yerleşim (Paper): çift sayfa hafif V; sonrakiler sağda çift sayfanın altında, şeritleri görünür;
   *  önceki sayfa solda üçte biri görünür, gerisi şerit. x: translateX, rot: rotateY, z: sıra. */
  function placeFor(index, W) {
    const cosT = Math.cos(TILT * Math.PI / 180);
    if (index === center) return { x: -W, rot: OPEN, z: 60, origin: "right center" };
    if (index === center + 1) return { x: 0, rot: -OPEN, z: 60, origin: "left center" };
    if (index < center) {
      const k = Math.min(center - index, VISIBLE);
      // sağ kenarı: -0.68W - k*STRIP (dönüş sağ kenar etrafında olduğundan sağ kenar sabit kalır)
      return { x: -0.68 * W - k * STRIP - W, rot: TILT, z: 40 - k, origin: "right center" };
    }
    const k = Math.min(index - center - 1, VISIBLE);
    // sol kenar etrafında döner; sağ kenarı W + k*STRIP olsun diye sol kenar = W + k*STRIP - W*cos
    return { x: W + k * STRIP - W * cosT, rot: -TILT, z: 40 - k, origin: "left center" };
  }

  /** Açılış: bütün sayfalar kapalı defter gibi ortada üst üste başlar, sırayla açılıp yerlerine kayar. */
  function intro() {
    render(false);
    const list = pages();
    const W = leafWidth(list[center] || list[0]);
    const all = [...book.querySelectorAll(".fan-leaf")];
    for (const leaf of all) {
      leaf.style.transition = "none";
      leaf.style.transform = `translateX(${-W / 2}px) rotateY(0deg) scale(0.9)`;
      leaf.style.opacity = "0";
    }
    void book.offsetWidth;   // yeniden akış: başlangıç konumu uygulansın
    setTimeout(() => {
      all.forEach((leaf) => {
        const index = Number(leaf.dataset.index);
        const dist = index <= center ? center - index : index - center - 1;
        const pos = placeFor(index, W);
        leaf.style.transition = `transform 0.75s cubic-bezier(0.22, 0.9, 0.25, 1) ${dist * 40}ms, opacity 0.3s ${dist * 40}ms`;
        leaf.style.opacity = "1";
        leaf.style.transform = `translateX(${pos.x}px) rotateY(${pos.rot}deg)`;
      });
    }, 30);
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
      const W = leafWidth(list[center]);
      const pos = placeFor(index, W);
      leaf.style.transition = animate ? "transform 0.55s cubic-bezier(0.25, 0.85, 0.25, 1)" : "none";
      leaf.style.transformOrigin = pos.origin;
      leaf.style.zIndex = String(pos.z);
      leaf.style.transform = `translateX(${pos.x}px) rotateY(${pos.rot}deg)`;
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
    leaf.append(h("div", { class: "fan-face front" }, pageFace(page)), h("div", { class: "fan-num" }));
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
    if (Math.abs(dx) <= w * 1.02) {
      const target = dx < 0 ? list[center] : (list[center + 1] || list[center]);
      if (target) navigate(`#/n/${notebookId}/p/${target.id}`);
    } else if (Math.abs(dx) <= w * 2.2) {
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

  intro();
  return { destroy() {} };
}
