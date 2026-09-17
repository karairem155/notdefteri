// Sayfa çevirme efekti: yaprak cilt kenarı etrafında 3B döner ve parmağın altında kıvrılır
// (yaprak dikey şeritlere bölünür, her şerit bir öncekine göre biraz daha döner: silindir bükülmesi).
// Parmakla sürüklemede ilerleme parmağı izler; bırakınca ya tamamlanır ya geri döner.
//
// buildSheet(dir) şunu döndürür:
//   { x, y, width, height, origin: "left"|"right", front: Element, back: Element, under: Element|null, underX, underY, startAngle, endAngle }
// `front`/`back` yaprağın iki yüzü; `under` yaprağın altında kalan sayfa (opsiyonel).

const STRIPS = 12;      // yaprak kaç şeride bölünsün
const BEND_MAX = 44;    // çevirmenin ortasında toplam bükülme (derece)
const OVERLAP = 3;      // şeritler arası bindirme (px): kenar yumuşatma çizgileri görünmesin

export function createFlip(spreadEl, buildSheet, options = {}) {
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
      strip.style.width = (sw + OVERLAP) + "px";
      strip.style.height = H + "px";
      // Sol menteşe: şerit 0 ciltte (x=0), sonrakiler sağa doğru. Sağ menteşe: şerit 0 sağ kenarda (x=W-sw),
      // sonrakiler sola doğru; menteşe her şeridin kutusunda x=sw noktasıdır (bindirme payı sağa taşar).
      strip.style.left = i === 0 ? (left ? "0px" : (W - sw) + "px") : (left ? sw : -sw) + "px";
      strip.style.transformOrigin = left ? "left center" : `${sw}px center`;
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
    let bend = BEND_MAX * lift * dirSign;
    // Cilt tarafı düzlemin altına inmesin: taban açısı başlangıç-bitiş aralığında kalır.
    const lo = Math.min(sheet.startAngle, sheet.endAngle);
    const hi = Math.max(sheet.startAngle, sheet.endAngle);
    let base = theta - bend;
    if (base < lo) { base = lo; bend = theta - base; }
    if (base > hi) { base = hi; bend = theta - base; }
    const delta = bend / STRIPS;
    sheetEl.style.transform = `rotateY(${base}deg)`;
    for (let i = 0; i < strips.length; i++) {
      const s = strips[i];
      s.el.style.transform = `rotateY(${delta}deg)`;
      // Gölge şerit içinde de akar (menteşe tarafından uzak kenara): bant bant görünmesin.
      const a0 = (base + i * delta) * Math.PI / 180;
      const a1 = (base + (i + 1) * delta) * Math.PI / 180;
      const fo = (a) => Math.min(0.42, Math.max(0, (1 - Math.cos(a)) / 2 * 0.5)).toFixed(3);
      const bo = (a) => Math.min(0.42, Math.max(0, (1 + Math.cos(a)) / 2 * 0.5)).toFixed(3);
      s.front.shade.style.opacity = "1";
      s.back.shade.style.opacity = "1";
      s.front.shade.style.background = `linear-gradient(${left ? 90 : 270}deg, rgba(0,0,0,${fo(a0)}), rgba(0,0,0,${fo(a1)}))`;
      s.back.shade.style.background = `linear-gradient(${left ? 270 : 90}deg, rgba(0,0,0,${bo(a0)}), rgba(0,0,0,${bo(a1)}))`;
    }
    // Yaprağın altındaki sayfaya düşen gölge: ciltten yaprağın izdüşümüne kadar.
    const W = sheet.width;
    const proj = W * Math.cos(theta * Math.PI / 180);
    const spineX = left ? sheet.x : sheet.x + W;
    // Gölge yalnızca sahnenin (sayfaların) içinde kalır; masaya taşmaz.
    const stageW = spreadEl.clientWidth || (sheet.x + W);
    const rawX0 = Math.min(spineX, left ? spineX + proj : spineX - proj);
    const x0 = Math.max(0, rawX0);
    const x1 = Math.min(stageW, rawX0 + Math.abs(proj));
    const width = Math.max(0, x1 - x0);
    cast.style.left = x0 + "px";
    cast.style.width = width + "px";
    const towardEdge = (left ? proj >= 0 : proj < 0);
    cast.style.background = towardEdge
      ? "linear-gradient(90deg, rgba(0,0,0,0), rgba(0,0,0,0.28))"
      : "linear-gradient(270deg, rgba(0,0,0,0), rgba(0,0,0,0.28))";
    cast.style.opacity = String(lift * 0.5);
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
    if (commit && options.sound && options.sound()) playPaperSound();
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


// Kağıt çevirme sesi: kısa bir gürültü patlaması, bant geçiren süzgeç ve hızlı sönüm (dosya gerektirmez).
let audioCtx = null;
function playPaperSound() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === "suspended") audioCtx.resume();
    const rate = audioCtx.sampleRate;
    const length = Math.floor(rate * 0.22);
    const buffer = audioCtx.createBuffer(1, length, rate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      const t = i / length;
      const env = Math.pow(1 - t, 2.2) * (t < 0.05 ? t / 0.05 : 1);
      data[i] = (Math.random() * 2 - 1) * env;
    }
    const src = audioCtx.createBufferSource();
    src.buffer = buffer;
    const filter = audioCtx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 1400;
    filter.Q.value = 0.9;
    const gain = audioCtx.createGain();
    gain.gain.value = 0.35;
    src.connect(filter); filter.connect(gain); gain.connect(audioCtx.destination);
    src.start();
  } catch (_) { /* ses yoksa sessiz devam */ }
}
