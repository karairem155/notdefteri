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
    more: "M5 12h.01M12 12h.01M19 12h.01"
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
  return h("button", { class: "icon-btn " + extraClass, type: "button", "aria-label": label, title: label, onClick }, svgIcon(name));
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
  el.addEventListener("pointerup", (e) => {
    const wasPressed = !!start;
    const wasLong = longFired;
    cancel();
    if (wasPressed && !wasLong && onTap) onTap(e);
  });
  el.addEventListener("pointercancel", cancel);
  el.addEventListener("contextmenu", (e) => { if (onLong) e.preventDefault(); });
}

let modalRoot = null;

/** Modal: içeriği ortalanmış karta koyar. `close()` döndürür. */
export function openModal(content, { dark = false, wide = false, onClose } = {}) {
  closeModal();
  const card = h("div", { class: "modal-card" + (dark ? " dark" : "") + (wide ? " wide" : ""), role: "dialog", "aria-modal": "true" }, content);
  modalRoot = h("div", { class: "modal-backdrop", onClick: (e) => { if (e.target === modalRoot) closeModal(); } }, card);
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
export function actionSheet(title, actions) {
  const list = actions.map((a) => h("button", {
    class: "sheet-action" + (a.destructive ? " destructive" : ""),
    type: "button",
    disabled: a.disabled || null,
    onClick: () => { closeModal(); a.onSelect(); }
  }, a.title));
  openModal(h("div", { class: "sheet" },
    title ? h("div", { class: "sheet-title" }, title) : null,
    ...list,
    h("button", { class: "sheet-action cancel", type: "button", onClick: closeModal }, "Vazgeç")
  ));
}

export function confirmDialog(title, message, confirmTitle, onConfirm, destructive = true) {
  openModal(h("div", { class: "dialog" },
    h("h3", {}, title),
    message ? h("p", {}, message) : null,
    h("div", { class: "dialog-buttons" },
      h("button", { class: "btn", type: "button", onClick: closeModal }, "Vazgeç"),
      h("button", { class: "btn " + (destructive ? "danger" : "primary"), type: "button", onClick: () => { closeModal(); onConfirm(); } }, confirmTitle)
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
      h("button", { class: "btn", type: "button", onClick: closeModal }, "Vazgeç"),
      h("button", { class: "btn primary", type: "button", onClick: submit }, "Kaydet")
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
