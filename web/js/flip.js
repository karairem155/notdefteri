// Sayfa çevirme efekti: yaprak cilt kenarı etrafında 3B döner ve parmağın altında kıvrılır
// (yaprak dikey şeritlere bölünür, her şerit bir öncekine göre biraz daha döner: silindir bükülmesi).
// Parmakla sürüklemede ilerleme parmağı izler; bırakınca ya tamamlanır ya geri döner.
//
// buildSheet(dir) şunu döndürür:
//   { x, y, width, height, origin: "left"|"right", front: Element, back: Element, under: Element|null, underX, underY, startAngle, endAngle }
// `front`/`back` yaprağın iki yüzü; `under` yaprağın altında kalan sayfa (opsiyonel).

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
    const sheetEl = el("div", "flip-sheet flip-flat");
    sheetEl.style.left = sheet.x + "px";
    sheetEl.style.top = sheet.y + "px";
    sheetEl.style.width = W + "px";
    sheetEl.style.height = H + "px";
    sheetEl.style.transformOrigin = left ? "left center" : "right center";

    // Yaprağın iki yüzü: dönüş yarıyı geçince arka yüze geçilir, içerik aynalanarak düz okunur.
    const front = face("front", sheet.front, W, H);
    const back = face("back", sheet.back, W, H);
    back.el.style.display = "none";
    sheetEl.append(front.el, back.el);
    layer.append(sheetEl);
    spreadEl.append(layer);
    state = { dir, layer, sheetEl, sheet, front, back, cast, left, progress: 0, showingBack: false };
    apply(0);
    return true;
  }

  function angleFor(progress) {
    const { startAngle, endAngle } = state.sheet;
    return startAngle + (endAngle - startAngle) * progress;
  }

  /** Verilen ilerleme için yaprağı, yüzünü, gölgesini ve düşen gölgeyi yerleştirir. */
  function apply(progress) {
    const { sheet, sheetEl, front, back, cast, left } = state;
    const theta = angleFor(progress);
    const rad = theta * Math.PI / 180;
    const cos = Math.cos(rad);
    const lift = Math.sin(Math.PI * progress);

    // Dönüşün düzlemdeki karşılığı: yaprak menteşesinden yatay olarak daralır, yarıyı geçince aynalanır.
    sheetEl.style.transform = `scaleX(${cos.toFixed(4)})`;
    const showBack = cos < 0;
    if (state.showingBack !== showBack) {
      state.showingBack = showBack;
      front.el.style.display = showBack ? "none" : "block";
      back.el.style.display = showBack ? "block" : "none";
    }
    const yuz = showBack ? back : front;
    const koyu = Math.min(0.4, 0.05 + Math.abs(Math.sin(rad)) * 0.32).toFixed(3);
    const acik = Math.min(0.2, 0.02 + Math.abs(Math.sin(rad)) * 0.12).toFixed(3);
    const yon = (left === !showBack) ? 90 : 270;
    yuz.shade.style.opacity = "1";
    yuz.shade.style.background = `linear-gradient(${yon}deg, rgba(0,0,0,${koyu}), rgba(0,0,0,${acik}))`;

    // Yaprağın altındaki sayfaya düşen gölge: ciltten yaprağın izdüşümüne kadar.
    const W = sheet.width;
    const proj = W * cos;
    const spineX = left ? sheet.x : sheet.x + W;
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
    // Uygulama arka plana atılırsa kare döngüsü durur; bu emniyet sayacı çevirmeyi yarıda bırakmaz.
    let guard = setTimeout(() => done(), duration + 500);
    const done = () => {
      if (state !== current) return;
      clearTimeout(guard);
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
      current.progress = target;
      apply(target);
      state = null;
      if (onDone) onDone(commit);
      current.layer.remove();
    };
    const step = (now) => {
      if (state !== current) return;
      const t = Math.min(1, (now - t0) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      current.progress = from + (target - from) * eased;
      apply(current.progress);
      if (t < 1) { raf = requestAnimationFrame(step); return; }
      done();
    };
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(step);
  }

  /** Düğmeyle çevirme: kendi kendine akar. */
  function run(dir, onDone) {
    if (!begin(dir)) return false;
    setTimeout(() => finish(true, onDone), 16);
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

/** Bir yüz: yaprağın tamamı. Arka yüz aynalanır ki çevrildikten sonra düz okunsun. */
function face(side, content, W, H) {
  const node = el("div", "flip-face " + side);
  const wrap = el("div", "flip-face-wrap");
  wrap.style.width = W + "px";
  wrap.style.height = H + "px";
  wrap.style.left = "0px";
  wrap.append(content);
  const shade = el("div", "flip-shade");
  node.append(wrap, shade);
  return { el: node, shade };
}

// Kağıt çevirme sesi: yumuşak bir "hışırtı" (yavaş başlayıp sönen gürültü, tizden pese kayan süzgeç)
// ve sonunda hafif bir yaprak oturma sesi. Dosya gerektirmez; Ayarlar'dan kapatılabilir.
let audioCtx = null;
let paperClip = null;   // kullanıcının verdiği kağıt hışırtısı (gürültüsü azaltılmış)
function playPaperSound() {
  try {
    if (!paperClip) { paperClip = new Audio("./sounds/page-flip.mp3"); paperClip.preload = "auto"; paperClip.volume = 0.55; }
    const clip = paperClip.cloneNode();
    clip.volume = 0.55;
    const p = clip.play();
    if (p && p.then) { p.then(() => {}).catch(() => synthPaperSound()); return; }
    return;
  } catch (_) { /* dosya çalmazsa üretilen ses */ }
  synthPaperSound();
}

function synthPaperSound() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === "suspended") audioCtx.resume();
    const rate = audioCtx.sampleRate;
    const now = audioCtx.currentTime;
    const noise = (seconds) => {
      const length = Math.floor(rate * seconds);
      const buffer = audioCtx.createBuffer(1, length, rate);
      const data = buffer.getChannelData(0);
      let last = 0;
      for (let i = 0; i < length; i++) { const white = Math.random() * 2 - 1; last = (last + 0.35 * white) / 1.35; data[i] = last * 2.5; }   // yumuşatılmış (pembemsi) gürültü
      const src = audioCtx.createBufferSource();
      src.buffer = buffer;
      return src;
    };
    // 1) hışırtı
    const swish = noise(0.42);
    const band = audioCtx.createBiquadFilter();
    band.type = "bandpass";
    band.Q.value = 0.7;
    band.frequency.setValueAtTime(2600, now);
    band.frequency.exponentialRampToValueAtTime(650, now + 0.4);
    const g1 = audioCtx.createGain();
    g1.gain.setValueAtTime(0.0001, now);
    g1.gain.exponentialRampToValueAtTime(0.16, now + 0.09);
    g1.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);
    swish.connect(band); band.connect(g1); g1.connect(audioCtx.destination);
    swish.start(now);
    // 2) yaprağın oturması (hafif, pes)
    const settle = noise(0.12);
    const low = audioCtx.createBiquadFilter();
    low.type = "lowpass";
    low.frequency.value = 900;
    const g2 = audioCtx.createGain();
    g2.gain.setValueAtTime(0.0001, now + 0.3);
    g2.gain.exponentialRampToValueAtTime(0.07, now + 0.33);
    g2.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);
    settle.connect(low); low.connect(g2); g2.connect(audioCtx.destination);
    settle.start(now + 0.3);
  } catch (_) { /* ses yoksa sessiz devam */ }
}
