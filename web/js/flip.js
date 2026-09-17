// Sayfa çevirme efekti: yaprak cilt kenarı etrafında 3B döner ve parmağın altında kıvrılır
// (yaprak dikey şeritlere bölünür, her şerit bir öncekine göre biraz daha döner: silindir bükülmesi).
// Parmakla sürüklemede ilerleme parmağı izler; bırakınca ya tamamlanır ya geri döner.
//
// buildSheet(dir) şunu döndürür:
//   { x, y, width, height, origin: "left"|"right", front: Element, back: Element, under: Element|null, underX, underY, startAngle, endAngle }
// `front`/`back` yaprağın iki yüzü; `under` yaprağın altında kalan sayfa (opsiyonel).

const STRIPS = 12;      // yaprak kaç şeride bölünsün
const BEND_MAX = 64;    // çevirmenin ortasında toplam bükülme (derece)

export function createFlip(spreadEl, buildSheet) {
  let state = null;
  let raf = 0;

  function begin(dir) {
    if (state) return false;
    const sheet = buildSheet(dir);
    if (!sheet) return false;
    const layer = el("div", "flip-layer");
    if (sheet.under) {
      const under = el("div", "flip-under");
      under.style.left = sheet.underX + "px";
      under.style.top = sheet.underY + "px";
      under.append(sheet.under);
      layer.append(under);
    }
    const cast = el("div", "flip-cast");
    cast.style.top = sheet.y + "px";
    cast.style.height = sheet.height + "px";
    layer.append(cast);

    const left = sheet.origin === "left";
    const W = sheet.width;
    const H = sheet.height;
    const sw = W / STRIPS;
    const sheetEl = el("div", "flip-sheet");
    sheetEl.style.left = sheet.x + "px";
    sheetEl.style.top = sheet.y + "px";
    sheetEl.style.width = W + "px";
    sheetEl.style.height = H + "px";
    sheetEl.style.transformOrigin = left ? "left center" : "right center";

    const strips = [];
    let parent = sheetEl;
    const cache = new Map();
    for (let i = 0; i < STRIPS; i++) {
      const strip = el("div", "flip-strip");
      strip.style.width = (sw + 0.8) + "px";   // şeritler arasında ince boşluk kalmasın
      strip.style.height = H + "px";
      strip.style.left = i === 0 ? "0px" : (left ? sw : -sw) + "px";
      strip.style.transformOrigin = left ? "left center" : "right center";
      const frontOff = left ? i * sw : W - (i + 1) * sw;
      const backOff = left ? W - (i + 1) * sw : i * sw;
      const front = face("front", i === 0 ? sheet.front : cloneFace(sheet.front, cache), frontOff, W, H);
      const back = face("back", i === 0 ? sheet.back : cloneFace(sheet.back, cache), backOff, W, H);
      strip.append(front.el, back.el);
      parent.append(strip);
      parent = strip;
      strips.push({ el: strip, front, back });
    }
    layer.append(sheetEl);
    spreadEl.append(layer);
    state = { dir, layer, sheetEl, sheet, strips, cast, left, progress: 0 };
    apply(0);
    return true;
  }

  function angleFor(progress) {
    const { startAngle, endAngle } = state.sheet;
    return startAngle + (endAngle - startAngle) * progress;
  }

  /** Verilen ilerleme için bütün şeritleri, gölgeleri ve düşen gölgeyi yerleştirir. */
  function apply(progress) {
    const { sheet, sheetEl, strips, cast, left } = state;
    const theta = angleFor(progress);
    const dirSign = Math.sign(sheet.endAngle - sheet.startAngle) || 1;
    const lift = Math.sin(Math.PI * progress);
    const bend = BEND_MAX * lift * dirSign;
    const base = theta - bend;
    const delta = bend / STRIPS;
    sheetEl.style.transform = `rotateY(${base}deg)`;
    for (let i = 0; i < strips.length; i++) {
      const s = strips[i];
      s.el.style.transform = `rotateY(${delta}deg)`;
      const a = (base + (i + 1) * delta) * Math.PI / 180;
      const c = Math.cos(a);
      // Öne bakan yüz düz dururken aydınlık, dikleştikçe kararır; arka yüz tersi.
      s.front.shade.style.opacity = String(Math.min(0.75, Math.max(0, (1 - c) / 2 * 0.9)));
      s.back.shade.style.opacity = String(Math.min(0.75, Math.max(0, (1 + c) / 2 * 0.9)));
    }
    // Yaprağın altındaki sayfaya düşen gölge: ciltten yaprağın izdüşümüne kadar.
    const W = sheet.width;
    const proj = W * Math.cos(theta * Math.PI / 180);
    const spineX = left ? sheet.x : sheet.x + W;
    const x0 = Math.min(spineX, left ? spineX + proj : spineX - proj);
    const width = Math.abs(proj);
    cast.style.left = x0 + "px";
    cast.style.width = width + "px";
    const towardEdge = (left ? proj >= 0 : proj < 0);
    cast.style.background = towardEdge
      ? "linear-gradient(90deg, rgba(0,0,0,0.05), rgba(0,0,0,0.55))"
      : "linear-gradient(270deg, rgba(0,0,0,0.05), rgba(0,0,0,0.55))";
    cast.style.opacity = String(lift * 0.7);
  }

  function update(progress) {
    if (!state) return;
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    state.progress = Math.max(0, Math.min(1, progress));
    apply(state.progress);
  }

  /** commit=true ise sonuna kadar çevirir, false ise başa döner. Bitince onDone(committed). */
  function finish(commit, onDone) {
    if (!state) return;
    const current = state;
    const target = commit ? 1 : 0;
    const from = current.progress;
    const remaining = Math.abs(target - from);
    const duration = Math.max(140, 520 * remaining);
    const t0 = performance.now();
    const step = (now) => {
      if (state !== current) return;
      const t = Math.min(1, (now - t0) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      current.progress = from + (target - from) * eased;
      apply(current.progress);
      if (t < 1) { raf = requestAnimationFrame(step); return; }
      raf = 0;
      state = null;
      if (onDone) onDone(commit);
      current.layer.remove();
    };
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(step);
  }

  /** Düğmeyle çevirme: kendi kendine akar. */
  function run(dir, onDone) {
    if (!begin(dir)) return false;
    requestAnimationFrame(() => finish(true, onDone));
    return true;
  }

  function cancel() {
    if (!state) return;
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    state.layer.remove();
    state = null;
  }

  return { begin, update, finish, run, cancel, get active() { return !!state; }, get sheetWidth() { return state ? state.sheet.width : 0; } };
}

function el(tag, className) {
  const node = document.createElement(tag);
  node.className = className;
  return node;
}

/** Bir yüz: şerit genişliğinde pencere, içinde tam sayfa kaydırılmış durur. */
function face(side, content, offset, W, H) {
  const node = el("div", "flip-face " + side);
  const wrap = el("div", "flip-face-wrap");
  wrap.style.width = W + "px";
  wrap.style.height = H + "px";
  wrap.style.left = -offset + "px";
  wrap.append(content);
  const shade = el("div", "flip-shade");
  node.append(wrap, shade);
  return { el: node, shade };
}

/** Yüz içeriğini kopyalar; tuvaller (canvas) kopyada boş kalacağından görüntüye çevrilir. */
function cloneFace(src, cache) {
  const clone = src.cloneNode(true);
  const srcCanvases = src.querySelectorAll("canvas");
  const dstCanvases = clone.querySelectorAll("canvas");
  dstCanvases.forEach((c, i) => {
    const original = srcCanvases[i];
    let url = cache.get(original);
    if (url === undefined) {
      try { url = original.toDataURL(); } catch (_) { url = ""; }
      cache.set(original, url);
    }
    const img = document.createElement("img");
    img.className = c.className;
    img.style.cssText = c.style.cssText;
    img.alt = "";
    if (url) img.src = url;
    c.replaceWith(img);
  });
  return clone;
}
