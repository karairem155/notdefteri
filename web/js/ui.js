// Küçük DOM yardımcıları: h() ile öğe kurma, kısa dokunma/uzun basma, modal ve eylem sayfası.

export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props || {})) {
    if (value === null || value === undefined || value === false) continue;
    if (key === "class") el.className = value;
    else if (key === "style" && typeof value === "object") {
      for (const [prop, v] of Object.entries(value)) {
        if (prop.startsWith("--")) el.style.setProperty(prop, v);
        else el.style[prop] = v;
      }
    }
    else if (key === "dataset") Object.assign(el.dataset, value);
    else if (key === "onTap" && typeof value === "function") tap(el, value);
    else if (key.startsWith("on") && typeof value === "function") el.addEventListener(key.slice(2).toLowerCase(), value);
    else if (key === "html") el.innerHTML = value;
    else if (value === true) el.setAttribute(key, "");
    else el.setAttribute(key, value);
  }
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return el;
}

export function svgIcon(name, size = 20) {
  const paths = {
    plus: "M12 5v14M5 12h14",
    trash: "M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3",
    back: "M15 5l-7 7 7 7",
    forward: "M9 5l7 7-7 7",
    undo: "M9 14L4 9l5-5M4 9h9a6 6 0 0 1 0 12h-2",
    redo: "M15 14l5-5-5-5M20 9h-9a6 6 0 0 0 0 12h2",
    grid: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z",
    list: "M5 7h14M5 12h14M5 17h14",
    books: "M5 4h4v16H5zM11 4h4v16h-4zM17 6l3-1 3 14-3 1z",
    gear: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z",
    page: "M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6",
    photo: "M4 5h16v14H4zM8 15l3-4 3 3 2-2 4 5",
    note: "M5 4h14v11l-5 5H5zM14 20v-5h5",
    eraser: "M3 17l8-8 6 6-5 5H8zM14 8l3-3 6 6-3 3",
    star: "M12 3l2.8 6 6.2.7-4.6 4.3 1.3 6.3-5.7-3.2-5.7 3.2 1.3-6.3L3 9.7 9.2 9z",
    rotate: "M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5",
    copy: "M8 8h12v12H8zM4 16V4h12",
    front: "M12 3l9 5-9 5-9-5zM3 13l9 5 9-5",
    check: "M5 12l5 5 9-10",
    share: "M12 3v12M8 7l4-4 4 4M5 13v7h14v-7",
    download: "M12 3v12M8 11l4 4 4-4M5 21h14",
    search: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4",
    heart: "M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z",
    pen: "M4 20l4-1 11-11-3-3L5 16zM14 6l3 3",
    close: "M6 6l12 12M18 6L6 18",
    pdf: "M7 3h7l5 5v13H7zM14 3v5h5",
    hand: "M8 13V5a1.5 1.5 0 0 1 3 0v6M11 11V4a1.5 1.5 0 0 1 3 0v7M14 11V6a1.5 1.5 0 0 1 3 0v6M17 12a1.5 1.5 0 0 1 3 1v3a6 6 0 0 1-6 6h-2a6 6 0 0 1-5-3l-3-5a1.5 1.5 0 0 1 2.5-1.5L8 14",
    move: "M12 3v18M3 12h18M8 7l4-4 4 4M8 17l4 4 4-4M7 8l-4 4 4 4M17 8l4 4-4 4",
    more: "M5 12h.01M12 12h.01M19 12h.01",
    down: "M6 9l6 6 6-6",
    scissors: "M6 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM20 4L8.5 15.5M8.5 8.5L20 20",
    up: "M6 15l6-6 6 6",
    lasso: "M12 4c4.4 0 8 2 8 4.5S16.4 13 12 13 4 11 4 8.5 7.6 4 12 4zM8 13.5c-1 2-1 4 0 6M9 19.5a1.5 1.5 0 1 0 0 .01",
    ruler: "M3 17L17 3l4 4L7 21zM8 12l2 2M11 9l2 2M14 6l2 2",
    highlighter: "M4 21h6M7 17l8.5-8.5 3 3L10 20H7zM15.5 8.5l2-2 3 3-2 2",
    tipGel: "M12 3v4M9.5 7h5l-1 9h-3zM10.5 16h3v4h-3z",
    tipFine: "M12 2v6M10.5 8h3v9h-3zM11.5 17h1v5h-1z",
    tipPencil: "M9 3h6v11l-3 7-3-7zM9 6h6",
    wave: "M3 14c3-7 6-7 9 0s6 7 9 0",
    lassoRect: "M4 4h4M10 4h4M16 4h4M4 20h4M10 20h4M16 20h4M4 4v4M4 10v4M4 16v4M20 4v4M20 10v4M20 16v4",
    shapeLine: "M4 20L20 4",
    shapeArrow: "M4 20L19 5M10 5h9v9",
    shapeRect: "M4 6h16v12H4z",
    shapeCircle: "M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16z",
    shapeTriangle: "M12 4l9 16H3z",
    shapes: "M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM7.5 16.5l9-9",
    text: "M4 6h10M9 6v14M15 11h5M17.5 11v9",
    mic: "M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3zM6 11a6 6 0 0 0 12 0M12 17v4M9 21h6",
    edit: "M4 20l4-1 11-11-3-3L5 16zM14 6l3 3",
    drag: "M9 5h.01M15 5h.01M9 12h.01M15 12h.01M9 19h.01M15 19h.01",
    duplicate: "M8 8h12v12H8zM4 16V4h12M14 11v6M11 14h6",
    layerUp: "M12 3l9 5-9 5-9-5zM3 13l9 5 9-5",
    layerDown: "M3 8l9-5 9 5-9 5zM3 16l9 5 9-5M12 10v6",
    play: "M7 5l12 7-12 7z",
    libraryBook: "M4 5h16v14H4zM12 5v14M7 9h2M15 9h2",
    penTool: "M4 20l3.5-1L19 7.5 16.5 5 5 16.5zM14 7.5l2.5 2.5M4 20l1-3.5",
    eraserTool: "M9 20H5l-2-2 9-9 6 6-5 5zM12 9l6 6",
    selectTool: "M4 4h3M10.5 4h3M17 4h3M4 20h3M10.5 20h3M17 20h3M4 4v3M4 10.5v3M4 17v3M20 4v3M20 10.5v3M20 17v3",
    shapesTool: "M8 4.5a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM15 11.5l5 8H10z",
    mediaTool: "M3.5 5h17v14h-17zM6.5 16l3.5-4.5 3 3 2-2 3.5 3.5M15.5 8.5h.01",
    textTool: "M6 5h12M8 5v1.5M16 5v1.5M12 5v14M9.5 19h5",
    stickersTool: "M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM9 10h.01M15 10h.01M8.5 14a4.5 3 0 0 0 7 0",
    undoTool: "M8 13L4 9l4-4M4 9h9.5a5.5 5.5 0 0 1 0 11H10",
    redoTool: "M16 13l4-4-4-4M20 9h-9.5a5.5 5.5 0 0 0 0 11H14",
    postit: "M5 4h14v10l-4 4H5zM15 18v-4h4",
    export: "M12 4v11M8 8l4-4 4 4M5 14v6h14v-6",
    camera: "M4 8h3l2-3h6l2 3h3v11H4zM12 17a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z",
    folder: "M3 6h6l2 2h10v11H3zM3 10h18",
    scan: "M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4M7 12h10",
    clock: "M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM12 8v4l3 2",
    photos: "M12 3a4 4 0 0 1 4 4 4 4 0 0 1 4 4 4 4 0 0 1-4 4 4 4 0 0 1-4 4 4 4 0 0 1-4-4 4 4 0 0 1-4-4 4 4 0 0 1 4-4 4 4 0 0 1 4-4z",
    translate: "M4 6h9M8.5 4v2M11 6c-1 4-3 7-6 9M6 9c1 3 3 5 6 6M13 20l4-9 4 9M14.5 17h5",
    frost: "M12 3v18M3 12h18M6 6l12 12M18 6L6 18",
    objects: "M4 4h7v7H4zM13 13h7v7h-7zM13 4h7v7h-7zM4 13h7v7H4z",
    audio: "M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3zM6 11a6 6 0 0 0 12 0M12 17v4",
    dragDots: "M9 5h.01M15 5h.01M9 12h.01M15 12h.01M9 19h.01M15 19h.01"
  };
  const d = paths[name] || paths.plus;
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", size);
  svg.setAttribute("height", size);
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "1.9");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", d);
  svg.append(path);
  return svg;
}

