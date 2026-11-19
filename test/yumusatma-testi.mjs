// Kalem yumuşatmasının (Stabilizatör, web/js/yumusatma.js) ölçüm testi.
// Çalıştır (repo kökünden):  node test/yumusatma-testi.mjs
// Kalem olay akışı 240 Hz zaman damgalarıyla (Apple Pencil, birleştirilmiş olaylar) benzetilir.
// Her seviye eski v107 üstel süzgeciyle (τ = 14 / 26 / 55 ms) yan yana ölçülür. Hepsi ✓ olmalı.
//
// Ölçülenler:
//  1. Boy: yazı hızındaki küçük daireler ("e/a/o" boyu, yarıçap 4–6 birim, tur 120–200 ms)
//     çıktı yarıçapı / girdi yarıçapı. Akıcı ≥ 0.96, Yumuşak ≥ 0.97. İpek bilerek eski
//     süzgeçte (gamma 0): yalnız eskisinin aynısı mı diye bakılır.
//  1b. Ölçek: ekranda aynı boyda harf, sayfa 2x / 3x yakınken de korunmalı (iPad'de sığdırma ölçeği 1.2–2.2).
//  2. Titreme: yavaş (30 birim/s) düz çizgi + ±2 birim gürültü; sapma / Temel sapması.
//     Yeni süzgeç eskisi kadar ya da daha çok almalı.
//  3. Uç: kalem kalkınca son nokta gerçek uca ≤ 0.5 birim.
//  4. Gecikme: 600 ve 200 birim/s düz çizgide çıktının girdinin ne kadar gerisinde kaldığı.

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const kok = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const src = fs.readFileSync(path.join(kok, "web", "js", "yumusatma.js"), "utf8");
const Y = await import("data:text/javascript;base64," + Buffer.from(src).toString("base64"));

// ---------- eski süzgeç (v107, ink.js onMove) ----------
const ESKI_TAU = [0, 14, 26, 55];
class EskiSuzgec {
  constructor(tau, x, y, t) { this.tau = tau; this.x = x; this.y = y; this.son = t; }
  ekle(x, y, t) {
    const dt = Math.min(50, Math.max(1, t - this.son));
    this.son = t;
    const oran = this.tau ? 1 - Math.exp(-dt / this.tau) : 1;
    this.x += (x - this.x) * oran;
    this.y += (y - this.y) * oran;
    return [this.x, this.y];
  }
  ucaYetis(x, y) { return [0.5, 1].map((k) => [this.x + (x - this.x) * k, this.y + (y - this.y) * k]); }
}
class Ham { constructor(x, y) { this.x = x; this.y = y; } ekle(x, y) { this.x = x; this.y = y; return [x, y]; } ucaYetis(x, y) { return [[x, y]]; } }

const SEVIYE = ["Temel", "Yumuşak", "İpek", "Akıcı"];
const eski = (s) => (x, y, t) => (ESKI_TAU[s] ? new EskiSuzgec(ESKI_TAU[s], x, y, t) : new Ham(x, y));
const yeni = (s) => (x, y, t) => Y.kalemSuzgeci(s, x, y, t) || new Ham(x, y);

// ---------- olay akışı ----------
let tohum = 1;
const rnd = () => { tohum = (tohum * 1103515245 + 12345) & 0x7fffffff; return tohum / 0x7fffffff; };
/** yol(t) → [x, y]; hz örnekleme, zaman damgasında ±0.3 ms oynama (gerçek olaylar gibi). */
function ciz(yap, yol, sure, hz = 240, gurultu = 0) {
  tohum = 1;
  const dt = 1000 / hz;
  const [x0, y0] = yol(0);
  const f = yap(x0, y0, 0);
  const cikti = [[x0, y0, 0]], girdi = [[x0, y0, 0]];
  for (let i = 1; i * dt <= sure; i++) {
    const t = i * dt + (rnd() - 0.5) * 0.6;
    const [x, y] = yol(i * dt);
    const gx = x + (rnd() * 2 - 1) * gurultu, gy = y + (rnd() * 2 - 1) * gurultu;
    girdi.push([gx, gy, t]);
    cikti.push([...f.ekle(gx, gy, t), t]);
  }
  return { cikti, girdi, f };
}

