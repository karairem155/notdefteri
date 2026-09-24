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

// ── Defterin mobilyası ──────────────────────────────────────────────────────
//
// Ekranda sayfanın altındaki yaprak yığını, dış gölge, kenar koyuluğu ve
// ortadaki cilt oluğu CSS'ten geliyor (.page-stack gölgesi, .page-stack::after,
// .spine). Çevirme sırasında sayfalar gizlendiği için tuval bunların aynısını
// çizmek zorunda; çizmezse çevirme başlar başlamaz ortadaki gölge yok oluyor,
// sayfa da bir anda açılıyormuş gibi rengi değişiyor.
//
// Değerler ekrandan ölçüldü (sayfa birimi).

const YIGIN = [[12, "#b9b5aa"], [9, "#c6c2b7"], [6, "#d3cfc4"], [3, "#e2ded3"]];
const KOSE = 3;
const CILT_ENI = 10;

// Yolu BAŞLATMIYOR: çağıran beginPath'i kendi yapıyor. Kırpmada iki alt yol
// (büyük dikdörtgen + sayfa) aynı yolda olmalı, yoksa evenodd tersine dönüyor
// ve gölge sayfanın içine kırpılıp görünmez oluyor.
function roundRectPath(ctx, x, y, w, h, r) {
  if (ctx.roundRect) { ctx.roundRect(x, y, w, h, r); return; }
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Sayfanın altındaki yaprak yığını ve masaya düşen gölge. */
function drawSheetBed(ctx, view, x, y, w, h) {
  const padX = view.padX || 0;
  const padR = view.padR || 0;
  // Gölge ölçüleri tuval koordinatında değil ÇIKTI pikselinde uygulanıyor;
  // sahne küçülünce gölge de küçülsün diye ölçekle çarpılıyorlar.
  const olcek = view.olcek || 1;
  ctx.save();
  ctx.beginPath();
  ctx.rect(-padX - 400, -(view.padY || 0) - 400, view.w + padX + padR + 800, view.h + (view.padY || 0) * 2 + 800);
  roundRectPath(ctx, x, y, w, h, KOSE);
  ctx.clip("evenodd");
  ctx.fillStyle = "#000";
  ctx.shadowColor = "rgba(0,0,0,0.55)";
  ctx.shadowBlur = 50 * olcek;
  ctx.shadowOffsetY = 26 * olcek;
  ctx.beginPath();
  roundRectPath(ctx, x, y, w, h, KOSE);
  ctx.fill();
  ctx.shadowColor = "rgba(0,0,0,0.3)";
  ctx.shadowBlur = 14 * olcek;
  ctx.shadowOffsetY = 6 * olcek;
  ctx.beginPath();
  roundRectPath(ctx, x, y, w, h, KOSE);
  ctx.fill();
  ctx.restore();
  for (const [off, renk] of YIGIN) {
    ctx.fillStyle = renk;
    ctx.beginPath();
    roundRectPath(ctx, x + off, y + off, w, h, KOSE);
    ctx.fill();
  }
}

/** Sayfanın iki kenarındaki hafif koyuluk (.page-stack::after). */
function drawEdgeShade(ctx, x, y, w, h) {
  const g = ctx.createLinearGradient(x, 0, x + w, 0);
  g.addColorStop(0, "rgba(0,0,0,0.05)");
  g.addColorStop(0.03, "rgba(0,0,0,0)");
  g.addColorStop(0.97, "rgba(0,0,0,0)");
  g.addColorStop(1, "rgba(0,0,0,0.05)");
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
}

/** Cilt oluğu: iki yaprağın arasındaki koyu şerit (.spine). */
function drawCrease(ctx, x, y, h, a = 1) {
  if (a <= 0.01) return;
  const g = ctx.createLinearGradient(x - CILT_ENI / 2, 0, x + CILT_ENI / 2, 0);
  g.addColorStop(0, `rgba(0,0,0,${0.08 * a})`);
  g.addColorStop(0.5, `rgba(0,0,0,${0.32 * a})`);
  g.addColorStop(1, `rgba(0,0,0,${0.08 * a})`);
  ctx.fillStyle = g;
  ctx.fillRect(x - CILT_ENI / 2, y, CILT_ENI, h);
}

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
  const padR = view.padR || 0;
  const padY = view.padY || 0;
  const tumAlan = () => ctx.fillRect(-padX, -padY, w + padX + padR, h + padY * 2);
  const { spineX, leafW, leafH, side } = geo;
  const PH = leafH / leafW;
  const fold = foldFor(C, P);

  ctx.clearRect(-padX, -padY, w + padX + padR, h + padY * 2);
  if (!fold) return;   // kâğıt düzken ekranın kendisi görünüyor, çizecek bir şey yok

  // Yaprak birimi → ekran. Yaprağın kendi yeri: cildin hangi tarafındaysa.
  const toScreen = (q) => [spineX + side * q[0] * leafW, geo.y0 + q[1] * leafW];
  const leafX = side > 0 ? spineX : spineX - leafW;

  const rect = [[0, 0], [1, 0], [1, PH], [0, PH]];
  const flap = clipHalf(rect, fold.m, fold.n, 1);     // kalkan parça
  const flat = clipHalf(rect, fold.m, fold.n, -1);    // yerinde duran parça
  // Kıvrım çok küçükken ya da yaprak neredeyse tamamen dönmüşken gölgeler sönsün.
  const fade = smooth(clamp01(fold.len / 0.45)) * smooth(clamp01((2 - fold.len) / 0.45));
  const ms = toScreen(fold.m);
  const ns = [side * fold.n[0], fold.n[1]];

  /** Sayfayı yaprağın yerine koyar, kenar koyuluğu ve cilt oluğuyla. */
  const sayfaKoy = (bmp) => {
    if (bmp) ctx.drawImage(bmp, leafX, geo.y0, leafW, leafH);
    else { ctx.fillStyle = "#f6f2e9"; ctx.fillRect(leafX, geo.y0, leafW, leafH); }
    drawEdgeShade(ctx, leafX, geo.y0, leafW, leafH);
    if (geo.crease) drawCrease(ctx, spineX, geo.y0, leafH);
  };

  // 1) Kalkan kâğıdın altından çıkan sayfa. Yalnız kalkan parçanın altına
  // çiziliyor: gerisi ekranda zaten duruyor, tuval oraya hiç dokunmuyor.
  if (flap.length > 2) {
    ctx.save();
    clipTo(ctx, flap.map(toScreen));
    if (!geo.liveUnder) sayfaKoy(tex.under);
    // Kalkan kâğıdın alttaki sayfaya düşürdüğü gölge.
    const len = Math.min(0.32, fold.len * 0.5 + 0.04) * leafW;
    const g = ctx.createLinearGradient(ms[0], ms[1], ms[0] + ns[0] * len, ms[1] + ns[1] * len);
    g.addColorStop(0, `rgba(30,22,16,${0.34 * fade})`);
    g.addColorStop(1, "rgba(30,22,16,0)");
    ctx.fillStyle = g;
    tumAlan();
    ctx.restore();
  }

  // 2) Yaprağın yerinde duran kısmı. Ekranda duran sayfa buysa (ileri
  // çevirmede öyle) hiç çizilmiyor — tuval ekranın üstüne aynı görüntüyü
  // koymaya kalkarsa en ufak fark bile "sayfa bir anda bozuldu" gibi duruyor.
  if (!geo.liveFront && flat.length > 2) {
    ctx.save();
    clipTo(ctx, flat.map(toScreen));
    sayfaKoy(tex.front);
    ctx.restore();
  }

  if (flap.length < 3) return;
  const flapS = flap.map((q) => toScreen(reflect(q, fold)));

  // 3) Kanadın çevresine düşen gölge: kanat dışına, kenarından itibaren.
  ctx.save();
  ctx.beginPath();
  ctx.rect(-padX, -padY, w + padX + padR, h + padY * 2);
  tracePoly(ctx, flapS);
  ctx.clip("evenodd");
  ctx.fillStyle = "#000";
  ctx.shadowColor = `rgba(30,22,16,${0.32 * fade})`;
  ctx.shadowBlur = 24 * (view.olcek || 1);
  ctx.beginPath();
  tracePoly(ctx, flapS);
  ctx.fill();
  ctx.restore();

  // 4) Kâğıdın arkası: aynalanmış görüntü. Arka yüz yoksa boş kâğıt rengi.
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
    // yerine tasiyor, katlama aynalamasi da kanadin uzerine.
    const backX = side > 0 ? spineX - leafW : spineX;
    const place = [leafW / tex.back.width, 0, 0, leafW / tex.back.width, backX, geo.y0];
    const T = mul(toScreenM, mul(mirrorFold, mul(mirrorX, mul(toUnit, place))));
    ctx.transform(T[0], T[1], T[2], T[3], T[4], T[5]);
    ctx.drawImage(tex.back, 0, 0);
  } else {
    ctx.fillStyle = "#faf7f0";
    tumAlan();
  }
  ctx.restore();

  // 5) Kanadın üstündeki ışık: katlama çizgisinde koyu, uca doğru açılıyor.
  ctx.save();
  clipTo(ctx, flapS);
  const len = Math.min(0.5, fold.len * 0.5 + 0.05) * leafW;
  const g = ctx.createLinearGradient(ms[0], ms[1], ms[0] - ns[0] * len, ms[1] - ns[1] * len);
  g.addColorStop(0, `rgba(28,20,14,${0.22 * fade})`);
  g.addColorStop(0.12, `rgba(28,20,14,${0.06 * fade})`);
  g.addColorStop(0.45, `rgba(255,255,255,${0.06 * fade})`);
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  tumAlan();
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
const EN_AZ_PAY = 60;   // gölge ve yaprak yığını için her yönde asgari pay