export function iconButton(name, label, onClick, extraClass = "") {
  return h("button", { class: "icon-btn " + extraClass, type: "button", "aria-label": label, title: label, onTap: onClick }, svgIcon(name));
}

/**
 * Dokunma: pointer olaylarıyla çalışır (iPad Safari'de "click" bazı dinamik öğelerde gelmiyor).
 * Parmak 12 px'den fazla kayarsa (kaydırma) tetiklenmez. Klavye için Enter/Space da çalışır.
 */
export function tap(el, handler) {
  let start = null;
  let lastFire = 0;
  const fire = (e) => { lastFire = Date.now(); handler(e); };
  el.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    start = { x: e.clientX, y: e.clientY, id: e.pointerId, t: Date.now() };
  });
  el.addEventListener("pointerup", (e) => {
    if (!start || e.pointerId !== start.id) return;
    const moved = Math.hypot(e.clientX - start.x, e.clientY - start.y) > 14;
    start = null;
    if (moved) return;
    e.preventDefault();
    fire(e);
  });
  // Kaydırma jesti dokunuşu iptal edebilir: parmak neredeyse hiç kaymadıysa yine de dokunuş sayılır.
  el.addEventListener("pointercancel", (e) => {
    const s = start;
    start = null;
    if (!s || e.pointerId !== s.id) return;
    const dx = (e.clientX == null ? s.x : e.clientX) - s.x;
    const dy = (e.clientY == null ? s.y : e.clientY) - s.y;
    if (Math.hypot(dx, dy) <= 7 && Date.now() - s.t < 600) fire(e);
  });
  // İşaretçi olayları büsbütün kaybolursa tarayıcının kendi click'i yedektir (tapFallback).
  el.addEventListener("click", (e) => { if (Date.now() - lastFire > 600) fire(e); });
  el.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handler(e); } });
  if (!el.hasAttribute("tabindex") && el.tagName !== "BUTTON" && el.tagName !== "INPUT") el.setAttribute("tabindex", "0");
}

