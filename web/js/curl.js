// Sayfa kıvrımı — yaprağın köşesinden tutup çevirme.
//
// ── Neden tuval ─────────────────────────────────────────────────────────────
//
// Eski çevirme DOM'du: yaprak `scaleX(cos açı)` ile daralıyordu, yani kâğıt
// hep düz kalıyordu. Gerçek defterde kâğıt köşesinden kalkar, katlanır ve
// arkası görünür. Bu katlanmayı DOM'la yapmak mümkün değil (iOS 3B'yi
// düzleştiriyor, bkz. eski flip.js notu); tuvalde ise tek aynalama.
//
// ── Geometri ────────────────────────────────────────────────────────────────
//
// Yaprak birim karede düşünülüyor: u = 0 cilt, u = 1 dış kenar, v = 0 üst,
// v = PH alt (PH = yükseklik / genişlik). Kıvrım iki noktayla belirli:
//
//   C — çevrilen köşe (1, 0) ya da (1, PH)
//   P — o köşenin şu an bulunduğu yer (parmak)
//
// Katlama çizgisi C ile P'nin ORTA DİKMESİ. Yaprağın P tarafında kalan parçası
// ("kanat") bu çizgiye göre aynalanınca kâğıdın kalkmış kısmı çıkıyor: arkası
// görünür, altındaki sayfaya gölge düşer. Kalan parça yerinde durur.
//
// P serbest bırakılamaz: kâğıt yırtılmasın diye cilt köşelerine olan uzaklığı
// sınırlanıyor (kendi köşesine en çok 1, karşı köşeye en çok köşegen).

/** Katlama çizgisi: normal, orta nokta ve C-P uzaklığı. */
export function foldFor(C, P) {
  const dx = C[0] - P[0];
  const dy = C[1] - P[1];
  const len = Math.hypot(dx, dy);
  if (len < 1e-4) return null;
  return { n: [dx / len, dy / len], m: [(C[0] + P[0]) / 2, (C[1] + P[1]) / 2], len };
}

/** Noktayı katlama çizgisine göre aynalar. */
export function reflect(pt, fold) {
  const d = (pt[0] - fold.m[0]) * fold.n[0] + (pt[1] - fold.m[1]) * fold.n[1];
  return [pt[0] - 2 * d * fold.n[0], pt[1] - 2 * d * fold.n[1]];
}

/**
 * Parmağı kâğıdın izin verdiği yere çeker.
 *
 * Kâğıt ciltten ayrılmıyor: çevrilen köşe, kendi cilt köşesine sayfa
 * genişliğinden, karşı cilt köşesine de köşegenden uzaklaşamaz. Birkaç kez
 * üst üste uygulanıyor çünkü iki kısıt birbirini bozabiliyor.
 */
export function constrainPointer(P, C, PH) {
  const near = [0, C[1]];
  const far = [0, PH - C[1]];
  const diag = Math.hypot(1, PH);
  let [x, y] = P;
  for (let i = 0; i < 3; i++) {
    let dx = x - near[0];
    let dy = y - near[1];
    let d = Math.hypot(dx, dy);
    if (d > 1) { x = near[0] + dx / d; y = near[1] + dy / d; }
    dx = x - far[0];
    dy = y - far[1];
    d = Math.hypot(dx, dy);
    if (d > diag) { x = far[0] + (dx / d) * diag; y = far[1] + (dy / d) * diag; }
  }
  return [x, y];
}

/** Çokgeni yarı düzleme kırpar (Sutherland-Hodgman). sign>0 → normal yönü. */
export function clipHalf(poly, m, n, sign) {
  const out = [];
  const side = (p) => sign * ((p[0] - m[0]) * n[0] + (p[1] - m[1]) * n[1]);
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const sa = side(a);
    const sb = side(b);
    if (sa >= 0) out.push(a);
    if ((sa >= 0) !== (sb >= 0)) {
      const t = sa / (sa - sb);
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  }
  return out;
}

function tracePoly(ctx, pts) {
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
}

function clipTo(ctx, pts) {
  ctx.beginPath();
  tracePoly(ctx, pts);
  ctx.clip();
}

const smooth = (t) => t * t * (3 - 2 * t);
const clamp01 = (v) => Math.max(0, Math.min(1, v));

