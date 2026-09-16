// Sayfa çevirme efekti: yaprak cilt kenarı etrafında 3B döner, altından sonraki sayfa görünür.
// Parmakla sürüklemede ilerleme parmağı izler; bırakınca ya tamamlanır ya geri döner.
//
// buildSheet(dir) şunu döndürür:
//   { x, y, width, height, origin: "left"|"right", front: Element, back: Element, under: Element|null, underX, underY, startAngle, endAngle }
// `front`/`back` yaprağın iki yüzü; `under` yaprağın altında kalan sayfa (opsiyonel).

export function createFlip(spreadEl, buildSheet) {
  let state = null;

  function begin(dir) {
    if (state) return false;
    const sheet = buildSheet(dir);
    if (!sheet) return false;
    const layer = document.createElement("div");
    layer.className = "flip-layer";
    if (sheet.under) {
      const under = document.createElement("div");
      under.className = "flip-under";
      under.style.left = sheet.underX + "px";
      under.style.top = sheet.underY + "px";
      under.append(sheet.under);
      layer.append(under);
    }
    const sheetEl = document.createElement("div");
    sheetEl.className = "flip-sheet";
    sheetEl.style.left = sheet.x + "px";
    sheetEl.style.top = sheet.y + "px";
    sheetEl.style.width = sheet.width + "px";
    sheetEl.style.height = sheet.height + "px";
    sheetEl.style.transformOrigin = sheet.origin === "left" ? "left center" : "right center";
    const front = document.createElement("div");
    front.className = "flip-face front";
    front.append(sheet.front, shade());
    const back = document.createElement("div");
    back.className = "flip-face back";
    back.append(sheet.back, shade());
    sheetEl.append(front, back);
    layer.append(sheetEl);
    spreadEl.append(layer);
    state = { dir, layer, sheetEl, sheet, progress: 0 };
    update(0);
    return true;
  }

  function angleFor(progress) {
    const { startAngle, endAngle } = state.sheet;
    return startAngle + (endAngle - startAngle) * progress;
  }

  function update(progress) {
    if (!state) return;
    state.progress = Math.max(0, Math.min(1, progress));
    const angle = angleFor(state.progress);
    state.sheetEl.style.transition = "none";
    state.sheetEl.style.transform = `rotateY(${angle}deg)`;
    const lift = Math.sin(Math.min(Math.PI, Math.abs(angle) * Math.PI / 180));
    state.sheetEl.style.filter = `drop-shadow(0 ${8 + lift * 24}px ${10 + lift * 30}px rgba(0,0,0,${0.25 + lift * 0.25}))`;
    for (const s of state.sheetEl.querySelectorAll(".flip-shade")) s.style.opacity = String(lift * 0.35);
  }

  /** commit=true ise sonuna kadar çevirir, false ise başa döner. Bitince onDone(committed). */
  function finish(commit, onDone) {
    if (!state) return;
    const current = state;
    const target = commit ? 1 : 0;
    const remaining = Math.abs(target - current.progress);
    const duration = Math.max(0.12, 0.42 * remaining);
    current.sheetEl.style.transition = `transform ${duration}s cubic-bezier(0.22, 0.8, 0.3, 1), filter ${duration}s`;
    current.sheetEl.style.transform = `rotateY(${angleFor(target)}deg)`;
    current.sheetEl.style.filter = "drop-shadow(0 8px 10px rgba(0,0,0,0.25))";
    for (const s of current.sheetEl.querySelectorAll(".flip-shade")) s.style.opacity = "0";
    const done = () => {
      if (state !== current) return;
      state = null;
      if (onDone) onDone(commit);
      current.layer.remove();
    };
    setTimeout(done, duration * 1000 + 20);
  }

  /** Düğmeyle çevirme: kendi kendine akar. */
  function run(dir, onDone) {
    if (!begin(dir)) return false;
    requestAnimationFrame(() => finish(true, onDone));
    return true;
  }

  function cancel() {
    if (!state) return;
    state.layer.remove();
    state = null;
  }

  return { begin, update, finish, run, cancel, get active() { return !!state; }, get sheetWidth() { return state ? state.sheet.width : 0; } };
}

function shade() {
  const el = document.createElement("div");
  el.className = "flip-shade";
  return el;
}
