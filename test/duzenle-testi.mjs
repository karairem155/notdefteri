// "Yazıyı düzenle" geometrisinin testi (web/js/duzenle.js). Tanıma yok: kelime düzeyinde ölçek + öteleme.
// Çalıştır (repo kökünden):  node test/duzenle-testi.mjs
// Sentetik el yazısı üretir (farklı boylar, eğri/eğik satır, i noktası, ğ şapkası, t çizgisi),
// düzenler ve sonucu sayılarla ölçer. Hepsi ✓ olmalı.

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const kok = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const src = fs.readFileSync(path.join(kok, "web", "js", "duzenle.js"), "utf8");
const D = await import("data:text/javascript;base64," + Buffer.from(src).toString("base64"));
// Uygulamanın çizgi bitişindeki sadeleştirmesi (ink.js simplify): kayıtlı el yazısı hep böyle.
const inkSrc = fs.readFileSync(path.join(kok, "web", "js", "ink.js"), "utf8");
const pick = (name) => {
  const i = inkSrc.indexOf("function " + name + "(");
  if (i < 0) throw new Error(name + " bulunamadı");
  let d = 0;
  const j = inkSrc.indexOf("{", i);
  for (let k = j; k < inkSrc.length; k++) {
    if (inkSrc[k] === "{") d++;
    else if (inkSrc[k] === "}") { d--; if (!d) return inkSrc.slice(i, k + 1); }
  }
};
const { simplify } = new Function(pick("simplify") + "\n" + pick("segmentDistance") + "\nreturn { simplify };")();

// ---------- sentetik yazı ----------
// Harfler gövde biriminde: x-yüksekliği 1, taban y = 0, y aşağı doğru büyür (üst = eksi).
const elips = (cx, cy, rx, ry, n = 28) => Array.from({ length: n + 1 }, (_, i) => { const a = -Math.PI / 2 - (i / n) * Math.PI * 2; return [cx + rx * Math.cos(a), cy + ry * Math.sin(a)]; });
const kase = () => elips(0.25, -0.5, 0.25, 0.5);
const HARF = {
  n: { c: [[[0, -1], [0, 0], [0, -0.6], [0.15, -0.95], [0.35, -1], [0.5, -0.8], [0.5, 0]]], g: 0.5 },
  m: { c: [[[0, -1], [0, 0], [0, -0.7], [0.15, -1], [0.3, -0.7], [0.3, 0], [0.3, -0.7], [0.45, -1], [0.6, -0.7], [0.6, 0]]], g: 0.6 },
  o: { c: [elips(0.25, -0.5, 0.25, 0.5)], g: 0.5 },
  a: { c: [kase(), [[0.5, -1], [0.5, 0]]], g: 0.5 },
  e: { c: [[[0, -0.5], [0.5, -0.5], [0.45, -0.8], [0.25, -1], [0.05, -0.85], [0, -0.5], [0.05, -0.15], [0.25, 0], [0.5, -0.1]]], g: 0.5 },
  l: { c: [[[0, -1.7], [0, 0]]], g: 0.05 },
  i: { c: [[[0, -1], [0, 0]]], nokta: [[[0, -1.45], [0.05, -1.42]]], g: 0.05 },
  ı: { c: [[[0, -1], [0, 0]]], g: 0.05 },
  g: { c: [kase(), [[0.5, -1], [0.5, 0.55], [0.35, 0.75], [0.05, 0.65]]], g: 0.5 },
  ğ: { c: [kase(), [[0.5, -1], [0.5, 0.55], [0.35, 0.75], [0.05, 0.65]]], nokta: [[[0.08, -1.45], [0.25, -1.28], [0.42, -1.45]]], g: 0.5 },
  k: { c: [[[0, -1.7], [0, 0]], [[0.45, -1], [0, -0.45], [0.45, 0]]], g: 0.45 },
  t: { c: [[[0.15, -1.45], [0.15, -0.1], [0.25, 0], [0.35, -0.05]]], nokta: [[[0, -1], [0.35, -1]]], g: 0.35 },
  u: { c: [[[0, -1], [0, -0.25], [0.15, 0], [0.35, 0], [0.5, -0.25], [0.5, -1], [0.5, 0]]], g: 0.5 },
  d: { c: [kase(), [[0.5, -1.7], [0.5, 0]]], g: 0.5 }
};