// 1. Boy: daire, 3 tur; ilk tur atılır, kalan turlarda merkeze ortalama uzaklık / r.
const daireOrani = (yap, r, T, hz = 240) => {
  const { cikti } = ciz(yap, (t) => [100 + r * Math.cos(2 * Math.PI * t / T), 100 + r * Math.sin(2 * Math.PI * t / T)], 3 * T, hz);
  const kalan = cikti.filter((p) => p[2] >= T);
  return kalan.reduce((a, p) => a + Math.hypot(p[0] - 100, p[1] - 100), 0) / kalan.length / r;
};
// Tek "o": duruştan başlayıp bir tur; kutu boyu / gerçek kutu.
const tekO = (yap, r = 5, T = 150) => {
  const { cikti } = ciz(yap, (t) => [100 + r * Math.sin(2 * Math.PI * t / T), 100 - r * Math.cos(2 * Math.PI * t / T)], T * 1.05);
  const xs = cikti.map((p) => p[0]), ys = cikti.map((p) => p[1]);
  return ((Math.max(...xs) - Math.min(...xs)) + (Math.max(...ys) - Math.min(...ys))) / (4 * r);
};
// Bitişik "eee": sağa ilerleyen döngüler (yükseklik 2r, döngü 160 ms); çıktı yüksekliği / girdi yüksekliği.
const eee = (yap, r = 5, T = 160) => {
  const yol = (t) => { const g = 2 * Math.PI * t / T; return [100 + t * 0.06 - r * Math.sin(g), 100 - r + r * Math.cos(g)]; };
  const { cikti, girdi } = ciz(yap, yol, T * 4);
  const boy = (a) => { const ys = a.filter((p) => p[2] >= T).map((p) => p[1]); return Math.max(...ys) - Math.min(...ys); };
  return boy(cikti) / boy(girdi);
};

// 2. Titreme: düz çizgi (y = 100) üzerinde dikey sapma ortalaması; ilk 200 ms atılır.
const sapma = (yap, hiz, gurultu = 2) => {
  const { cikti } = ciz(yap, (t) => [100 + hiz * t / 1000, 100], 2000, 240, gurultu);
  const k = cikti.filter((p) => p[2] > 200);
  return k.reduce((a, p) => a + Math.abs(p[1] - 100), 0) / k.length;
};
// El titremesi: 9 Hz, 1 birim genlikli dikey salınım (gürültü yok).
const titremeEl = (yap) => {
  const { cikti } = ciz(yap, (t) => [100 + 30 * t / 1000, 100 + Math.sin(2 * Math.PI * 9 * t / 1000)], 2000);
  const k = cikti.filter((p) => p[2] > 200);
  return k.reduce((a, p) => a + Math.abs(p[1] - 100), 0) / k.length;
};

// Hızlı yazıda pürüz: r = 8 döngü 220 ms'de (~230 birim/s) + ±0.6 gürültü; yarıçapın oynaması.
const puruz = (yap) => {
  const { cikti } = ciz(yap, (t) => [100 + 8 * Math.cos(2 * Math.PI * t / 220), 100 + 8 * Math.sin(2 * Math.PI * t / 220)], 660, 240, 0.6);
  const d = cikti.filter((p) => p[2] >= 220).map((p) => Math.hypot(p[0] - 100, p[1] - 100));
  const m = d.reduce((a, b) => a + b, 0) / d.length;
  return Math.sqrt(d.reduce((a, b) => a + (b - m) ** 2, 0) / d.length);
};

