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
  const padX = view.padX || 0;
  const { spineX, leafW, leafH, side } = geo;
  const PH = leafH / leafW;
  const fold = foldFor(C, P);

  ctx.clearRect(-padX, 0, w + padX, h);

  // Yaprak birimi → ekran
  const toScreen = (q) => [spineX + side * q[0] * leafW, geo.y0 + q[1] * leafW];

  // 1) Altta kalanlar: karşı sayfa ve çevrildiğinde ortaya çıkacak sayfa.
  // Alttaki sayfa yapragin kendi tarafinda, karsi sayfa obur tarafta.
  // Karsi sayfa once `spineX - side*leafW` ile ciziliyordu: geri cevirirken
  // (side = -1) tuvalin disina dusuyor ve sag yari bombos kaliyordu.
  const underX = side > 0 ? spineX : spineX - leafW;
  const otherX = side > 0 ? spineX - leafW : spineX;
  if (tex.other) ctx.drawImage(tex.other, otherX, geo.y0, leafW, leafH);
  if (tex.under) ctx.drawImage(tex.under, underX, geo.y0, leafW, leafH);
  // Defterin sonunda alttaki sayfa olmayabilir: bos birakilirsa masa gorunur
  // ve kagit seffaf donuyormus gibi olur.
  else { ctx.fillStyle = "#f6f2e9"; ctx.fillRect(underX, geo.y0, leafW, leafH); }

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
    ctx.fillRect(-padX, 0, w + padX, h);
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
  ctx.rect(-padX, 0, w + padX, h);
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
    // Arka yuz goruntusu once cildin OBUR tarafina konuyor: mirrorX onu yaprak
    // yerine tasiyor, katlama aynalamasi da kanadin uzerine. Ayni tarafa
    // konursa aynalamadan sonra kanadin disina dusuyor ve kalkan kagit bos
    // gorunuyordu.
    const backX = side > 0 ? spineX - leafW : spineX;
    const place = [leafW / tex.back.width, 0, 0, leafW / tex.back.width, backX, geo.y0];
    const T = mul(toScreenM, mul(mirrorFold, mul(mirrorX, mul(toUnit, place))));
    ctx.transform(T[0], T[1], T[2], T[3], T[4], T[5]);
    ctx.drawImage(tex.back, 0, 0);
  } else {
    ctx.fillStyle = "#faf7f0";
    ctx.fillRect(-padX, 0, w + padX, h);
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
  ctx.fillRect(-padX, 0, w + padX, h);
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
 * Animasyon tuvalini kurar (hem sayfa kıvrımı hem kapak açılışı kullanıyor).
 *
 * Kalkan yaprak cildin ötesine taşıyor. Çift sayfada karşı yarı zaten orada,
 * tek sayfada değil: tuval `padX` kadar sola uzatılıyor, yoksa kâğıdın kalkan
 * kısmı tuvalin dışında kalıyor ve sayfa "şeffaf" dönüyormuş gibi görünüyor.
 *
 * CSS ölçüsü sayfa biriminde (ana öğe zaten ölçekli), arka tuval ise ekranda
 * kaç piksele düşüyorsa o kadar: birleşik ölçek 1, yani yeniden örnekleme yok,
 * yazı net kalıyor.
 */
function makeLayer(frames, scale) {
  const dpr = Math.min(2.5, window.devicePixelRatio || 1);
  const canvas = document.createElement("canvas");
  canvas.className = "curl-layer";
  const padX = frames.padX || 0;
  // Sag pay: kapali defterin sayfa blogu cildin disina tasiyor.
  const padR = frames.padR || 0;
  const totalW = frames.spreadW + padX + padR;
  canvas.width = Math.round(totalW * scale * dpr);
  canvas.height = Math.round(frames.spreadH * scale * dpr);
  canvas.style.left = -padX + "px";
  canvas.style.width = totalW + "px";
  canvas.style.height = frames.spreadH + "px";
  const ctx = canvas.getContext("2d");
  // Çizim sahne koordinatında kalsın diye kaydırma matrise giriyor.
  ctx.setTransform(scale * dpr, 0, 0, scale * dpr, padX * scale * dpr, 0);
  return { canvas, ctx, dpr, scale, padX, padR };
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

  const setup = (frames) => makeLayer(frames, viewScale());

  /** Ekran noktası → yaprak birimi. */
  function toLeaf(st, clientX, clientY) {
    const f = st.frames;
    const rect = st.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    const padX = f.padX || 0;
    const totalW = f.spreadW + padX;
    const sx = (clientX - rect.left) * (totalW / rect.width) - padX;
    const sy = (clientY - rect.top) * (f.spreadH / rect.height);
    return [(sx - f.spineX) / (f.side * f.leafW), (sy - f.y0) / f.leafW];
  }

  function paint() {
    if (!state || !state.ready) return;
    const f = state.frames;
    const PH = f.leafH / f.leafW;
    const C = state.corner;
    const P = state.P || pointerForProgress(state.progress, C, PH);
    drawCurlFrame(
      { ctx: state.ctx, w: f.spreadW, h: f.spreadH, padX: f.padX || 0 },
      { spineX: f.spineX, y0: f.y0, leafW: f.leafW, leafH: f.leafH, side: f.side },
      state.tex,
      C,
      P
    );
  }

  function begin(dir, at) {
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
    state.host = host;
    // Tutulan köşe parmağa göre seçiliyor: üst yarıdan çekince üst köşe kalkar.
    if (at) {
      const q = toLeaf(state, at.x, at.y);
      if (q) {
        state.corner = [1, q[1] < PH / 2 ? 0.001 : PH - 0.001];
        state.grab = q;
      }
    }
    state.P = pointerForProgress(state.progress, state.corner, PH);
    state.P0 = state.P;
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
      // Sayfalar ancak tuval çizmeye hazırken gizleniyor: doku beklerken
      // gizlenirse defter bir an tamamen kayboluyordu.
      paint();
      current.host.classList.add("curling");
    });
    return true;
  }

  /**
   * Parmağı izle: köşe, parmağın gittiği kadar gidiyor.
   *
   * Parmağın mutlak yeri değil, başlangıçtan beri aldığı YOL uygulanıyor:
   * sayfanın ortasından tutunca köşe birden parmağa zıplamıyor, köşeden
   * tutunca da zaten ikisi aynı yerde oluyor. Dönen değer bırakma kararı için
   * ilerleme (0 başlangıç, 1 tamamlanmış).
   */
  function follow(clientX, clientY) {
    if (!state) return 0;
    const f = state.frames;
    const PH = f.leafH / f.leafW;
    const q = toLeaf(state, clientX, clientY);
    if (!q) return state.frames.reverse ? 1 - state.progress : state.progress;
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    const g = state.grab || q;
    state.P = constrainPointer([state.P0[0] + (q[0] - g[0]), state.P0[1] + (q[1] - g[1])], state.corner, PH);
    state.progress = clamp01((1 - state.P[0]) / 2);
    paint();
    return f.reverse ? 1 - state.progress : state.progress;
  }

  function finish(commit, onDone) {
    if (!state) return;
    const current = state;
    if (commit && options.sound && options.sound()) playPaperSound();
    const rev = !!current.frames.reverse;
    const PH = current.frames.leafH / current.frames.leafW;
    const target = commit ? (rev ? 0 : 1) : (rev ? 1 : 0);
    const from = current.progress;
    const fromP = current.P || pointerForProgress(from, current.corner, PH);
    const toP = pointerForProgress(target, current.corner, PH);
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
      // Parmak nerede bırakıldıysa oradan devam: köşe önce kendi yerinden
      // hedefe doğru süzülüyor. Kısıt zaten kâğıdın yayına oturtuyor.
      current.P = constrainPointer([
        fromP[0] + (toP[0] - fromP[0]) * eased,
        fromP[1] + (toP[1] - fromP[1]) * eased
      ], current.corner, PH);
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
    follow,
    finish,
    run,
    cancel,
    get active() { return !!state; }
  };
}