let tohum = 7;
const rnd = () => { tohum = (tohum * 16807) % 2147483647; return tohum / 2147483647 - 0.5; };
let sayac = 0;
// Kalem örneklemesi: ~0.06 gövde aralıklı noktalar, küçük titreme.
const yogun = (poly, olcek) => {
  const o = [];
  for (let i = 1; i < poly.length; i++) {
    const [ax, ay] = poly[i - 1], [bx, by] = poly[i];
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / 0.06));
    for (let j = 0; j < n; j++) { const t = j / n; o.push([ax + (bx - ax) * t, ay + (by - ay) * t]); }
  }
  o.push(poly[poly.length - 1]);
  return o.map(([x, y]) => [x + rnd() * 0.02, y + rnd() * 0.02]).map(([x, y]) => [x * olcek, y * olcek]);
};

/** Kelime yaz: x başlangıç, taban(x) eğrisi, gövde boyu. bitisik: harfler tek çizgide. */
// Uygulamadaki kalem yumuşatması gibi: üstel izleme, dönüşleri yuvarlar (m/n'nin dipleri yukarıda kalır).
// Çizgi sonunda kalem ucuna yetişilir (ink.js onUp).
let YUMUSAT = 0;
const yumusat = (pts) => {
  if (!YUMUSAT) return pts;
  const o = [pts[0].slice()];
  let sx = pts[0][0], sy = pts[0][1];
  for (let i = 1; i < pts.length; i++) { sx += (pts[i][0] - sx) * YUMUSAT; sy += (pts[i][1] - sy) * YUMUSAT; o.push([sx, sy, pts[i][2]]); }
  const u = pts[pts.length - 1];
  o.push([(sx + u[0]) / 2, (sy + u[1]) / 2, u[2]], u.slice());
  const r = o.map(([x, y, p]) => [Math.round(x * 10) / 10, Math.round(y * 10) / 10, p]);
  return r.length > 8 ? simplify(r, 0.35) : r;
};

// Harfleri ayrı ve özensiz yazılmış yazı: harf başına boy ±%12, taban ±0.2 gövde oynar, harf arası 0.3 gövde.
let AYRIK = null;

function kelime(metin, x, taban, boy0, bitisik = false) {
  const strokes = [], ekIds = [], harfler = [];
  let cx = x;
  let birlesik = null;
  for (const ch of metin) {
    const harf = HARF[ch];
    const boy = AYRIK ? boy0 * (1 + rnd() * 2 * AYRIK.boy) : boy0;
    const y0 = taban(cx) + (AYRIK ? rnd() * 2 * AYRIK.taban * boy0 : 0);
    const yer = (pts) => pts.map(([px, py]) => [Math.round((cx + px) * 10) / 10, Math.round((y0 + py) * 10) / 10, 0.5]);
    const anaIds = [];
    harf.c.forEach((poly, i) => {
      const pts = yumusat(yer(yogun(poly, boy)));
      if (bitisik && i === 0) {
        if (!birlesik) { birlesik = { id: "s" + (++sayac), tool: "pen", width: 2, points: pts }; strokes.push(birlesik); }
        else birlesik.points.push(...pts);
        anaIds.push(birlesik.id);
      } else { const s = { id: "s" + (++sayac), tool: "pen", width: 2, points: pts }; strokes.push(s); anaIds.push(s.id); }
    });
    for (const poly of harf.nokta || []) { const s = { id: "s" + (++sayac), tool: "pen", width: 2, points: yer(yogun(poly, boy)) }; strokes.push(s); ekIds.push({ id: s.id, harf: anaIds[0] }); }
    harfler.push({ x: cx, taban: y0, ids: anaIds });
    cx += harf.g * boy + (AYRIK ? AYRIK.ara : 0.22) * boy0;
  }
  return { metin, boy: boy0, strokes, ekIds, harfler, ids: strokes.map((s) => s.id), son: cx - (AYRIK ? AYRIK.ara : 0.22) * boy0 };
}