// 3. Uç: 600 birim/s çizgi 150 ms sonra kalkar; kalkışta yetişme noktaları eklenir.
const uc = (yap) => {
  const { cikti, girdi, f } = ciz(yap, (t) => [100 + 600 * t / 1000, 100 + 300 * t / 1000], 150);
  const g = girdi[girdi.length - 1], s = cikti[cikti.length - 1];
  const yetis = f.ucaYetis(g[0], g[1]);
  const son = yetis[yetis.length - 1];
  return { once: Math.hypot(s[0] - g[0], s[1] - g[1]), sonra: Math.hypot(son[0] - g[0], son[1] - g[1]) };
};

// 4. Gecikme: kararlı durumda girdi ile çıktı arası uzaklık.
const gecikme = (yap, hiz) => {
  const { cikti, girdi } = ciz(yap, (t) => [100 + hiz * t / 1000, 100], 300);
  const g = girdi[girdi.length - 1], c = cikti[cikti.length - 1];
  return Math.hypot(g[0] - c[0], g[1] - c[1]);
};

// ---------- ölç ----------
const DAIRELER = [[4, 120], [4, 200], [5, 150], [5, 200], [6, 120], [6, 200]];
const YAVAS_KUCUK = [[4, 300], [3, 250]];
const ESIK_BOY = [1, 0.97, 0.97, 0.96];
const f3 = (v) => v.toFixed(3);
const f2 = (v) => v.toFixed(2);
let hata = 0;
const kontrol = (ok, metin) => { console.log((ok ? "✓ " : "✗ ") + metin); if (!ok) hata++; };

