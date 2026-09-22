// Defter seçilince açılan ekran: Paper'daki gibi açık, kalın bir kitap.
// Ortadaki çift sayfa cilde doğru hafif kıvrılır (V), arkadaki yapraklar cilt bloğu gibi
// dışa doğru azalarak yelpazelenir. Sayfa çevirme gerçek bir yaprak gibi cilt ekseninde
// bükülerek döner; defter açılırken kapak menteşesinden açılır.
import { store } from "./store.js";
import { h, svgIcon, actionSheet, confirmDialog } from "./ui.js";
import { renderPageCanvas, spillFor } from "./pagerender.js";
import { openAddPageSheet, openTemplatePicker } from "./addpage.js";
import { coverElement } from "./covers.js";
import { navigate } from "./app.js";

const VIS = 6;                                           // her yanda görünen yaprak sayısı
const FOLD = 34;                                         // açık çift sayfanın kıvrım açısı (derece)
const PERSP = 7.4;                                       // perspektif = PERSP × sayfa genişliği
const SHIFT = [0, 0.10, 0.28, 0.46, 0.65, 0.85, 1.06];   // yaprakların dışa kayması (sayfa genişliği çarpanı)
const DEPTH = [0, 0.06, 0.38, 0.77, 1.18, 1.57, 1.80];   // yaprakların derinliği
// Derinliğin ekrandaki karşılığı: yaprak ne kadar geride, o kadar küçük görünür.
const SCALE = DEPTH.map((depth) => PERSP / (PERSP + depth));
// Kıvrılmış yarım sayfanın ekranda kapladığı genişlik (sayfa genişliğinin katı).
const FOLD_X = Math.cos(FOLD * Math.PI / 180) * (PERSP / (PERSP - Math.sin(FOLD * Math.PI / 180)));
// Yaprak dış kenarının cilde uzaklığı (sayfa genişliği cinsinden): yelpazenin ekrana sığması için
const SPAN = SHIFT.map((shift, i) => (1 + shift) * SCALE[i]);
// Düz düzlemde çevrilen yaprağın ölçeği: uçlarda açık sayfanın genişliğine oturur.
const FLAT_FIT = FOLD_X / Math.cos(FOLD * Math.PI / 180);
const TURN_MS = 560;                                     // sayfa çevirme süresi
const ZOOM_MS = 460;                                     // defterin sahneye yaklaşması
const OPEN_DELAY = 200;                                  // kapak açılmadan önceki bekleme
const COVER_MS = 780;                                    // kapağın menteşeden açılması
const FAN_MS = 640;                                      // yaprakların yelpazeye yayılması