// ---------- ölçüm yardımcıları ----------
let gecti = 0, toplam = 0;
const kontrol = (ad, kosul, ayrinti) => { toplam++; if (kosul) gecti++; console.log((kosul ? "✓ " : "✗ ") + ad.padEnd(64) + (ayrinti || "")); };
const f = (v, n = 2) => Number(v).toFixed(n);
const uygula = (strokes, plan) => strokes.map((s) => ({ ...s, points: D.noktalariDonustur(s.points, plan.get(s.id)) }));
const kutu = (strokes) => { const p = strokes.flatMap((s) => s.points); return { x0: Math.min(...p.map((q) => q[0])), x1: Math.max(...p.map((q) => q[0])) }; };
const ayni = (a, b) => a.length === b.length && a.every((v) => b.includes(v));

/** Bir senaryoyu düzenler ve ölçer. satirlar: [[kelime, ...], ...] */
function senaryo(ad, satirlar, ayar = {}, ek = {}) {
  console.log("\n— " + ad);
  const kelimeler = satirlar.flat();
  const strokes = kelimeler.flatMap((k) => k.strokes).concat(ek.digerleri || []);
  const cozum = D.yaziyiCozumle(strokes);

  // 1) Bölütleme: satır ve kelime sayısı, kelimenin bütün çizgileri (noktalar dahil) aynı kelimede mi.
  kontrol("satır sayısı", cozum.satirlar.length === satirlar.length, `${cozum.satirlar.length} / beklenen ${satirlar.length}`);
  satirlar.forEach((sat, i) => {
    const bulunan = cozum.satirlar[i] ? cozum.satirlar[i].kelimeler : [];
    kontrol(`satır ${i + 1} kelime sayısı`, bulunan.length === sat.length, `${bulunan.length} / beklenen ${sat.length}`);
    sat.forEach((k, j) => kontrol(`  "${k.metin}" çizgileri tek kelimede (${k.ids.length} çizgi, ${k.ekIds.length} nokta/şapka)`, bulunan[j] && ayni(bulunan[j].ids, k.ids)));
  });

  const T = ayar.boy || cozum.varsayilan.boy;
  const plan = D.yaziDonusumleri(cozum, ayar);
  const sonra = uygula(strokes, plan);
  const byId = new Map(sonra.map((s) => [s.id, s]));

  // 2) Gövde ve taban: düzenlenmiş çizgileri baştan ölç.
  const cozum2 = D.yaziyiCozumle(sonra);
  const govdeler = cozum2.kelimeler.map((k) => k.govde);
  const sapma = Math.max(...govdeler.map((g) => Math.abs(g / T - 1)));
  kontrol(`gövdeler hedefin ±%5'inde (hedef ${f(T, 1)})`, sapma <= 0.05, `önce ${cozum.kelimeler.map((k) => f(k.govde, 1)).join(" ")} → sonra ${govdeler.map((g) => f(g, 1)).join(" ")} · en çok %${f(sapma * 100, 1)}`);
  cozum2.satirlar.forEach((s, i) => {
    const tb = s.kelimeler.map((k) => k.taban);
    const once = cozum.satirlar[i].kelimeler.map((k) => k.taban);
    const yay = Math.max(...tb) - Math.min(...tb);
    kontrol(`satır ${i + 1} tabanları ±1 birimde`, yay <= 2, `önce yayılım ${f(Math.max(...once) - Math.min(...once), 1)} → sonra ${f(yay, 2)}`);
    // Kelime aralıkları eşit mi (kutudan kutuya).
    const kel = satirlar[i].map((k) => kutu(k.strokes.map((st) => byId.get(st.id))));
    const araliklar = kel.slice(1).map((b, j) => b.x0 - kel[j].x1);
    if (araliklar.length > 1) kontrol(`satır ${i + 1} kelime aralıkları eşit`, Math.max(...araliklar) - Math.min(...araliklar) <= 0.5, araliklar.map((a) => f(a, 1)).join(" "));
    else if (araliklar.length === 1) kontrol(`satır ${i + 1} kelime aralığı ≈ ${f(plan.size ? (ayar.bosluk != null ? ayar.bosluk : cozum.varsayilan.bosluk) * T : 0, 1)}`, Math.abs(araliklar[0] - (ayar.bosluk != null ? ayar.bosluk : cozum.varsayilan.bosluk) * T) <= 0.5, f(araliklar[0], 1));
  });
  if (cozum2.satirlar.length > 1) {
    const ara = cozum2.satirlar.slice(1).map((s, i) => s.taban - cozum2.satirlar[i].taban);
    if (ayar.cizgi) {
      const c = ayar.cizgi;
      const uzak = Math.max(...cozum2.satirlar.map((s) => Math.abs(((s.taban - c.ofset) % c.aralik + c.aralik) % c.aralik > c.aralik / 2 ? c.aralik - ((s.taban - c.ofset) % c.aralik + c.aralik) % c.aralik : ((s.taban - c.ofset) % c.aralik + c.aralik) % c.aralik)));
      kontrol(`tabanlar sayfa çizgisinde (±1)`, uzak <= 1, `tabanlar ${cozum2.satirlar.map((s) => f(s.taban, 1)).join(" ")} · çizgiden en çok ${f(uzak, 2)}`);
    } else {
      const aralik = ayar.aralik || cozum.varsayilan.aralik;
      kontrol(`satır aralığı = ${f(aralik, 2)} × gövde (${f(aralik * T, 1)})`, ara.every((a) => Math.abs(a - aralik * T) <= 1), ara.map((a) => f(a, 1)).join(" "));
    }
  }

  // 3) Nokta/şapka harfiyle aynı dönüşümü aldı mı; harfe göre konumu ölçekle orantılı mı.
  for (const k of kelimeler) for (const e of k.ekIds) {
    const dn = plan.get(e.id), dh = plan.get(e.harf);
    const o = strokes.find((s) => s.id === e.id).points[0], oh = strokes.find((s) => s.id === e.harf).points[0];
    const n = byId.get(e.id).points[0], nh = byId.get(e.harf).points[0];
    // Aynı dönüşüm: harfe göre konum ölçek ve (eğim düzeltmesi) döndürmeyle orantılı.
    const beklenen = dh ? dh.s * ((dh.sn || 0) * (o[0] - oh[0]) + (dh.c == null ? 1 : dh.c) * (o[1] - oh[1])) : 0;
    kontrol(`  "${k.metin}" nokta/şapka harfiyle taşındı`, dn && dn === dh && Math.abs((n[1] - nh[1]) - beklenen) < 0.05, `dikey uzaklık ${f(o[1] - oh[1], 1)} → ${f(n[1] - nh[1], 1)} (s=${dh ? f(dh.s) : "-"}, açı ${dh ? f(Math.atan2(dh.sn || 0, dh.c == null ? 1 : dh.c) * 180 / Math.PI, 1) : "-"}°)`);
  }

  // 4) Gerçek (üretimdeki) x-yüksekliği ve taban: tahminden bağımsız ölçü.
  const gercek = kelimeler.map((k) => { const d = plan.get(k.ids[0]); return k.boy * d.s; });
  const gy = (Math.max(...gercek) / Math.min(...gercek) - 1) * 100;
  const gyOnce = (Math.max(...kelimeler.map((k) => k.boy)) / Math.min(...kelimeler.map((k) => k.boy)) - 1) * 100;
  kontrol(`gerçek x-yüksekliği farkı < %${ek.boyTol || 20}`, gy < (ek.boyTol || 20), `önce %${f(gyOnce, 0)} → sonra %${f(gy, 1)} (harf karışımı farkı)`);
  satirlar.forEach((sat, i) => {
    const tb = sat.flatMap((k) => k.harfler.map((h) => { const d = plan.get(h.ids[0]); return D.noktalariDonustur([[h.x, h.taban, 0]], d)[0][1]; }));
    const once = sat.flatMap((k) => k.harfler.map((h) => h.taban));
    const yay = Math.max(...tb) - Math.min(...tb);
    const tt = ek.tabanTol || 0.25;
    kontrol(`satır ${i + 1} gerçek taban yayılımı < ${tt} gövde`, yay < tt * T, `önce ${f(Math.max(...once) - Math.min(...once), 1)} → sonra ${f(yay, 1)} (harf harf, üretimdeki gerçek taban)`);
  });

  // 5) Şiddet 0: hiçbir nokta değişmez. Şiddet 0.5: gövdeler arada.
  const p0 = D.yaziDonusumleri(cozum, { ...ayar, siddet: 0 });
  let enCok = 0;
  for (const s of strokes) { const y = D.noktalariDonustur(s.points, p0.get(s.id)); s.points.forEach((p, i) => { enCok = Math.max(enCok, Math.abs(p[0] - y[i][0]), Math.abs(p[1] - y[i][1]), Math.abs(p[2] - y[i][2])); }); }
  kontrol("şiddet 0: hiçbir nokta değişmiyor", enCok === 0, `en büyük fark ${enCok}`);
  const yarim = D.yaziyiCozumle(uygula(strokes, D.yaziDonusumleri(cozum, { ...ayar, siddet: 0.5 })));
  const araMi = yarim.kelimeler.every((k, i) => { const a = cozum.kelimeler[i].govde, b = cozum2.kelimeler[i].govde; return k.govde >= Math.min(a, b) - 0.5 && k.govde <= Math.max(a, b) + 0.5; });
  kontrol("şiddet 0.5: gövdeler önceyle hedef arasında", araMi, yarim.kelimeler.map((k) => f(k.govde, 1)).join(" "));

  // 6) Kalınlık ve basınç değişmedi.
  kontrol("kalınlık ve basınç aynı", sonra.every((s, i) => s.width === strokes[i].width && s.points.every((p, j) => p[2] === strokes[i].points[j][2])));
  return { cozum, plan, strokes, sonra };
}