/** Uzun basma: 450 ms basılı tutunca `onLong`, kısa dokunuşta `onTap`. Sürükleyince ikisi de iptal. */
export function pressable(el, { onTap, onLong, moveTolerance = 10 }) {
  let timer = null;
  let start = null;
  let longFired = false;
  el.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    start = { x: e.clientX, y: e.clientY };
    longFired = false;
    if (onLong) {
      timer = setTimeout(() => {
        longFired = true;
        timer = null;
        onLong(e);
      }, 450);
    }
  });
  const cancel = () => { if (timer) { clearTimeout(timer); timer = null; } start = null; };
  el.addEventListener("pointermove", (e) => {
    if (!start) return;
    if (Math.hypot(e.clientX - start.x, e.clientY - start.y) > moveTolerance) cancel();
  });
  let lastFire = 0;
  el.addEventListener("pointerup", (e) => {
    const wasPressed = !!start;
    const wasLong = longFired;
    cancel();
    if (wasPressed && !wasLong && onTap) { lastFire = Date.now(); onTap(e); }
  });
  el.addEventListener("pointercancel", (e) => {
    const s = start;
    const wasLong = longFired;
    cancel();
    if (!s || wasLong || !onTap) return;
    const dx = (e.clientX == null ? s.x : e.clientX) - s.x;
    const dy = (e.clientY == null ? s.y : e.clientY) - s.y;
    if (Math.hypot(dx, dy) <= 7) { lastFire = Date.now(); onTap(e); }
  });
  el.addEventListener("click", (e) => { if (onTap && !longFired && Date.now() - lastFire > 600) { lastFire = Date.now(); onTap(e); } });
  el.addEventListener("contextmenu", (e) => { if (onLong) e.preventDefault(); });
}

let modalRoot = null;

/** Modal: içeriği ortalanmış karta koyar. `close()` döndürür. */
export function openModal(content, { dark = false, wide = false, onClose } = {}) {
  closeModal();
  const card = h("div", { class: "modal-card" + (dark ? " dark" : "") + (wide ? " wide" : ""), role: "dialog", "aria-modal": "true" }, content);
  modalRoot = h("div", { class: "modal-backdrop" }, card);
  modalRoot.addEventListener("pointerup", (e) => { if (e.target === modalRoot) closeModal(); });
  document.body.append(modalRoot);
  modalRoot._onClose = onClose;
  return closeModal;
}

export function closeModal() {
  if (!modalRoot) return;
  const onClose = modalRoot._onClose;
  modalRoot.remove();
  modalRoot = null;
  if (onClose) onClose();
}

/** Eylem sayfası: başlık + düğme listesi. Her eylem { title, destructive, onSelect, disabled }. */
// Son dokunulan yer: menüler dokunulan düğmenin hemen yanında açılsın diye.
let lastTap = null;
document.addEventListener("pointerup", (e) => { lastTap = { x: e.clientX, y: e.clientY, target: e.target, at: Date.now() }; }, true);