export function renderFan(root, notebookId) {
  const params = new URLSearchParams(location.hash.split("?")[1] || "");
  const pages = () => store.notebook(notebookId).pages;
  const spreadCount = () => Math.max(1, Math.ceil(pages().length / 2));
  const startIndex = Math.max(0, pages().findIndex((p) => p.id === params.get("p")));
  let spread = Math.floor(startIndex / 2);
  let pw = 240;
  let ph = 320;
  let vis = VIS;
  let busy = false;
  let queued = 0;
  let drag = null;

  const screen = h("div", { class: "screen screen-fan" });
  const topbar = h("div", { class: "fan-topbar" },
    h("button", { class: "fan-round", type: "button", "aria-label": "Defterlerim", onTap: () => navigate("#/") }, svgIcon("back", 22)),
    h("div", { style: { flex: "1" } }),
    h("button", { class: "fan-round", type: "button", "aria-label": "Sayfalar ızgarası", onTap: () => navigate(`#/n/${notebookId}/pages?p=${(pages()[spread * 2] || pages()[0]).id}`) }, svgIcon("grid", 22)),
    h("button", { class: "fan-round", type: "button", "aria-label": "Daha fazla", onTap: () => pageMenu(pages()[spread * 2]) }, svgIcon("more", 22))
  );
  const head = h("div", { class: "fan-head" });
  const stage = h("div", { class: "fan-stage pf-stage" });
  const floor = h("div", { class: "pf-floor" });
  const book = h("div", { class: "pf-book" });
  const leftHalf = h("div", { class: "pf-half pf-left" });
  const rightHalf = h("div", { class: "pf-half pf-right" });
  const leftShade = h("div", { class: "pf-shade-half" });
  const rightShade = h("div", { class: "pf-shade-half" });
  leftHalf.append(h("div", { class: "pf-paper" }), h("div", { class: "pf-gutter" }), leftShade);
  // Son sayfadan sonra sağ yarım kapağın iç yüzüdür: defter kapakla bitişik kapanır.
  const coverFace = h("div", { class: "pf-coverface pf-coverleaf" }, coverElement(store.notebook(notebookId).cover));
  rightHalf.append(h("div", { class: "pf-paper" }), coverFace, h("div", { class: "pf-gutter" }), rightShade);
  book.append(leftHalf, rightHalf);
  stage.append(floor, book);
  const foot = h("div", { class: "fan-foot" });
  screen.append(topbar, head, stage, foot);
  root.append(screen);

  const cards = new Map();      // yaprak anahtarı -> eleman (geçişlerde korunur)
  const imgCache = new Map();   // sayfa id -> data URL sözü

  /** Sayfanın gerçek görüntüsü (kağıt + nesneler + mürekkep). */
  function pageImage(page) {
    if (!page) return Promise.resolve(null);
    if (imgCache.has(page.id)) return imgCache.get(page.id);
    const target = Math.min(3, Math.max(1, (pw * (window.devicePixelRatio || 1) * 1.15) / page.size.w));
    const list = pages();
    const spill = spillFor(list, list.findIndex((p) => p.id === page.id));
    const promise = renderPageCanvas(page, target, { background: true, opaque: true, spill })
      .then((canvas) => canvas.toDataURL("image/jpeg", 0.88))
      .catch(() => null);
    imgCache.set(page.id, promise);
    return promise;
  }

  function paintInto(el, page) {
    const paper = el.querySelector(".pf-paper") || el;
    if (!page) { paper.style.backgroundImage = "none"; return; }
    if (paper.dataset.page === page.id) return;
    paper.dataset.page = page.id;
    pageImage(page).then((url) => { if (url && paper.dataset.page === page.id) paper.style.backgroundImage = `url(${url})`; });
  }

  /** Sahneyi ölçer: sayfa boyu ekrana göre, yelpaze taşmadan sığacak şekilde. */
  function measure() {
    const rect = stage.getBoundingClientRect();
    const first = pages()[0];
    const aspect = first ? first.size.w / first.size.h : 0.72;
    let height = Math.min(rect.height * 0.92, 580);
    let width = height * aspect;
    // Dar ekranda yelpaze taşmasın: önce görünen yaprak sayısı azalır, gerekirse sayfa küçülür.
    vis = VIS;
    const room = rect.width * 0.96;
    while (vis > 2 && 2 * SPAN[vis] * width > room) vis--;
    const maxWidth = room / (2 * SPAN[vis]);
    if (width > maxWidth) { width = maxWidth; height = width / aspect; }
    pw = Math.round(width);
    ph = Math.round(height);
    book.style.width = `${pw * 2}px`;
    book.style.height = `${ph}px`;
    stage.style.perspective = `${Math.round(pw * PERSP)}px`;
    floor.style.width = `${pw * 2.6}px`;
    floor.style.height = `${ph * 0.3}px`;
    floor.style.marginTop = `${ph * 0.62}px`;
    for (const el of [leftHalf, rightHalf]) { el.style.width = `${pw}px`; el.style.height = `${ph}px`; }
    leftHalf.style.transform = `scaleX(${FOLD_X})`;
    rightHalf.style.transform = `scaleX(${FOLD_X})`;
    rightHalf.style.left = `${pw}px`;
    for (const [key, el] of cards) { el.style.width = `${pw}px`; el.style.height = `${ph}px`; placeCard(el, Number(el.dataset.slot), el.dataset.side === "l" ? -1 : 1, false); }
  }

  /** Yaprağı yuvasına koyar: dışa kayma + derinlik (kitap bloğu). */
  function placeCard(el, slot, side, animate) {
    const j = Math.min(slot, SHIFT.length - 1);
    const k = SCALE[j];
    el.style.transition = animate ? `transform ${TURN_MS}ms cubic-bezier(0.25, 0.85, 0.3, 1), opacity 260ms linear` : "none";
    el.style.left = side < 0 ? "0px" : `${pw}px`;
    el.style.transformOrigin = side < 0 ? "right center" : "left center";
    el.style.transform = `translateX(${SHIFT[j] * pw * k * side}px) scale(${k})`;
    el.style.zIndex = String(20 - Math.min(slot, 18));
    el.style.opacity = slot > vis ? "0" : "1";
    el.dataset.slot = String(slot);
    el.dataset.side = side < 0 ? "l" : "r";
  }

  function makeCard(key) {
    const el = h("div", { class: "pf-card" }, h("div", { class: "pf-paper" }), h("div", { class: "pf-edge" }));
    el.dataset.key = key;
    el.style.width = `${pw}px`;
    el.style.height = `${ph}px`;
    book.insertBefore(el, leftHalf);
    cards.set(key, el);
    return el;
  }

  /** Yelpaze düzeni: ortadaki çift sayfa + iki yanda yapraklar (+ kapaklar). */
  function layout({ animate = true, keepLeftFace = false } = {}) {
    const list = pages();
    const total = spreadCount();
    spread = Math.min(Math.max(spread, 0), total - 1);
    head.replaceChildren(h("h1", {}, store.notebook(notebookId).title), h("div", { class: "sub" }, `${list.length} sayfa`));
    if (!keepLeftFace) paintInto(leftHalf, list[spread * 2]);
    paintInto(rightHalf, list[spread * 2 + 1]);
    rightHalf.classList.toggle("empty", !list[spread * 2 + 1]);

    const wanted = new Set();
    for (let j = 1; j <= vis; j++) {
      for (const side of [-1, 1]) {
        const index = spread + side * j;
        if (index < 0 || index >= total) continue;
        const key = "s" + index;
        wanted.add(key);
        const el = cards.get(key) || makeCard(key);
        const page = side < 0 ? list[index * 2] : (list[index * 2 + 1] || list[index * 2]);
        paintInto(el, page);
        placeCard(el, j, side, animate);
      }
    }
    // kapaklar: açılan ön kapak solda, arka kapak sağda kitabı kapatır
    const lastEmpty = !list[spread * 2 + 1];
    for (const [side, key] of [[-1, "cover-front"], [1, "cover-back"]]) {
      // Sağ sayfa yoksa kapak zaten sağ yarımda duruyor; yaprak olarak tekrar çizilmez.
      const slot = side < 0 ? spread + 1 : (lastEmpty ? vis + 2 : total - spread);
      const el = cards.get(key) || makeCoverCard(key);
      wanted.add(key);
      placeCard(el, slot, side, animate);
      el.classList.toggle("pf-hidden", slot > vis);
    }
    for (const [key, el] of cards) {
      if (wanted.has(key)) continue;
      el.style.opacity = "0";
      const dead = el;
      cards.delete(key);
      setTimeout(() => dead.remove(), animate ? TURN_MS : 0);
    }
    foot.replaceChildren(
      h("div", { class: "fan-nav" },
        Object.assign(h("button", { class: "fan-round small", type: "button", "aria-label": "Önceki sayfa", onTap: () => turn(-1) }, svgIcon("back", 18)), { disabled: spread <= 0 }),
        h("button", { class: "fan-round small", type: "button", "aria-label": "Sayfa ekle", onTap: () => openAddPageSheet(notebookId, spread * 2 + 2, (id) => { const i = pages().findIndex((p) => p.id === id); spread = Math.floor(Math.max(0, i) / 2); rebuild(); }) }, svgIcon("plus", 18)),
        Object.assign(h("button", { class: "fan-round small", type: "button", "aria-label": "Sonraki sayfa", onTap: () => turn(1) }, svgIcon("forward", 18)), { disabled: spread + 1 >= total })),
      h("div", { class: "fan-count" }, `${spread * 2 + 1}${list[spread * 2 + 1] ? "-" + (spread * 2 + 2) : ""} / ${list.length}`)
    );
  }

  function makeCoverCard(key) {
    const el = h("div", { class: "pf-card pf-coverleaf" });
    const cover = coverElement(store.notebook(notebookId).cover);
    el.append(cover, h("div", { class: "pf-edge" }));
    el.dataset.key = key;
    el.style.width = `${pw}px`;
    el.style.height = `${ph}px`;
    book.insertBefore(el, leftHalf);
    cards.set(key, el);
    return el;
  }

  function rebuild() {
    for (const [, el] of cards) el.remove();
    cards.clear();
    imgCache.clear();
    leftHalf.querySelector(".pf-paper").dataset.page = "";
    rightHalf.querySelector(".pf-paper").dataset.page = "";
    measure();
    layout({ animate: false });
  }

  /** Çevrilen yaprak: cilt ekseninde döner. Dönüşün ekrandaki karşılığı yatay daralmadır;
   *  yarıyı geçince yüz değişir ve içerik aynalanarak düz okunur. */
  function makeLeaf(frontPage, backPage, side) {
    const leaf = h("div", { class: "pf-turn " + (side > 0 ? "pf-turn-r" : "pf-turn-l") + " pf-turn-flat" });
    leaf.style.width = `${pw}px`;
    leaf.style.height = `${ph}px`;
    leaf.style.left = side > 0 ? `${pw}px` : "0px";
    leaf.style.transformOrigin = side > 0 ? "left center" : "right center";
    const face = h("div", { class: "pf-sface pf-flatface" });
    const shade = h("div", { class: "pf-sshade" });
    face.style.backgroundSize = `${pw}px ${ph}px`;
    leaf.append(face, shade);
    book.append(leaf);
    const flatFace = { el: face, shade, front: null, back: null, showingBack: null };
    pageImage(frontPage).then((url) => { flatFace.front = url; if (url && flatFace.showingBack !== true) face.style.backgroundImage = `url(${url})`; });
    pageImage(backPage).then((url) => { flatFace.back = url; if (url && flatFace.showingBack === true) face.style.backgroundImage = `url(${url})`; });
    return { leaf, flatFace };
  }

  /** İleri/geri bir çift sayfa: yaprak ciltten dönerken yelpaze de yeni yuvalarına kayar. */
  function turn(dir) {
    // Hızlı arka arkaya dokunuşlar kaybolmasın: çeviri sürerken gelen istek sıraya girer.
    if (busy) { queued = Math.max(-2, Math.min(2, queued + dir)); return; }
    const list = pages();
    const total = spreadCount();
    const next = spread + dir;
    if (next < 0 || next >= total) return;
    busy = true;
    const frontPage = dir > 0 ? list[spread * 2 + 1] : list[spread * 2];
    const backPage = dir > 0 ? list[next * 2] : (list[next * 2 + 1] || list[next * 2]);
    const { leaf, flatFace } = makeLeaf(frontPage, backPage, dir);
    const from = dir > 0 ? -FOLD : FOLD;
    const to = dir > 0 ? -(180 - FOLD) : (180 - FOLD);

    // çevrilen yüzün arkasındaki yeni sayfa hemen yerini alsın; diğer yüz yaprak inene kadar kalsın
    if (dir > 0) paintInto(rightHalf, list[next * 2 + 1]);
    else paintInto(leftHalf, list[next * 2]);
    spread = next;
    layout({ animate: true, keepLeftFace: true });
    if (dir > 0) paintInto(rightHalf, list[next * 2 + 1]);

    const start = performance.now();
    // Elle savrulan bir yaprak: başta hafif hızlanır, sonuna doğru yavaşlayarak oturur.
    const ease = (t) => 0.62 * (1 - Math.pow(1 - t, 2.5)) + 0.38 * (0.5 - 0.5 * Math.cos(Math.PI * t));
    const step = (now) => {
      const p = Math.min(1, (now - start) / TURN_MS);
      const e = ease(p);
      const base = from + (to - from) * e;
      const glow = Math.abs(Math.sin(base * Math.PI / 180));   // yaprak dikleştikçe kararır
      const cos = Math.cos(base * Math.PI / 180);
      const showBack = cos < 0;
      if (flatFace.showingBack !== showBack) {
        flatFace.showingBack = showBack;
        const url = showBack ? flatFace.back : flatFace.front;
        if (url) flatFace.el.style.backgroundImage = `url(${url})`;
        flatFace.el.style.transform = showBack ? "scaleX(-1)" : "none";
      }
      // Uçlarda açık sayfanın kıvrımıyla birebir örtüşsün diye ölçeklenir.
      leaf.style.transform = `scaleX(${(cos * FLAT_FIT).toFixed(4)})`;
      const koyu = (0.04 + glow * 0.16).toFixed(3);
      const acik = (0.02 + glow * 0.06).toFixed(3);
      const yon = (dir > 0) === !showBack ? "90deg" : "270deg";
      flatFace.shade.style.background = `linear-gradient(${yon}, rgba(12, 14, 34, ${koyu}), rgba(12, 14, 34, ${acik}))`;
      flatFace.shade.style.opacity = "1";
      // kalkan yaprağın altındaki sayfaya düşen gölge: cilde yakın koyu, dışa doğru açılır
      const spreadShadow = Math.abs(Math.cos(base * Math.PI / 180));
      const fade = Math.sin(Math.PI * p);
      const near = dir > 0 ? rightShade : leftShade;
      const far = dir > 0 ? leftShade : rightShade;
      near.style.opacity = String(fade * spreadShadow * 0.5);
      near.style.backgroundSize = `${18 + 72 * spreadShadow}% 100%`;
      far.style.opacity = String(e > 0.5 ? fade * (1 - spreadShadow) * 0.45 : 0);
      far.style.backgroundSize = `${18 + 72 * (1 - spreadShadow)}% 100%`;
      if (p < 1) requestAnimationFrame(step);
      else finish();
    };
    const finish = () => {
      if (dir > 0) paintInto(leftHalf, list[next * 2]);
      else paintInto(rightHalf, list[next * 2 + 1]);
      leftShade.style.opacity = "0";
      rightShade.style.opacity = "0";
      leaf.remove();
      busy = false;
      layout({ animate: false });
      if (queued) { const again = queued > 0 ? 1 : -1; queued -= again; turn(again); }
    };
    requestAnimationFrame(step);
  }

  /** Açılış: kapalı defter görünür, kapak ciltten açılır, yapraklar sırayla yelpazelenir. */
  function intro() {
    // Önce başlık ve alt bar dolsun: sahnenin gerçek yüksekliği ancak o zaman ölçülebilir.
    layout({ animate: false });
    measure();
    layout({ animate: false });
    const ms = (value) => Math.round(value);
    // kapalı defter: hafifçe yan dönük durur, sayfa bloğu ve sırtı görünür
    const closed = h("div", { class: "pf-openbook" });
    closed.style.width = `${pw}px`;
    closed.style.height = `${ph}px`;
    closed.style.left = `${pw}px`;
    closed.style.transform = "rotateY(-18deg)";
    closed.append(coverElement(store.notebook(notebookId).cover));
    book.append(closed);
    // kapalıyken defter ekranın ortasında durur, açılırken cilt ortaya kayar
    book.style.transition = "none";
    book.style.transform = `translateX(${-pw / 2}px) scale(0.9)`;
    for (const [, el] of cards) { el.style.transition = "none"; el.style.transform = "translateX(0) scale(1)"; el.style.opacity = "0"; }
    leftHalf.style.opacity = "0";
    rightHalf.style.opacity = "0";
    requestAnimationFrame(() => {
      book.style.transition = `transform ${ms(ZOOM_MS)}ms cubic-bezier(0.2, 0.85, 0.3, 1)`;
      book.style.transform = `translateX(${-pw / 2}px) scale(1)`;
      setTimeout(() => {
        // kapak menteşeden açılır; kapak açılırken yapraklar da sırayla yelpazeye yayılır
        closed.classList.add("pf-openbook-open");
        closed.style.transition = `transform ${ms(COVER_MS)}ms cubic-bezier(0.34, 0.86, 0.28, 1)`;
        // kapak tam açılıp sol yaprak yuvasına yatar: oradaki kapak yaprağıyla birebir örtüşür
        closed.style.transform = `translate3d(${-SHIFT[1] * pw}px, 0, ${-DEPTH[1] * pw}px) rotateY(-180deg)`;
        book.style.transition = `transform ${ms(COVER_MS)}ms cubic-bezier(0.34, 0.86, 0.28, 1)`;
        book.style.transform = "translateX(0px) scale(1)";
        rightHalf.style.opacity = "1";     // sağ sayfa kapağın altından çıkar
        for (const [, el] of cards) {
          const slot = Number(el.dataset.slot) || 1;
          // soldaki yapraklar kapak yerine oturduktan sonra görünür
          const delay = el.dataset.side === "l" ? ms(COVER_MS) : ms(60 + slot * 52);
          el.style.transition = `transform ${ms(FAN_MS)}ms cubic-bezier(0.2, 0.85, 0.28, 1) ${delay}ms, opacity ${ms(320)}ms linear ${delay}ms`;
          placeCardKeep(el);
        }
        // kapak sol tarafa geçerken altından ilk sayfa çıkar
        setTimeout(() => {
          leftHalf.style.transition = `opacity ${ms(180)}ms linear`;
          leftHalf.style.opacity = "1";
        }, ms(COVER_MS * 0.5));
        setTimeout(() => {
          closed.remove();
          book.style.transition = "";
          book.style.transform = "";
          leftHalf.style.transition = "";
          layout({ animate: false });
        }, ms(COVER_MS + 40));
      }, ms(OPEN_DELAY));
    });
  }

  function placeCardKeep(el) {
    const slot = Number(el.dataset.slot) || 1;
    const side = el.dataset.side === "l" ? -1 : 1;
    const j = Math.min(slot, SHIFT.length - 1);
    const k = SCALE[j];
    el.style.transform = `translateX(${SHIFT[j] * pw * k * side}px) scale(${k})`;
    el.style.opacity = slot > vis ? "0" : "1";
  }

  // Dokunma ve kaydırma: 3B yüzlerde güvenilir olsun diye koordinatla.
  stage.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: false, done: false, time: Date.now() };
    drag.timer = setTimeout(() => { if (drag && !drag.moved) { drag.done = true; pageMenu(pageAt(drag.x)); } }, 600);
  });
  stage.addEventListener("pointermove", (e) => {
    if (!drag || drag.done || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x;
    if (Math.abs(dx) > 12 || Math.abs(e.clientY - drag.y) > 12) { drag.moved = true; clearTimeout(drag.timer); }
    if (dx < -60) { drag.done = true; turn(1); }
    else if (dx > 60) { drag.done = true; turn(-1); }
  });
  const endDrag = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    clearTimeout(drag.timer);
    const tap = !drag.moved && !drag.done && e.type === "pointerup";
    const at = drag.x;
    drag = null;
    if (!tap || busy) return;
    if (e.target && e.target.closest && e.target.closest("button")) return;
    const rect = book.getBoundingClientRect();
    if (e.clientY < rect.top - 24 || e.clientY > rect.bottom + 24) return;
    const dx = at - (rect.left + rect.right) / 2;
    if (Math.abs(dx) <= pw * 0.92) {
      const list = pages();
      if (dx > 0 && !list[spread * 2 + 1]) return;   // burası kapak, sayfa değil
      const page = pageAt(at);
      if (page) navigate(`#/n/${notebookId}/p/${page.id}`);
    } else if (Math.abs(dx) <= pw * 2.4) {
      turn(dx < 0 ? -1 : 1);
    }
  };
  stage.addEventListener("pointerup", endDrag);
  stage.addEventListener("pointercancel", endDrag);

  function pageAt(clientX) {
    const rect = book.getBoundingClientRect();
    const dx = clientX - (rect.left + rect.right) / 2;
    const list = pages();
    return dx < 0 ? list[spread * 2] : (list[spread * 2 + 1] || list[spread * 2]);
  }

  function pageMenu(page) {
    if (!page) return;
    const list = pages();
    const index = list.findIndex((p) => p.id === page.id);
    actionSheet(`${index + 1}. sayfa`, [
      { title: "Aç", onSelect: () => navigate(`#/n/${notebookId}/p/${page.id}`) },
      { title: "Şablonu Değiştir", onSelect: () => openTemplatePicker((template) => { store.setTemplate(notebookId, page.id, template); rebuild(); }) },
      { title: "Çoğalt", onSelect: () => { const id = store.duplicatePage(notebookId, page.id); if (id) spread = Math.floor(pages().findIndex((p) => p.id === id) / 2); rebuild(); } },
      { title: "Öne Taşı", disabled: index === 0, onSelect: () => { store.movePage(notebookId, page.id, index - 1); rebuild(); } },
      { title: "Arkaya Taşı", disabled: index >= list.length - 1, onSelect: () => { store.movePage(notebookId, page.id, index + 1); rebuild(); } },
      { title: "Sil", destructive: true, disabled: list.length <= 1, onSelect: () => confirmDialog("Bu sayfa silinsin mi?", "Sayfa ve üzerindeki yazılar silinir.", "Sayfayı Sil", () => { store.deletePage(notebookId, page.id); rebuild(); }) }
    ]);
  }

  // Ekran döndüğünde ya da sahnenin boyu değiştiğinde yelpaze yeniden ölçülür.
  let resizeTimer = null;
  const onResize = () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { if (!busy) { measure(); layout({ animate: false }); } }, 120);
  };
  window.addEventListener("resize", onResize);
  const observer = typeof ResizeObserver === "function" ? new ResizeObserver(onResize) : null;
  if (observer) observer.observe(stage);
  requestAnimationFrame(intro);
  return { destroy() { clearTimeout(resizeTimer); window.removeEventListener("resize", onResize); if (observer) observer.disconnect(); } };
}