// A) Eğri tek satır, üç boy (10 / 16 / 24): "minik değil kalem"
{
  const egri = (x) => 300 + 22 * Math.sin((x - 100) / 140);
  const a = kelime("minik", 100, egri, 10);
  const b = kelime("değil", a.son + 14, egri, 16);
  const c = kelime("kalem", b.son + 22, egri, 24);
  senaryo("A: eğri satır, 3 boy, ayrık harfler", [[a, b, c]]);
}

// B) İki eğik satır, dört boy: "dağ ile / tutkal minik"
{
  const s1 = (x) => 200 + 0.08 * (x - 80);
  const s2 = (x) => 275 - 0.05 * (x - 80);
  const a = kelime("dağ", 80, s1, 14);
  const b = kelime("ile", a.son + 18, s1, 20);
  const c = kelime("tutkal", 80, s2, 12);
  const d = kelime("minik", c.son + 16, s2, 18);
  senaryo("B: iki eğik satır, 4 boy", [[a, b], [c, d]], { aralik: 3 });
  senaryo("B': aynı yazı, yazı boyu 14 elle", [[a, b], [c, d]], { boy: 14, aralik: 3 });
}

// C) Çizgili sayfa (32 birim, çizgi y = 32n − 0.5) + yazı olmayan çizgiler dokunulmaz
{
  const s1 = (x) => 205 + 0.06 * (x - 80);
  const s2 = (x) => 268 - 0.04 * (x - 80);
  const a = kelime("dağ", 80, s1, 11);
  const b = kelime("ile", a.son + 14, s1, 15);
  const c = kelime("tutkal", 80, s2, 9);
  const d = kelime("minik", c.son + 12, s2, 13);
  const fosforlu = { id: "fos", tool: "highlighter", width: 10, points: [[80, 200, 0.5], [300, 200, 0.5]] };
  const altCizgi = { id: "alt", tool: "pen", width: 2, points: Array.from({ length: 40 }, (_, i) => [80 + i * 6, 290 + (i % 2) * 0.4, 0.5]) };
  const { cozum, plan } = senaryo("C: çizgili sayfaya otur", [[a, b], [c, d]], { cizgi: { aralik: 32, ofset: -0.5 } }, { digerleri: [fosforlu, altCizgi] });
  kontrol("fosforlu ve alt çizgi düzenlenmiyor", !plan.has("fos") && !plan.has("alt") && cozum.haric.includes("fos") && cozum.haric.includes("alt"));
}