console.log("Daireler (yarıçap/tur ms): " + DAIRELER.map((d) => d.join("/")).join("  ") + "   yavaş-küçük: " + YAVAS_KUCUK.map((d) => d.join("/")).join("  "));
console.log("");
const temelPuruz = puruz(eski(0));
const temelSapma = sapma(eski(0), 30), temelDur = sapma(eski(0), 0), temel60 = sapma(eski(0), 60), temelEl = titremeEl(eski(0));
for (let s = 1; s <= 3; s++) {
  const satir = (ad, yap) => {
    const d = DAIRELER.map(([r, T]) => daireOrani(yap, r, T));
    const yk = YAVAS_KUCUK.map(([r, T]) => daireOrani(yap, r, T));
    return {
      ad, d, min: Math.min(...d), yk, o: tekO(yap), e: eee(yap),
      t30: sapma(yap, 30) / temelSapma, t0: sapma(yap, 0) / temelDur, t60: sapma(yap, 60) / temel60, pz: puruz(yap) / temelPuruz, el: titremeEl(yap) / temelEl,
      uc: uc(yap), g600: gecikme(yap, 600), g200: gecikme(yap, 200),
      hz100: Math.min(...DAIRELER.map(([r, T]) => daireOrani(yap, r, T, 100)))
    };
  };
  const a = satir("eski", eski(s)), b = satir("yeni", yeni(s));
  console.log(`── ${SEVIYE[s]} ──`);
  if (!Y.YUMUSATMA[s].gamma) {
    // Bu seviye bilerek eski süzgeçte bırakıldı (İpek): sonuç eskisinin aynısı olmalı.
    kontrol(Math.abs(b.min - a.min) < 1e-9 && Math.abs(b.t30 - a.t30) < 1e-9, `${SEVIYE[s]} eskisinin aynısı: boy ${f3(b.min)} = ${f3(a.min)}`);
    kontrol(b.uc.sonra <= 0.5, `${SEVIYE[s]} uç gerçek uca ${f2(b.uc.sonra)} ≤ 0.5`);
    console.log("");
    continue;
  }
  for (const k of [a, b]) {
    console.log(`  ${k.ad}: boy ${k.d.map(f3).join(" ")} (en az ${f3(k.min)}; 100 Hz'de ${f3(k.hz100)})  yavaş-küçük ${k.yk.map(f3).join(" ")}  tek "o" ${f3(k.o)}  "eee" ${f3(k.e)}`);
    console.log(`        titreme/Temel: 30 b/s ${f3(k.t30)}  duran ${f3(k.t0)}  60 b/s ${f3(k.t60)}  hızlı yazıda pürüz ${f3(k.pz)}  el titremesi 9 Hz ${f3(k.el)}   gecikme 600 b/s ${f2(k.g600)}  200 b/s ${f2(k.g200)}   uç ${f2(k.uc.once)} → ${f2(k.uc.sonra)}`);
  }
  kontrol(b.min >= ESIK_BOY[s], `${SEVIYE[s]} boy korunuyor: en az ${f3(b.min)} ≥ ${ESIK_BOY[s]} (eski ${f3(a.min)})`);
  kontrol(b.hz100 >= ESIK_BOY[s] - 0.01, `${SEVIYE[s]} 100 Hz'de de aynı: ${f3(b.hz100)} (240 Hz ${f3(b.min)})`);
  kontrol(b.yk.every((v, i) => v >= a.yk[i] - 0.001), `${SEVIYE[s]} yavaş küçük harfte eskisinden küçültmüyor: ${b.yk.map(f3).join(" ")} (eski ${a.yk.map(f3).join(" ")})`);
  kontrol(b.o >= 0.95 && b.e >= 0.95, `${SEVIYE[s]} tek "o" ${f3(b.o)}, "eee" ${f3(b.e)} ≥ 0.95 (eski ${f3(a.o)}, ${f3(a.e)})`);
  kontrol(b.t30 <= a.t30 + 0.01, `${SEVIYE[s]} yavaş çizgide titreme eskisi kadar alınıyor: ${f3(b.t30)} ≤ ${f3(a.t30)} (+0.01)`);
  kontrol(b.t0 <= a.t0 + 0.01, `${SEVIYE[s]} duran kalemde titreme eskisi kadar alınıyor: ${f3(b.t0)} ≤ ${f3(a.t0)} (+0.01)`);
  kontrol(b.uc.sonra <= 0.5, `${SEVIYE[s]} uç gerçek uca ${f2(b.uc.sonra)} ≤ 0.5`);
  kontrol(b.g600 <= a.g600, `${SEVIYE[s]} gecikme 600 b/s: ${f2(b.g600)} ≤ eski ${f2(a.g600)}`);
  console.log("");
}
// Ölçek: ekranda aynı "o" (yarıçap 5 / 4 piksel), sayfa olcek kat yakınken sayfada r/olcek birim.
for (const olcek of [2, 3]) for (const s of [1, 3]) {
  const yap = (x, y, t) => Y.kalemSuzgeci(s, x, y, t, olcek);
  const d = [[5, 150], [4, 200], [4, 120]].map(([r, T]) => daireOrani(yap, r / olcek, T));
  kontrol(Math.min(...d) >= ESIK_BOY[s] - 0.01, `${SEVIYE[s]} ${olcek}x yakınken de boy korunuyor: ${d.map(f3).join(" ")}`);
}
// Temel: süzgeç yok.
kontrol(Y.kalemSuzgeci(0, 0, 0, 0) === null, "Temel süzgeçsiz");
// gamma = 0 → eski üstel süzgecin aynısı (seviye tablosu geri alınmak istenirse).
{
  const ayar = { minC: Y.YUMUSATMA[2].minC, gamma: 0, v0: 0, v1: 1 };
  const a = new EskiSuzgec(26, 0, 0, 0), b = new Y.KalemSuzgeci(ayar, 0, 0, 0);
  let fark = 0;
  for (let i = 1; i < 200; i++) { const t = i * 4.17, x = Math.sin(i / 7) * 9, y = i * 0.3; const p = a.ekle(x, y, t), q = b.ekle(x, y, t); fark = Math.max(fark, Math.hypot(p[0] - q[0], p[1] - q[1])); }
  kontrol(fark < 1e-9, `gamma = 0 eski τ = 26 ms süzgecinin aynısı (fark ${fark.toExponential(1)})`);
}
console.log("");
console.log(hata ? `${hata} hata` : "Hepsi ✓");
process.exit(hata ? 1 : 0);