/**
 * Sert kapak açılışı — kâğıt kıvrılır, karton kıvrılmaz.
 *
 * Kapak menteşeden dönüyor. Dik bakışta dönen düz bir levha, yatay ölçeği
 * kosinüsle daralan bir dikdörtgendir: tuvalde tek `drawImage`, 3B'ye (ve
 * iOS'un düzleştirdiği preserve-3d'ye) hiç girmeden. Açı 90°'yi geçince ön
 * yüz yerine iç kapak görünüyor.
 *
 * Cilt yerinden kımıldamıyor: gerçek defterde de sırt durur, kapak döner.
 * Kapalı defter tek yaprak eninde olduğu için ekranda ortalanması gerekiyor;
 * bunu sahnenin kendisi kayarak yapıyor (`onFrame`), tuval değil. Böylece
 * çizim hep son yerleşimle aynı hizada kalıyor ve hiçbir şey tuvalin dışına
 * taşmıyor. Sol yaprak ciltten açılarak ortaya çıkıyor; sonunda kapak onun
 * ALTINA girdiği için son derecelerde sol sayfa kapağın üstüne biniyor.
 *
 * t: 0 kapalı, 1 tam açık (yumuşatma denetleyicide yapılıyor).
 */
export function drawCoverFrame(view, f, t) {
  const { ctx, w, h } = view;
  const padX = view.padX || 0;
  const padR = view.padR || 0;
  const { leafW, leafH, y0 } = f;
  const e = clamp01(t);
  const spineX = f.spineX;
  const a = Math.PI * e;
  const c = Math.cos(a);
  const s = Math.sin(a);

  ctx.clearRect(-padX, 0, w + padX + padR, h);

  // 1) Sayfa bloğu: kapağın altından taşan sayfa kenarları. Kapalıyken yalnız
  // sağ yaprak kadar, açıldıkça iki yaprağa yayılıyor (ekrandaki .back-sheets
  // ile aynı kayma, bitince devir teslim belli olmasın).
  const leftIn = f.other ? smooth(clamp01((e - 0.18) / 0.4)) : 0;
  const openW = leafW * leftIn;
  const blockX = spineX - openW;
  const blockW = openW + leafW;
  ctx.fillStyle = "#d6d4cb";
  ctx.fillRect(blockX + 10, y0 + 6, blockW, leafH);
  ctx.fillStyle = "#e6e4dc";
  ctx.fillRect(blockX + 5, y0 + 3, blockW, leafH);

  if (f.under) ctx.drawImage(f.under, spineX, y0, leafW, leafH);
  else { ctx.fillStyle = "#f6f2e9"; ctx.fillRect(spineX, y0, leafW, leafH); }

  // 2) Sol yaprak ciltten çıkıyor: kırpma kenarı cilde yapışık, kâğıt oradan
  // sıyrılıyormuş gibi.
  if (f.other && leftIn > 0) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(blockX, y0, openW, leafH);
    ctx.clip();
    ctx.globalAlpha = leftIn;
    ctx.drawImage(f.other, spineX - leafW, y0, leafW, leafH);
    ctx.restore();
  }

  // 3) Cilt gölgesi: iki yaprak arasındaki oluk.
  if (leftIn > 0) {
    const gw = leafW * 0.06;
    const g = ctx.createLinearGradient(spineX - gw, 0, spineX + gw, 0);
    g.addColorStop(0, "rgba(30,22,16,0)");
    g.addColorStop(0.5, `rgba(30,22,16,${0.2 * leftIn})`);
    g.addColorStop(1, "rgba(30,22,16,0)");
    ctx.fillStyle = g;
    ctx.fillRect(spineX - gw, y0, gw * 2, leafH);
  }

  // 4) Dönen kapak. Ortalarda hafif kısalma veriliyor: göz levhayı eğik görür.
  const cw = leafW * Math.abs(c);
  const x0 = c >= 0 ? spineX : spineX - cw;
  const k = 1 - 0.05 * s;
  const yv = y0 + (leafH * (1 - k)) / 2;
  const hv = leafH * k;
  // Kapak yatarken sol yaprağın altına giriyor. Karşı yaprak varsa o biniyor
  // (aşağıda); yoksa — tek sayfa kipinde — kapak sayfanın dışında kalacağı
  // için kendisi siliniyor, sonunda tuval kalkınca zıplama olmasın.
  const land = clamp01((-c - 0.86) / 0.14);
  if (cw > 0.6 && (f.other || land < 1)) {
    ctx.save();
    if (!f.other) ctx.globalAlpha = 1 - land;
    // Kapağın altındaki sayfaya düşen gölge, serbest kenarından dışarı.
    const edge = c >= 0 ? spineX + cw : spineX - cw;
    const dir = c >= 0 ? 1 : -1;
    const sl = leafW * 0.16 * (0.35 + s);
    const sg = ctx.createLinearGradient(edge, 0, edge + dir * sl, 0);
    sg.addColorStop(0, `rgba(28,20,14,${0.3 * (0.25 + 0.75 * s)})`);
    sg.addColorStop(1, "rgba(28,20,14,0)");
    ctx.fillStyle = sg;
    ctx.fillRect(Math.min(edge, edge + dir * sl), yv, sl, hv);

    if (c >= 0 && f.front) {
      ctx.drawImage(f.front, x0, yv, cw, hv);
    } else {
      // İç kapak: sade astar kâğıdı, cilt tarafında koyulaşan.
      ctx.fillStyle = "#efe7d6";
      ctx.fillRect(x0, yv, cw, hv);
      const ig = ctx.createLinearGradient(spineX, 0, spineX - dir * leafW * 0.22, 0);
      ig.addColorStop(0, "rgba(60,45,30,0.22)");
      ig.addColorStop(1, "rgba(60,45,30,0)");
      ctx.fillStyle = ig;
      ctx.fillRect(x0, yv, cw, hv);
    }
    // Işık: levha yan dönerken kararıyor.
    ctx.fillStyle = `rgba(22,16,10,${(c >= 0 ? 0.3 : 0.2) * s})`;
    ctx.fillRect(x0, yv, cw, hv);
    // Menteşe: kartonun kalınlığı.
    ctx.fillStyle = "rgba(20,14,8,0.35)";
    ctx.fillRect(spineX - (c >= 0 ? 0 : 2.5), yv, 2.5, hv);
    ctx.restore();
  }

  // 5) Kapak yere yatarken sol yaprak üstüne biniyor (kapak sayfanın altında
  // kalır); son derecelerde bindirme.
  if (f.other) {
    if (land > 0) {
      ctx.save();
      ctx.globalAlpha = land;
      ctx.drawImage(f.other, spineX - leafW, y0, leafW, leafH);
      ctx.restore();
    }
  }
}