// D) Bitişik yazı: kelime tek çizgi, noktalar ayrı
{
  const egri = (x) => 420 + 15 * Math.sin((x - 60) / 110);
  const a = kelime("minik", 60, egri, 12, true);
  const b = kelime("tulum", a.son + 16, egri, 20, true);
  const c = kelime("değil", b.son + 13, egri, 14, true);
  senaryo("D: bitişik yazı, 3 boy", [[a, b, c]]);
}

// E) Zaten düzgün yazı bozulmamalı: aynı boy, düz satır, eşit aralık. Varsayılan ayarla en çok ne kadar kayıyor?
{
  const s1 = () => 150, s2 = () => 150 + 2.6 * 14;
  const a = kelime("kalem", 70, s1, 14), b = kelime("minik", a.son + 13, s1, 14);
  const c = kelime("değil", 70, s2, 14), d = kelime("tulum", c.son + 13, s2, 14);
  const { strokes, sonra } = senaryo("E: zaten düzgün yazı", [[a, b], [c, d]]);
  let enCok = 0;
  strokes.forEach((s, i) => s.points.forEach((p, j) => { enCok = Math.max(enCok, Math.hypot(p[0] - sonra[i].points[j][0], p[1] - sonra[i].points[j][1])); }));
  kontrol("düzgün yazıda en büyük kayma < 0.15 gövde (2.1)", enCok < 2.1, f(enCok, 2) + " birim");
}