function makeLayer(frames, scale) {
  const dpr = Math.min(2.5, window.devicePixelRatio || 1);
  const canvas = document.createElement("canvas");
  canvas.className = "curl-layer";
  const padX = Math.max(frames.padX || 0, EN_AZ_PAY);
  // Sağ ve dikey pay: sayfa bloğu, kitabın gölgesi ve yukarı kalkan köşe
  // sayfanın dışına taşıyor; pay olmazsa tuvalin kenarında kesiliyorlar.
  const padR = Math.max(frames.padR || 0, EN_AZ_PAY);
  const padY = Math.max(frames.padY || 0, EN_AZ_PAY);
  const totalW = frames.spreadW + padX + padR;
  const totalH = frames.spreadH + padY * 2;
  canvas.width = Math.round(totalW * scale * dpr);
  canvas.height = Math.round(totalH * scale * dpr);
  canvas.style.left = -padX + "px";
  canvas.style.top = -padY + "px";
  canvas.style.width = totalW + "px";
  canvas.style.height = totalH + "px";
  const ctx = canvas.getContext("2d");
  // Çizim sahne koordinatında kalsın diye kaydırma matrise giriyor.
  ctx.setTransform(scale * dpr, 0, 0, scale * dpr, padX * scale * dpr, padY * scale * dpr);
  return { canvas, ctx, dpr, scale, padX, padR, padY, olcek: scale * dpr };
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
    const padX = st.pad.padX;
    const padY = st.pad.padY;
    const totalW = f.spreadW + padX + st.pad.padR;
    const totalH = f.spreadH + padY * 2;
    const sx = (clientX - rect.left) * (totalW / rect.width) - padX;
    const sy = (clientY - rect.top) * (totalH / rect.height) - padY;
    return [(sx - f.spineX) / (f.side * f.leafW), (sy - f.y0) / f.leafW];
  }

  function paint() {
    if (!state || !state.ready) return;
    const f = state.frames;
    const PH = f.leafH / f.leafW;
    const C = state.corner;
    const P = state.P || pointerForProgress(state.progress, C, PH);
    drawCurlFrame(
      { ctx: state.ctx, w: f.spreadW, h: f.spreadH, ...state.pad },
      { spineX: f.spineX, y0: f.y0, leafW: f.leafW, leafH: f.leafH, side: f.side,
        crease: !!f.crease, liveUnder: !!f.liveUnder, liveFront: !!f.liveFront },
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
    const pad = { padX: view.padX, padR: view.padR, padY: view.padY, olcek: view.olcek };
    state = {
      dir,
      frames,
      ctx: view.ctx,
      canvas: view.canvas,
      pad,
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
    const q = at ? toLeaf(state, at.x, at.y) : null;
    if (q) state.corner = [1, Math.max(0, Math.min(PH, q[1])) < PH / 2 ? 0 : PH];
    state.P = pointerForProgress(state.progress, state.corner, PH);
    // Tutulan KÂĞIT noktası: yaprak zaten kıvrıksa (geri çevirmede kapalı
    // başlıyor) parmağın altındaki malzeme, kâğıdın açılmış halindeki karşılığı
    // olan noktadır — o yüzden katlama çizgisine göre aynalanıyor.
    if (q) {
      const fold0 = foldFor(state.corner, state.P);
      const mal = fold0 ? reflect(q, fold0) : q;
      const gx = Math.min(1, mal[0]);
      // Cilde çok yakın tutuşta katlama çizgisi saçmalamasın diye tutuş
      // noktası biraz dışarı alınıyor. Yaprak zaten kıvrıksa kaydırma yok:
      // orada tutuş ile parmak aynı yerde değil, kaydırmak kâğıdı zıplatır.
      state.shift = fold0 ? 0 : Math.max(0, 0.6 - gx);
      state.grab = [gx + state.shift, Math.max(0, Math.min(PH, mal[1]))];
    } else {
      state.shift = 0;
      state.grab = [1, state.corner[1]];
    }
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
   * Parmağı izle.
   *
   * Tutulan kâğıt noktası G, parmağın şimdiki yeri Q: katlama çizgisi bu
   * ikisinin orta dikmesi, köşe de o çizgiye göre aynalanmış hali. Yani
   * tuttuğun nokta gerçekten parmağının altında kalıyor — köşeyi parmağın
   * yoluyla ötelemekten farkı, kâğıdın doğru miktarda katlanması.
   *
   * Dönen değer bırakma kararı için ilerleme (0 başlangıç, 1 tamamlanmış).
   */
  function follow(clientX, clientY) {
    if (!state) return 0;
    const f = state.frames;
    const PH = f.leafH / f.leafW;
    const geri = f.reverse;
    const q = toLeaf(state, clientX, clientY);
    if (!q) return geri ? 1 - state.progress : state.progress;
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    const C = state.corner;
    const Q = [q[0] + state.shift, q[1]];
    const G = state.grab;
    const dx = G[0] - Q[0];
    const dy = G[1] - Q[1];
    const L = Math.hypot(dx, dy);
    let P = C.slice();
    if (L > 1e-5) {
      const n = [dx / L, dy / L];
      const M = [(G[0] + Q[0]) / 2, (G[1] + Q[1]) / 2];
      const d = (C[0] - M[0]) * n[0] + (C[1] - M[1]) * n[1];
      // d <= 0: köşe katlama çizgisinin öbür tarafında kalıyor, yani kâğıt
      // hiç kalkmamış demek.
      if (d > 0) P = constrainPointer([C[0] - 2 * d * n[0], C[1] - 2 * d * n[1]], C, PH);
    }
    state.P = P;
    state.progress = clamp01((C[0] - P[0]) / 2);
    paint();
    return geri ? 1 - state.progress : state.progress;
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
    get active() { return !!state; },
    get sheetWidth() { return state ? state.frames.leafW : 0; }
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
  const padY = view.padY || 0;
  const olcek = view.olcek || 1;
  const { leafW, leafH, y0 } = f;
  const spineX = f.spineX;
  const e = clamp01(t);
  const th = Math.PI * e;
  const c = Math.cos(th);
  const sn = Math.sin(th);
  const cy = y0 + leafH / 2;

  ctx.clearRect(-padX, -padY, w + padX + padR, h + padY * 2);

  // 1) Sayfa bloğu ve sayfalar. Kapalıyken yalnız kapağın altındaki yaprak,
  // açıldıkça sol yaprak da ciltten sıyrılarak geliyor.
  const leftIn = f.other ? smooth(clamp01((e - 0.18) / 0.4)) : 0;
  const openW = leafW * leftIn;
  // Sol yaprak ciltten sıyrılırken hem kâğıdı hem yatağı aynı yere kırpılıyor:
  // yatak serbest bırakılırsa defter açılmadan sol yarıda kâğıt varmış gibi
  // görünüyor. Sonunda kırpma genişliyor ki sayfanın kendi gölgesi çıksın.
  const solPay = 400 * clamp01((leftIn - 0.9) / 0.1);
  const solKirp = () => {
    ctx.beginPath();
    ctx.rect(spineX - openW - solPay, y0 - padY - 400, openW + solPay, leafH + padY * 2 + 800);
    ctx.clip();
  };
  if (f.other && leftIn > 0) {
    ctx.save();
    solKirp();
    drawSheetBed(ctx, view, spineX - leafW, y0, leafW, leafH);
    ctx.restore();
  }
  drawSheetBed(ctx, view, spineX, y0, leafW, leafH);

  if (f.under) ctx.drawImage(f.under, spineX, y0, leafW, leafH);
  else { ctx.fillStyle = "#f6f2e9"; ctx.fillRect(spineX, y0, leafW, leafH); }
  drawEdgeShade(ctx, spineX, y0, leafW, leafH);

  if (f.other && leftIn > 0) {
    ctx.save();
    solKirp();
    ctx.globalAlpha = leftIn;
    ctx.drawImage(f.other, spineX - leafW, y0, leafW, leafH);
    drawEdgeShade(ctx, spineX - leafW, y0, leafW, leafH);
    ctx.restore();
  }

  // 2) Kapağın komşu sayfaya düşürdüğü gölge: kapak hangi yarının üstündeyse
  // orası daha koyu.
  const shade = (yon, a) => {
    if (a < 0.01) return;
    const g = ctx.createLinearGradient(spineX, 0, spineX + yon * leafW * 0.85, 0);
    g.addColorStop(0, `rgba(40,28,22,${a})`);
    g.addColorStop(1, "rgba(40,28,22,0)");
    ctx.fillStyle = g;
    ctx.fillRect(yon > 0 ? spineX : spineX - leafW, y0, leafW, leafH);
  };
  shade(1, 0.3 * sn * (c > 0 ? 1 : 0.45));
  if (f.other && leftIn > 0) shade(-1, 0.3 * sn * leftIn * (c < 0 ? 1 : 0.45));

  if (f.other && leftIn > 0) drawCrease(ctx, spineX, y0, leafH, leftIn);

  // 3) Kapak: menteşeden dönen sert bir levha. Şeritler halinde çiziliyor ki
  // dönerken perspektifle kısalsın — düz bir yatay ölçek kâğıt gibi yassı
  // görünüyordu.
  const img = c >= 0 ? f.front : astarBitmap();
  const duz = c >= 0;              // ön yüz mü, iç kapak mı
  if (img) {
    const D = 8;
    const proj = (u) => {
      const k = D / (D - sn * u);
      return [spineX + c * u * k * leafW, k];
    };
    const [xo, ko] = proj(1);
    const minX = Math.floor(Math.min(spineX, xo)) - 3;
    const maxX = Math.ceil(Math.max(spineX, xo)) + 3;
    const yarim = (leafH / 2) * Math.max(1, ko);
    const minY = Math.floor(cy - yarim) - 3;
    const maxY = Math.ceil(cy + yarim) + 3;
    const bw = Math.max(1, Math.ceil((maxX - minX) * olcek));
    const bh = Math.max(1, Math.ceil((maxY - minY) * olcek));
    if (!levha) levha = document.createElement("canvas");
    if (levha.width < bw || levha.height < bh) {
      levha.width = Math.max(bw, levha.width);
      levha.height = Math.max(bh, levha.height);
    }
    const b = levha.getContext("2d");
    b.setTransform(1, 0, 0, 1, 0, 0);
    b.clearRect(0, 0, levha.width, levha.height);
    b.setTransform(olcek, 0, 0, olcek, -minX * olcek, -minY * olcek);
    b.imageSmoothingEnabled = true;
    b.imageSmoothingQuality = "high";
    const N = 128;
    const iw = img.width;
    const ih = img.height;
    for (let i = 0; i < N; i++) {
      const u0 = i / N;
      const u1 = (i + 1) / N;
      const x0 = proj(u0)[0];
      const x1 = proj(u1)[0];
      const dw = Math.abs(x1 - x0);
      if (dw < 0.05) continue;
      const km = D / (D - sn * (u0 + u1) / 2);
      const hh = leafH * km;
      const s0 = (duz ? u0 : 1 - u0) * iw;
      const s1 = (duz ? u1 : 1 - u1) * iw;
      b.drawImage(img, Math.min(s0, s1), 0, Math.max(1, Math.abs(s1 - s0)), ih,
        Math.min(x0, x1) - 0.4, cy - hh / 2, dw + 0.8, hh);
    }
    // Işıktan dönerken kararıyor (yalnız levhanın kendi şekli üstünde).
    b.globalCompositeOperation = "source-atop";
    b.fillStyle = `rgba(30,20,15,${0.2 * sn * sn})`;
    b.fillRect(minX, minY, maxX - minX, maxY - minY);
    b.globalCompositeOperation = "source-over";

    ctx.save();
    // Tek sayfada kapağın altına girecek yaprak yok: son derecelerde kendisi
    // soluyor, yoksa tuval kalkınca ekrandan bir anda siliniyor.
    if (!f.other) ctx.globalAlpha = 1 - clamp01((-c - 0.86) / 0.14);
    ctx.shadowColor = `rgba(55,40,30,${0.2 + 0.14 * sn})`;
    ctx.shadowBlur = (30 + 8 * sn) * olcek;
    ctx.shadowOffsetY = 14 * (1 - sn) * olcek;
    ctx.drawImage(levha, 0, 0, bw, bh, minX, minY, bw / olcek, bh / olcek);
    ctx.restore();
  }

  // 4) Kapak yere yatarken sol yaprak üstüne biniyor: kapak sayfanın ALTINDA
  // kalır. Karşı yaprak yoksa (tek sayfa) kapağın kendisi soluyor.
  if (f.other) {
    const land = clamp01((-c - 0.86) / 0.14);
    if (land > 0) {
      ctx.save();
      ctx.globalAlpha = land;
      ctx.drawImage(f.other, spineX - leafW, y0, leafW, leafH);
      drawEdgeShade(ctx, spineX - leafW, y0, leafW, leafH);
      drawCrease(ctx, spineX, y0, leafH, land);
      ctx.restore();
    }
  }
}

/** İç kapak astarı: krem kâğıt, cilt tarafına doğru koyulaşan. */
let astar = null;
let levha = null;
function astarBitmap() {
  if (astar) return astar;
  astar = document.createElement("canvas");
  astar.width = 64;
  astar.height = 8;
  const a = astar.getContext("2d");
  // İç kapak ters okunuyor (aynalı), o yüzden koyu uç sağda: ekranda cilt
  // tarafına düşüyor.
  const g = a.createLinearGradient(0, 0, 64, 0);
  g.addColorStop(0, "#f4eee0");
  g.addColorStop(0.82, "#efe7d6");
  g.addColorStop(1, "#e6dcc6");
  a.fillStyle = g;
  a.fillRect(0, 0, 64, 8);
  return astar;
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
      drawCoverFrame({ ctx: view.ctx, w: frames.spreadW, h: frames.spreadH, padX: view.padX, padR: view.padR, padY: view.padY, olcek: view.olcek }, frames, e);
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