/**
 * Kapak açılış/kapanış denetleyicisi.
 *
 * `frames` yerleşimi ve dokuları taşıyor:
 *   spreadW, spreadH, padX, leafW, leafH, y0, spineX
 *   front (kapak), under (kapağın altındaki yaprak), other (karşı yaprak)
 *
 * `options.onFrame(e)` her karede açıklık oranıyla çağrılıyor: sahneyi kayan
 * kapalı defterden yerine getiren kısım editörde, çünkü kayma sahnenin
 * dönüşümünde.
 */
export function createCoverAnim(spreadEl, options = {}) {
  let live = null;
  const viewScale = () => (options.viewScale ? Math.max(0.05, options.viewScale()) : 1);
  const hostEl = () => spreadEl.querySelector(".spread") || spreadEl;

  function stop() {
    if (!live) return;
    const cur = live;
    live = null;
    cancelAnimationFrame(cur.raf);
    cur.host.classList.remove("opening-cover");
    cur.canvas.remove();
    // Yarıda kesilen açılışı bekleyen varsa aç bırakılmasın.
    if (cur.resolve) cur.resolve(false);
  }

  /** dir = 1 açılış, -1 kapanış. Biterken söz veriliyor. */
  function play(frames, dir) {
    stop();
    if (!frames) return Promise.resolve(false);
    const view = makeLayer(frames, viewScale());
    const host = hostEl();
    host.append(view.canvas);
    host.classList.add("opening-cover");
    const draw = (e) => {
      drawCoverFrame({ ctx: view.ctx, w: frames.spreadW, h: frames.spreadH, padX: view.padX, padR: view.padR }, frames, e);
      if (options.onFrame) options.onFrame(e);
    };
    const duration = dir > 0 ? 820 : 560;
    const t0 = performance.now();
    draw(dir > 0 ? 0 : 1);
    return new Promise((resolve) => {
      const current = { canvas: view.canvas, host, raf: 0, resolve };
      live = current;
      // Sekme arka plana atılırsa kare döngüsü durur; emniyet sayacı bitirir.
      const guard = setTimeout(() => finish(), duration + 700);
      const finish = () => {
        if (live !== current) return;
        clearTimeout(guard);
        current.resolve = null;   // sözü burada veriyoruz, stop() bir daha vermesin
        // Kapanışta son kare ekranda kalıyor: tuval hemen kalkarsa altındaki
        // açık sayfalar bir kare görünür, defter kapanıp geri açılmış gibi
        // olur. Temizliği çağıran yapıyor (ekrandan çıkarken cancel).
        if (dir > 0) stop();
        resolve(true);
      };
      const step = (now) => {
        if (live !== current) return;
        const t = Math.min(1, (now - t0) / duration);
        // Açılırken kapak devrilir gibi hızlanıp yumuşak oturuyor, kapanırken
        // ağırlığıyla düşüyor.
        const eased = dir > 0 ? 1 - Math.pow(1 - t, 2.6) : 1 - Math.pow(t, 2);
        draw(eased);
        if (t < 1) { current.raf = requestAnimationFrame(step); return; }
        finish();
      };
      current.raf = requestAnimationFrame(step);
    });
  }

  return { play, cancel: stop, get active() { return !!live; } };
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