// F) Sık satırlar (taban arası 1.7 gövde): ğ/g kuyruğu alt satırın l/k sapına yaklaşıyor, satırlar karışmamalı.
{
  const s1 = (x) => 300 + 0.03 * (x - 60);
  const s2 = (x) => 300 + 1.7 * 15 + 0.03 * (x - 60);
  const a = kelime("dağ", 60, s1, 15), b = kelime("gaga", a.son + 15, s1, 15);
  const c = kelime("kalk", 60, s2, 15), d = kelime("lale", c.son + 15, s2, 15);
  senaryo("F: sık satırlar, kuyruk ve sap iç içe", [[a, b], [c, d]], { aralik: 2.4 });
}

// G) Tek kelime: boyu değişmez (hedef = kendi gövdesi), yalnız eğimi düzelir; sol kenarı yerinde.
{
  const egik = (x) => 500 + 0.12 * (x - 100);
  const a = kelime("kalem", 100, egik, 16);
  const { sonra, strokes } = senaryo("G: tek eğik kelime", [[a]]);
  const once = Math.min(...strokes.flatMap((s) => s.points.map((p) => p[0])));
  const son = Math.min(...sonra.flatMap((s) => s.points.map((p) => p[0])));
  kontrol("tek kelimenin sol kenarı yerinde (±0.5)", Math.abs(once - son) <= 0.5, `${f(once, 1)} → ${f(son, 1)}`);
}

// H) A ve D, uygulamadaki gibi yumuşatılmış kalemle (önizlemede eğim burada abartılıyordu).
{
  YUMUSAT = 0.3;
  const egri = (x) => 300 + 22 * Math.sin((x - 100) / 140);
  const a = kelime("minik", 100, egri, 10);
  const b = kelime("değil", a.son + 14, egri, 16);
  const c = kelime("kalem", b.son + 22, egri, 24);
  senaryo("H: A'nın yumuşatılmış kalemle yazılmışı", [[a, b, c]]);
  const e2 = (x) => 420 + 15 * Math.sin((x - 60) / 110);
  const d = kelime("minik", 60, e2, 12, true);
  const e = kelime("tulum", d.son + 16, e2, 20, true);
  const g = kelime("değil", e.son + 13, e2, 14, true);
  senaryo("H': D'nin yumuşatılmış kalemle yazılmışı", [[d, e, g]]);
  YUMUSAT = 0;
}