/**
 * Bir kareyi çizer.
 *
 * view: { ctx, w, h, dpr }          — hedef tuval (ekran pikseli)
 * geo:  { spineX, leafW, leafH, side }  — ekran biriminde yaprak yerleşimi
 *        side = +1 sağdaki yaprak sola çevriliyor, -1 soldaki sağa
 * tex:  { front, back, under, other }   — bitmapler (canvas/img), boş olabilir
 * P:    yaprak biriminde parmak konumu
 * C:    çevrilen köşe
 */
export function drawCurlFrame(view, geo, tex, C, P) {
  const { ctx, w, h } = view;
  const { spineX, leafW, leafH, side } = geo;
  const PH = leafH / leafW;
  const fold = foldFor(C, P);

  ctx.clearRect(0, 0, w, h);

  // Yaprak birimi → ekran
  const toScreen = (q) => [spineX + side * q[0] * leafW, geo.y0 + q[1] * leafW];

  // 1) Altta kalanlar: karşı sayfa ve çevrildiğinde ortaya çıkacak sayfa.
  if (tex.other) ctx.drawImage(tex.other, spineX - side * leafW, geo.y0, leafW, leafH);
  if (tex.under) ctx.drawImage(tex.under, side > 0 ? spineX : spineX - leafW, geo.y0, leafW, leafH);

  if (!fold) {
    if (tex.front) ctx.drawImage(tex.front, side > 0 ? spineX : spineX - leafW, geo.y0, leafW, leafH);
    return;
  }

  const rect = [[0, 0], [1, 0], [1, PH], [0, PH]];
  const flap = clipHalf(rect, fold.m, fold.n, 1);     // kalkan parça
  const flat = clipHalf(rect, fold.m, fold.n, -1);    // yerinde duran parça
  // Kıvrım çok küçükken ya da yaprak neredeyse tamamen dönmüşken gölgeler sönsün.
  const fade = smooth(clamp01(fold.len / 0.45)) * smooth(clamp01((2 - fold.len) / 0.45));
  const ms = toScreen(fold.m);
  const ns = [side * fold.n[0], fold.n[1]];

  // 2) Kalkan kâğıdın altındaki sayfaya düşen gölge.
  if (flap.length > 2 && tex.under) {
    ctx.save();
    clipTo(ctx, flap.map(toScreen));
    const len = Math.min(0.32, fold.len * 0.5 + 0.04) * leafW;
    const g = ctx.createLinearGradient(ms[0], ms[1], ms[0] + ns[0] * len, ms[1] + ns[1] * len);
    g.addColorStop(0, `rgba(30,22,16,${0.34 * fade})`);
    g.addColorStop(1, "rgba(30,22,16,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  // 3) Yaprağın yerinde duran kısmı (ön yüz).
  if (flat.length > 2 && tex.front) {
    ctx.save();
    clipTo(ctx, flat.map(toScreen));
    ctx.drawImage(tex.front, side > 0 ? spineX : spineX - leafW, geo.y0, leafW, leafH);
    ctx.restore();
  }

  if (flap.length < 3) return;
  const flapS = flap.map((q) => toScreen(reflect(q, fold)));

  // 4) Kanadın çevresine düşen gölge: kanat dışına, kenarından itibaren.
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, w, h);
  tracePoly(ctx, flapS);
  ctx.clip("evenodd");
  ctx.fillStyle = "#000";
  ctx.shadowColor = `rgba(30,22,16,${0.32 * fade})`;
  ctx.shadowBlur = 24;
  ctx.beginPath();
  tracePoly(ctx, flapS);
  ctx.fill();
  ctx.restore();

  // 5) Kâğıdın arkası: aynalanmış görüntü. Arka yüz yoksa boş kâğıt rengi.
  ctx.save();
  clipTo(ctx, flapS);
  if (tex.back) {
    // Aynalama matrisi: yaprak birimine in, katlama çizgisine göre aynala,
    // arka yüz sayfası zaten ters yazıldığı için bir de x'i çevir, geri dön.
    const nx = fold.n[0];
    const ny = fold.n[1];
    const md = 2 * (fold.m[0] * nx + fold.m[1] * ny);
    const toUnit = [1 / (side * leafW), 0, 0, 1 / leafW, -spineX / (side * leafW), -geo.y0 / leafW];
    const mirrorFold = [1 - 2 * nx * nx, -2 * nx * ny, -2 * nx * ny, 1 - 2 * ny * ny, md * nx, md * ny];
    const mirrorX = [-1, 0, 0, 1, 0, 0];
    const toScreenM = [side * leafW, 0, 0, leafW, spineX, geo.y0];
    const backX = side > 0 ? spineX : spineX - leafW;
    const place = [leafW / tex.back.width, 0, 0, leafW / tex.back.width, backX, geo.y0];
    const T = mul(toScreenM, mul(mirrorFold, mul(mirrorX, mul(toUnit, place))));
    ctx.transform(T[0], T[1], T[2], T[3], T[4], T[5]);
    ctx.drawImage(tex.back, 0, 0);
  } else {
    ctx.fillStyle = "#faf7f0";
    ctx.fillRect(0, 0, w, h);
  }
  ctx.restore();

  // 6) Kanadın üstündeki ışık: katlama çizgisinde koyu, uca doğru açılıyor.
  ctx.save();
  clipTo(ctx, flapS);
  const len = Math.min(0.5, fold.len * 0.5 + 0.05) * leafW;
  const g = ctx.createLinearGradient(ms[0], ms[1], ms[0] - ns[0] * len, ms[1] - ns[1] * len);
  g.addColorStop(0, `rgba(28,20,14,${0.22 * fade})`);
  g.addColorStop(0.12, `rgba(28,20,14,${0.06 * fade})`);
  g.addColorStop(0.45, `rgba(255,255,255,${0.06 * fade})`);
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

/** 2B matris çarpımı (canvas sırası: a c e / b d f). */
function mul(A, B) {
  return [
    A[0] * B[0] + A[2] * B[1],
    A[1] * B[0] + A[3] * B[1],
    A[0] * B[2] + A[2] * B[3],
    A[1] * B[2] + A[3] * B[3],
    A[0] * B[4] + A[2] * B[5] + A[4],
    A[1] * B[4] + A[3] * B[5] + A[5]
  ];
}

/**
 * İlerleme (0..1) → parmak konumu.
 *
 * Köşe önce hafifçe kalkıp yay çizerek cildin öbür tarafına geçiyor; düz bir
 * doğru boyunca gitseydi kâğıt katlanmadan "kayıyor" gibi görünürdü.
 */
export function pointerForProgress(t, C, PH) {
  const e = t;
  const x = 1 - 2 * e;
  const bulge = Math.sin(Math.PI * e) * 0.36;
  const y = C[1] + (C[1] > PH / 2 ? -bulge : bulge) * PH;
  return constrainPointer([x, y], C, PH);
}

/**
 * Çevirme denetleyicisi — eski `createFlip` ile aynı arayüz.
 *
 * `buildFrames(dir)` yaprağın yerleşimini ve hangi sayfaların görüneceğini
 * döndürüyor; bitmapler `options.snapshot(page)` ile alınıyor (editörde
 * sayfa anlık görüntüsü zaten önbellekli).
 *
 * Tuval, sahnenin CSS ölçeğini kendi üstünde ters çevirerek kuruluyor:
 * birleşik ölçek 1 olunca tarayıcı yeniden örneklemiyor, yazı net kalıyor
 * (aynı tuzak çizim tuvalinde de vardı).
 */
export function createCurlFlip(spreadEl, buildFrames, options = {}) {
  let state = null;
  let raf = 0;

  const viewScale = () => (options.viewScale ? Math.max(0.05, options.viewScale()) : 1);
  // Tuval, olcekli .spread icine giriyor: cocuklari sayfa biriminde konumlaniyor.
  const hostEl = () => spreadEl.querySelector(".spread") || spreadEl;

  function setup(frames) {
    const dpr = Math.min(2.5, window.devicePixelRatio || 1);
    const scale = viewScale();
    const canvas = document.createElement("canvas");
    canvas.className = "curl-layer";
    canvas.width = Math.round(frames.spreadW * scale * dpr);
    canvas.height = Math.round(frames.spreadH * scale * dpr);
    // CSS olcusu sayfa biriminde (ana oge zaten olcekli), arka tuval ise
    // ekranda kac piksele dusuyorsa o kadar: birlesik olcek 1, yani yeniden
    // orneklenme yok, yazi net kaliyor.
    canvas.style.width = frames.spreadW + "px";
    canvas.style.height = frames.spreadH + "px";
    const ctx = canvas.getContext("2d");
    ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
    return { canvas, ctx, dpr, scale };
  }

  function paint() {
    if (!state || !state.ready) return;
    const f = state.frames;
    const PH = f.leafH / f.leafW;
    const C = state.corner;
    const P = pointerForProgress(state.progress, C, PH);
    drawCurlFrame(
      { ctx: state.ctx, w: f.spreadW, h: f.spreadH },
      { spineX: f.spineX, y0: f.y0, leafW: f.leafW, leafH: f.leafH, side: f.side },
      state.tex,
      C,
      P
    );
  }

  function begin(dir) {
    if (state) return false;
    const frames = buildFrames(dir);
    if (!frames) return false;
    const view = setup(frames);
    const PH = frames.leafH / frames.leafW;
    state = {
      dir,
      frames,
      ctx: view.ctx,
      canvas: view.canvas,
      tex: {},
      ready: false,
      // Geriye cevirmede yaprak kapali basliyor: ilerleme tersten akiyor.
      progress: frames.reverse ? 1 : 0,
      corner: [1, frames.corner === "top" ? 0.001 : PH - 0.001]
    };
    const host = hostEl();
    host.append(view.canvas);
    host.classList.add("curling");
    state.host = host;
    const want = { front: frames.front, back: frames.back, under: frames.under, other: frames.other };
    const current = state;
    Promise.all(Object.entries(want).map(async ([key, page]) => {
      if (!page) return null;
      const bitmap = await options.snapshot(page);
      if (state === current) current.tex[key] = bitmap;
      return bitmap;
    })).then(() => {
      if (state !== current) return;
      current.ready = true;
      paint();
    });
    return true;
  }

  function update(progress) {
    if (!state) return;
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    const p = Math.max(0, Math.min(1, progress));
    state.progress = state.frames.reverse ? 1 - p : p;
    paint();
  }

  function finish(commit, onDone) {
    if (!state) return;
    const current = state;
    if (commit && options.sound && options.sound()) playPaperSound();
    const rev = !!current.frames.reverse;
    const target = commit ? (rev ? 0 : 1) : (rev ? 1 : 0);
    const from = current.progress;
    const duration = Math.max(180, 620 * Math.abs(target - from));
    const t0 = performance.now();
    // Sekme arka plana atılırsa kare döngüsü durur; emniyet sayacı çevirmeyi bitirir.
    const guard = setTimeout(() => done(), duration + 600);
    const done = () => {
      if (state !== current) return;
      clearTimeout(guard);
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
      state = null;
      if (current.host) current.host.classList.remove("curling");
      current.canvas.remove();
      if (onDone) onDone(commit);
    };
    const step = (now) => {
      if (state !== current) return;
      const t = Math.min(1, (now - t0) / duration);
      const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      current.progress = from + (target - from) * eased;
      paint();
      if (t < 1) { raf = requestAnimationFrame(step); return; }
      done();
    };
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(step);
  }

  function run(dir, onDone) {
    if (!begin(dir)) return false;
    requestAnimationFrame(() => finish(true, onDone));
    return true;
  }

  function cancel() {
    if (!state) return;
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    const current = state;
    state = null;
    if (current.host) current.host.classList.remove("curling");
    current.canvas.remove();
  }

  return {
    begin,
    update,
    finish,
    run,
    cancel,
    get active() { return !!state; },
    get sheetWidth() { return state ? state.frames.leafW : 0; }
  };
}

/** Sayfa sesi — eski çevirmedeki kısa kâğıt hışırtısı. */
let sesBaglami = null;
function playPaperSound() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    sesBaglami = sesBaglami || new Ctx();
    if (sesBaglami.state === "suspended") sesBaglami.resume();
    const sure = 0.26;
    const örnek = Math.floor(sesBaglami.sampleRate * sure);
    const tampon = sesBaglami.createBuffer(1, örnek, sesBaglami.sampleRate);
    const veri = tampon.getChannelData(0);
    for (let i = 0; i < örnek; i++) {
      const t = i / örnek;
      veri[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 2.2) * 0.35;
    }
    const kaynak = sesBaglami.createBufferSource();
    kaynak.buffer = tampon;
    const süzgeç = sesBaglami.createBiquadFilter();
    süzgeç.type = "bandpass";
    süzgeç.frequency.value = 2100;
    süzgeç.Q.value = 0.7;
    const kazanç = sesBaglami.createGain();
    kazanç.gain.value = 0.5;
    kaynak.connect(süzgeç).connect(kazanç).connect(sesBaglami.destination);
    kaynak.start();
  } catch (_) {
    /* ses yoksa çevirme yine çalışır */
  }
}