/** Eylem menüsü: son dokunulan düğmeye bağlı küçük cam menü (tam ekran liste yerine). */
export function actionSheet(title, actions) {
  const recent = lastTap && Date.now() - lastTap.at < 2000 ? lastTap : null;
  const el = recent && recent.target && recent.target.closest ? recent.target.closest("button, [role=button], .swatch, .fav-row, .carousel-item, .placed, .cover-mark, .pen-btn, .tool-btn") : null;
  const anchor = el || (recent ? { left: recent.x - 1, top: recent.y - 1, right: recent.x + 1, bottom: recent.y + 1, width: 2, height: 2 }
    : { left: window.innerWidth / 2 - 1, top: window.innerHeight / 2 - 1, right: window.innerWidth / 2 + 1, bottom: window.innerHeight / 2 + 1, width: 2, height: 2 });
  popoverMenu(anchor, actions, { title });
}

export function confirmDialog(title, message, confirmTitle, onConfirm, destructive = true) {
  openModal(h("div", { class: "dialog" },
    h("h3", {}, title),
    message ? h("p", {}, message) : null,
    h("div", { class: "dialog-buttons" },
      h("button", { class: "btn", type: "button", onTap: closeModal }, "Vazgeç"),
      h("button", { class: "btn " + (destructive ? "danger" : "primary"), type: "button", onTap: () => { closeModal(); onConfirm(); } }, confirmTitle)
    )
  ));
}

export function promptDialog(title, placeholder, initial, onSubmit) {
  const input = h("input", { class: "text-input", type: "text", placeholder, value: initial || "", autocomplete: "off" });
  const submit = () => {
    const value = input.value.trim();
    if (!value) return;
    closeModal();
    onSubmit(value);
  };
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") submit(); });
  openModal(h("div", { class: "dialog" },
    h("h3", {}, title),
    input,
    h("div", { class: "dialog-buttons" },
      h("button", { class: "btn", type: "button", onTap: closeModal }, "Vazgeç"),
      h("button", { class: "btn primary", type: "button", onTap: submit }, "Kaydet")
    )
  ));
  setTimeout(() => input.focus(), 50);
}

let toastTimer = null;
export function toast(message, duration = 2600) {
  let el = document.querySelector(".toast");
  if (!el) {
    el = h("div", { class: "toast", role: "status" });
    document.body.append(el);
  }
  el.textContent = message;
  el.classList.add("show");
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), duration);
}

/** Gizli dosya girişini açar, seçilen dosyayı Promise ile verir. */
export function pickFile(inputId) {
  return new Promise((resolve) => {
    const input = document.getElementById(inputId);
    input.value = "";
    input.onchange = () => resolve(input.files && input.files[0] ? input.files[0] : null);
    input.click();
  });
}

export function formatPt(width) {
  return Number.isInteger(width) ? String(width) : width.toFixed(1);
}


/**
 * Bir düğmeye bağlı küçük menü: düğmenin hemen üstünde açılır (yer yoksa altında), ok işaretiyle.
 * Açıkken düğme "pop-open" sınıfı alır (+ simgesi 45° dönüp × olur). Dışarı dokununca kapanır.
 */
export function popoverMenu(anchor, actions, { title = null } = {}) {
  const backdrop = h("div", { class: "pop-backdrop" });
  const menu = h("div", { class: "pop-menu", role: "menu" },
    title ? h("div", { class: "pop-title" }, title) : null,
    ...actions.map((a) => h("button", { class: "pop-item" + (a.destructive ? " destructive" : ""), type: "button", role: "menuitem", disabled: a.disabled || null,
      onTap: () => { close(); a.onSelect(); } }, a.icon ? svgIcon(a.icon, 20) : null, h("span", {}, a.title))));
  const close = () => {
    menu.classList.remove("in");
    if (anchor.classList) anchor.classList.remove("pop-open");
    setTimeout(() => { menu.remove(); backdrop.remove(); }, 160);
  };
  backdrop.addEventListener("pointerdown", (e) => { e.preventDefault(); close(); });
  document.body.append(backdrop, menu);
  if (anchor.classList) anchor.classList.add("pop-open");
  const r = anchor.getBoundingClientRect ? anchor.getBoundingClientRect() : anchor;
  const w = menu.offsetWidth;
  const hgt = menu.offsetHeight;
  const left = Math.min(Math.max(12, r.left + r.width / 2 - w / 2), window.innerWidth - w - 12);
  let top = r.top - hgt - 16;
  let below = false;
  if (top < 12) { top = r.bottom + 16; below = true; }
  menu.style.left = left + "px";
  menu.style.top = top + "px";
  menu.style.setProperty("--arrow-x", (r.left + r.width / 2 - left) + "px");
  menu.classList.toggle("below", below);
  requestAnimationFrame(() => menu.classList.add("in"));
  return close;
}