// I) Harfleri ayrı ve özensiz yazılmış yazı (doğrulayıcının bulgusu): "elma"nın l'si ayrı satır,
//    "kalem" harflere bölünüyordu. Harf başına taban ±0.2 gövde, boy ±%12 oynuyor.
{
  AYRIK = { boy: 0.12, taban: 0.2, ara: 0.3 };
  const s1 = (x) => 200 + 0.03 * (x - 60), s2 = (x) => 200 + 3 * 14 + 0.02 * (x - 60);
  const a = kelime("elma", 60, s1, 12), b = kelime("kalem", a.son + 14, s1, 16), c = kelime("tutkal", b.son + 15, s1, 13);
  const d = kelime("dolu", 60, s2, 15), e = kelime("elma", d.son + 15, s2, 11);
  // Gerçek taban yayılımı: harf başına ±0.2 gövde oynama kelime içinde kalır (düzeltilemez) → 0.25 + 0.4.
  senaryo("I: ayrık ve özensiz harfler", [[a, b, c], [d, e]], { aralik: 3 }, { tabanTol: 0.65, boyTol: 25 });
  AYRIK = null;
}

// J) Şekiller: işaretli (sekil) şekil hiç dokunulmaz; işaretsiz eski şekil (kelimeyi çevreleyen dikdörtgen)
//    kelimeyi yarıya küçültmemeli.
{
  const s1 = () => 600;
  const a = kelime("kalem", 80, s1, 14), b = kelime("dolu", a.son + 14, s1, 20), c = kelime("minik", b.son + 16, s1, 12);
  const kare = (x0, y0, x1, y1, ek) => ({ id: "sk" + (++sayac), tool: "pen", width: 2, ...ek, points: [[x0, y0, 0.5], [x1, y0, 0.5], [x1, y1, 0.5], [x0, y1, 0.5], [x0, y0, 0.5]].flatMap((p, i, arr) => i ? Array.from({ length: 10 }, (_, j) => [arr[i - 1][0] + (p[0] - arr[i - 1][0]) * (j + 1) / 10, arr[i - 1][1] + (p[1] - arr[i - 1][1]) * (j + 1) / 10, 0.5]) : [p]) });
  const isaretli = kare(70, 570, 300, 610, { sekil: true });
  const onay = kare(40, 588, 52, 602, { sekil: true });
  const ok = { id: "ok", tool: "pen", width: 2, sekil: true, points: [[320, 595, 0.5], [360, 595, 0.5], [352, 590, 0.5], [360, 595, 0.5], [352, 600, 0.5]] };
  const strokes = [...a.strokes, ...b.strokes, ...c.strokes, isaretli, onay, ok];
  const cozum = D.yaziyiCozumle(strokes);
  const plan = D.yaziDonusumleri(cozum, {});
  console.log("\n— J: şekiller");
  kontrol("işaretli şekiller (dikdörtgen, onay kutusu, ok) hariç ve planda yok", [isaretli.id, onay.id, ok.id].every((id) => cozum.haric.includes(id) && !plan.has(id)));
  kontrol("işaretli şekiller varken 3 kelime bulunuyor", cozum.kelimeler.length === 3, String(cozum.kelimeler.length));
  // İşaretsiz eski dikdörtgen "kalem"in çevresinde.
  const eski = kare(70, 560, 160, 615, {});
  const strokes2 = [...a.strokes, ...b.strokes, ...c.strokes, eski];
  const c2 = D.yaziyiCozumle(strokes2);
  const p2 = D.yaziDonusumleri(c2, {});
  const da = p2.get(a.ids[0]);
  kontrol("işaretsiz çevreleyen dikdörtgen kelimeyi küçültmüyor, kelimeyle taşınıyor", da && Math.abs(da.s - 1) < 0.1 && p2.get(eski.id) === da, `kelime gövdesi ${f(c2.kelimeler.find((k) => k.ids.includes(a.ids[0])).govde, 1)} (gerçek 14), s = ${da ? f(da.s, 2) : "-"}`);
  const kutu2 = kare(30, 588, 42, 602, {});
  // Şekil aracının oku gibi: köşeler arası 3 birimde bir nokta (ink.js densify).
  const okKose = [[320, 595], [360, 595], [352, 590], [360, 595], [352, 600]];
  const okE = { id: "okE", tool: "pen", width: 2, points: [[320, 595, 0.5], ...okKose.slice(1).flatMap((q, i) => { const p0 = okKose[i]; const n = Math.max(1, Math.ceil(Math.hypot(q[0] - p0[0], q[1] - p0[1]) / 3)); return Array.from({ length: n }, (_, j) => [p0[0] + (q[0] - p0[0]) * (j + 1) / n, p0[1] + (q[1] - p0[1]) * (j + 1) / n, 0.5]); })] };
  const c3 = D.yaziyiCozumle([...a.strokes, ...b.strokes, ...c.strokes, kutu2, okE]);
  kontrol("işaretsiz eski onay kutusu ve ok yazı sayılmıyor (yerinde)", c3.haric.includes(kutu2.id) && c3.haric.includes("okE") && c3.kelimeler.length === 3, `kelime ${c3.kelimeler.length}`);
}

// K) Sayfaya sığdırma: alt satırlar seçilip boy en üste çekilince hiçbir nokta sayfa dışına çıkmamalı.
{
  const sayfa = { w: 595, h: 842 };
  const s1 = (x) => 760 + 0.02 * (x - 60), s2 = (x) => 800;
  const a = kelime("kalem", 60, s1, 14), b = kelime("dolu", a.son + 14, s1, 18), c = kelime("minik", b.son + 16, s1, 12);
  const d = kelime("tutkal", 60, s2, 15), e = kelime("elma", d.son + 15, s2, 13);
  const strokes = [a, b, c, d, e].flatMap((k) => k.strokes);
  const cozum = D.yaziyiCozumle(strokes);
  console.log("\n— K: sayfaya sığdırma");
  for (const [ad, ayar] of [["boy %250, düz", { boy: cozum.varsayilan.boy * 2.5 }], ["boy %250, çizgili", { boy: cozum.varsayilan.boy * 2.5, cizgi: { aralik: 32, ofset: -0.5 } }], ["varsayılan", {}]]) {
    const yoksa = D.yaziDonusumleri(cozum, ayar);
    const disari = (plan) => strokes.filter((s) => D.noktalariDonustur(s.points, plan.get(s.id)).some((p) => p[0] < 0 || p[0] > sayfa.w || p[1] < 0 || p[1] > sayfa.h)).length;
    const plan = D.yaziDonusumleri(cozum, { ...ayar, sayfa });
    kontrol(`${ad}: sayfa dışında çizgi yok`, disari(plan) === 0, `sığdırmadan ${disari(yoksa)}/${strokes.length} → ${disari(plan)}/${strokes.length}, boy ${f(ayar.boy || cozum.varsayilan.boy, 1)} → ${f(plan.boy, 1)}`);
  }
  const p0 = D.yaziDonusumleri(cozum, { sayfa, siddet: 0 });
  kontrol("sığdırma açıkken şiddet 0 yine hiçbir şeyi değiştirmiyor", strokes.every((s) => JSON.stringify(D.noktalariDonustur(s.points, p0.get(s.id))) === JSON.stringify(s.points)));
}

// L) Satırdaki bilinçli büyük boşluk (iki sütun / sağa yaslı tarih) korunuyor.
{
  const s1 = () => 700, s2 = () => 745;
  const a = kelime("kalem", 60, s1, 14), b = kelime("dolu", a.son + 14, s1, 16), c = kelime("elma", 420, s1, 12);
  const d = kelime("tutkal", 60, s2, 15), e = kelime("minik", d.son + 13, s2, 13);
  const strokes = [a, b, c, d, e].flatMap((k) => k.strokes);
  const cozum = D.yaziyiCozumle(strokes);
  const plan = D.yaziDonusumleri(cozum, {});
  const sonra = (k) => Math.min(...k.strokes.flatMap((s) => D.noktalariDonustur(s.points, plan.get(s.id)).map((p) => p[0])));
  console.log("\n— L: bilinçli büyük boşluk");
  kontrol("uzaktaki kelime yerinden başlıyor (±1)", Math.abs(sonra(c) - 420) <= 1, `sol kenar 420 → ${f(sonra(c), 1)}`);
  kontrol("yakın kelimeler yine eşit aralıkla diziliyor", sonra(b) < 200, `"dolu" sol kenarı ${f(sonra(b), 1)}`);
}

console.log(`\n${gecti}/${toplam} ${gecti === toplam ? "✓" : "✗"}`);
process.exit(gecti === toplam ? 0 : 1);
