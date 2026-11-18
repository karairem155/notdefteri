// Yazıyı düzenle: el yazısını TANIMADAN, kelime düzeyinde aynı boya, düz satıra ve eşit aralığa getirir.
// Harflerin şekli korunur: her kelime yalnız ölçeklenir ve taşınır. Kalınlık ve basınç değişmez.
// Saf geometri (DOM yok). test/duzenle-testi.mjs bu dosyayı doğrudan yükler.
//
// Akış: yaziyiCozumle(çizgiler) bir kez → kelimeler, satırlar, varsayılan ayarlar.
//       yaziDonusumleri(çözüm, ayar) her kaydırmada → çizgi kimliği başına { ax, ay, bx, by, s }.
//       noktalariDonustur(noktalar, dönüşüm) → yeni noktalar (p' = B + s·(p − A)).

export const YAZAN_UCLAR = new Set(["pen", "fineliner", "dolma", "firca", "pencil"]);

// Gövde ölçüsü: noktaların y değerlerinin %80 − %20 aralığı. Dik bir sapta bu, sapın 0.6'sı;
// 0.6'ya bölünce yaklaşık x-yüksekliği çıkar (ekranda gösterilen "yazı boyu" bu).
const GOVDE_BOLEN = 0.6;
// İki çizgi arasındaki boşluk, çevresindeki (±3) ana çizgilerin ortanca yüksekliğinin bu katından
// genişse yeni kelime başlar. Tek harfin yüzdelik gövdesine dayanınca "e" gibi harflerde gövde çok küçük
// çıkıyor (10 birimlik harfte 1.9), harf arası kelime boşluğu sanılıyordu. Harfler ayrı "kelime" olursa
// tek tek ölçeklenir (l ile a aynı boya iner): en kötü hata bu, o yüzden eşik cömert.
const KELIME_ESIGI = 0.4;
// Satırda bu kadar (ortanca kelime boşluğunun katı) büyük boşluk bilinçlidir (iki sütun, sağa yaslı tarih): korunur.
const BUYUK_BOSLUK = 4;
const KENAR_PAYI = 4;          // sayfa kenarına bu kadar yaklaşılır
const OLCEK_ALT = 0.5;
const OLCEK_UST = 2;

const sayisal = (a, b) => a - b;

function yuzdelik(sirali, q) {
  if (!sirali.length) return 0;
  const i = (sirali.length - 1) * q;
  const a = Math.floor(i);
  const b = Math.ceil(i);
  return sirali[a] + (sirali[b] - sirali[a]) * (i - a);
}

function ortanca(dizi) {
  return yuzdelik(dizi.slice().sort(sayisal), 0.5);
}

function kutuBul(points) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of points) {
    if (p[0] < x0) x0 = p[0];
    if (p[0] > x1) x1 = p[0];
    if (p[1] < y0) y0 = p[1];
    if (p[1] > y1) y1 = p[1];
  }
  return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
}

/** Yay uzunluğuna göre eşit aralıklı noktalar: kalem yavaşladığı yerde nokta yığılıyor, ölçü bozulmasın. */
export function yenidenOrnekle(points, adim) {
  if (points.length < 2 || !(adim > 0)) return points.map((p) => [p[0], p[1]]);
  const out = [[points[0][0], points[0][1]]];
  let kalan = adim;
  for (let i = 1; i < points.length; i++) {
    let ax = points[i - 1][0], ay = points[i - 1][1];
    const bx = points[i][0], by = points[i][1];
    let seg = Math.hypot(bx - ax, by - ay);
    while (seg >= kalan && seg > 0) {
      const t = kalan / seg;
      ax += (bx - ax) * t;
      ay += (by - ay) * t;
      out.push([ax, ay]);
      seg -= kalan;
      kalan = adim;
    }
    kalan -= seg;
  }
  const son = points[points.length - 1];
  out.push([son[0], son[1]]);
  return out;
}

function govdeBul(ys) {
  const s = ys.slice().sort(sayisal);
  return (yuzdelik(s, 0.8) - yuzdelik(s, 0.2)) / GOVDE_BOLEN;
}

/**
 * Çizginin alt dönüm noktaları (y aşağı doğru büyür: yerel en büyük y). Gürültü için histerezis:
 * en az `esik` kadar inip çıkmayan kıpırtı sayılmaz. Uçlar da dönüm noktası olabilir (sap yukarıdan
 * aşağı çizilip biterse).
 */
function altDonusler(ys, esik) {
  const out = [];             // dönüm noktalarının sırası (indeks)
  if (ys.length < 2) return out;
  let yon = 0;               // 0 bilinmiyor, +1 aşağı iniyor (en büyüğü izle), -1 yukarı çıkıyor
  let uc = 0;
  let enAlt = 0, enUst = 0;
  for (let i = 1; i < ys.length; i++) {
    const y = ys[i];
    if (yon === 0) {
      if (y > ys[enAlt]) enAlt = i;
      if (y < ys[enUst]) enUst = i;
      if (y <= ys[enAlt] - esik) { out.push(enAlt); yon = -1; uc = i; }
      else if (y >= ys[enUst] + esik) { yon = 1; uc = i; }
    } else if (yon === 1) {
      if (y > ys[uc]) uc = i;
      else if (y <= ys[uc] - esik) { out.push(uc); yon = -1; uc = i; }
    } else {
      if (y < ys[uc]) uc = i;
      else if (y >= ys[uc] + esik) { yon = 1; uc = i; }
    }
  }
  if (yon === 1) out.push(uc);
  return out;
}

/**
 * En kalabalık öbek (taban için alt dönüm noktaları). Alt uzantılı harflerde (g, y, p) iki öbek
 * çıkar (taban ve kuyruk ucu); eşitlikte üstteki (küçük y, taban) seçilir.
 */
function obekBul(degerler, tol) {
  let enIyi = null, enSayi = -1, uyeler = [];
  for (let i = 0; i < degerler.length; i++) {
    const d = degerler[i];
    const obek = [];
    for (let j = 0; j < degerler.length; j++) if (Math.abs(degerler[j] - d) <= tol) obek.push(j);
    const orta = ortanca(obek.map((j) => degerler[j]));
    if (obek.length > enSayi || (obek.length === enSayi && orta < enIyi)) { enSayi = obek.length; enIyi = orta; uyeler = obek; }
  }
  return { deger: enIyi, uyeler };
}

const EGIM_UST = Math.tan(10 * Math.PI / 180);   // kelime en çok bu kadar eğik sayılır (düzeltilir)

/**
 * Bir kelimenin (ya da herhangi bir çizgi kümesinin) gövde yüksekliği, taban çizgisi ve eğimi.
 * - Eğim: alt dönüm noktası çiftlerinin eğimlerinin ortancası (Theil–Sen); g/ğ kuyruğu azınlıkta
 *   kaldıkça etkilemez. Eğik satırda kelime içi eğim kalırsa satır testere dişi gibi görünüyor.
 * - Taban: eğimden arındırılmış alt dönüm noktalarının en kalabalık öbeği; kelimenin sol kenarında.
 * - Gövde = taban − x-yüksekliği; x-yüksekliği üst dönüm noktalarının en kalabalık öbeği (çoğu harfin
 *   tepesi orada; d, l, k gibi birkaçı yukarı uzanır, eşitlikte alttaki öbek). Yüzdelik ölçü
 *   (%80 − %20) uzantısı çok kelimede (değil, dağ) gövdeyi %20–30 büyük buluyordu; yalnız yedek.
 * Örnekleme adımı kelimenin kendi boyuna göre: ölçü ölçekten ve konumdan bağımsız kalsın.
 */
export function kelimeOlcusu(pointLists) {
  const kutu = kutuBul(pointLists.flat());
  const a = Math.max(0.05, Math.max(kutu.h, kutu.w / 4, 1) / 40);
  const ornekler = pointLists.map((pts) => yenidenOrnekle(pts, a));
  const kaba0 = Math.max(0.5, govdeBul(ornekler.flat().map((p) => p[1])));
  const dipler = [];
  const tepeler = [];
  for (const o of ornekler) {
    const oy = o.map((p) => p[1]);
    for (const i of altDonusler(oy, 0.15 * kaba0)) dipler.push(o[i]);
    for (const i of altDonusler(oy.map((y) => -y), 0.15 * kaba0)) tepeler.push(o[i]);
  }
  const olc = (m) => {
    const art = (p) => p[1] - m * (p[0] - kutu.cx);       // kelimenin ortasındaki karşılığı
    const ys = ornekler.flat().map(art);
    const kaba = Math.max(0.5, govdeBul(ys));
    const tol = 0.15 * kaba;
    const ob = dipler.length ? obekBul(dipler.map(art), tol) : null;
    const taban = ob ? ob.deger : yuzdelik(ys.slice().sort(sayisal), 0.85);
    let govde = kaba;
    let ustOb = null;
    if (tepeler.length) {
      ustOb = obekBul(tepeler.map((p) => -art(p)), tol);               // -y: eşitlikte alttaki öbek
      const g = taban + ustOb.deger;
      if (g > 0.35 * kaba && g < 1.6 * kaba) govde = g;
    }
    return { govde: Math.max(0.5, govde), taban, ob, ustOb };
  };
  // Eğim (Theil–Sen): aynı kümedeki nokta çiftlerinin eğimlerinin ortancası. İki adım:
  // 1) bütün alt + üst dönüm noktaları (kaba eğim, öbekleri bulmak için),
  // 2) yalnız taban öbeği ve x-yüksekliği öbeği (l/k tepesi, g kuyruğu dışarıda). Kısa kelimede
  //    tepe-uzantı çiftleri eğimi ters çeviriyordu ("ile": gerçek −4.5°, bulunan +3°).
  // Kalem yumuşatması m/n dönüşlerini yuvarlayıp dipleri yukarıda bırakıyor: yalnız diplerle eğim abartılıyordu.
  const theilSen = (kumeler) => {
    const egimler = [];
    for (const kume of kumeler) for (let i = 0; i < kume.length; i++) for (let j = i + 1; j < kume.length; j++) {
      const dx = kume[j][0] - kume[i][0];
      if (Math.abs(dx) >= 0.5 * kaba0) egimler.push((kume[j][1] - kume[i][1]) / dx);
    }
    return egimler.length >= 3 ? Math.max(-EGIM_UST, Math.min(EGIM_UST, ortanca(egimler))) : 0;
  };
  let m = 0;
  let sonuc = olc(0);
  if (dipler.length >= 3) {
    const m0 = theilSen([dipler, tepeler]);
    const ilk = olc(m0);
    const tabanUye = ilk.ob ? ilk.ob.uyeler.map((j) => dipler[j]) : [];
    const ustUye = ilk.ustOb ? ilk.ustOb.uyeler.map((j) => tepeler[j]) : [];
    const xs = tabanUye.map((p) => p[0]);
    // Eğime güvenmek için taban öbeğinde en az üç nokta, gövdenin 1.5 katı genişlikte olmalı.
    // Kısa kelimede eğimin etkisi zaten küçük (uçtan uca birkaç birim), tahmini ise gürültülü.
    if (tabanUye.length >= 3 && Math.max(...xs) - Math.min(...xs) >= 1.5 * ilk.govde) {
      m = theilSen([tabanUye, ustUye]);
      sonuc = olc(m);
    }
  }
  // taban: kelimenin yatay ortasında (xm). Sol kenarda ölçülünce eğim hatası kelime boyunca birikiyordu.
  return { govde: sonuc.govde, taban: sonuc.taban, egim: m, xm: kutu.cx, x0: kutu.x0, x1: kutu.x1 };
}

/** Ramer–Douglas–Peucker ile kalan köşe sayısı (yalnız sayı; nokta üretmez). */
function koseSayisi(points, eps) {
  const n = points.length;
  if (n < 3) return n;
  const tut = new Uint8Array(n);
  tut[0] = tut[n - 1] = 1;
  const yigin = [[0, n - 1]];
  while (yigin.length) {
    const [a, b] = yigin.pop();
    const [ax, ay] = points[a], [bx, by] = points[b];
    const L = Math.hypot(bx - ax, by - ay);
    let en = -1, enD = eps;
    for (let i = a + 1; i < b; i++) {
      // Kapalı çizgide (baş = son) doğru tanımsız: noktaya uzaklık kullanılır.
      const d = L < 1e-6 ? Math.hypot(points[i][0] - ax, points[i][1] - ay) : Math.abs((bx - ax) * (ay - points[i][1]) - (ax - points[i][0]) * (by - ay)) / L;
      if (d > enD) { enD = d; en = i; }
    }
    if (en > 0) { tut[en] = 1; yigin.push([a, en], [en, b]); }
  }
  let say = 0;
  for (const t of tut) say += t;
  return say;
}

/**
 * Eski kayıtlardaki işaretsiz şekil (şekil aracı / basılı-tut düzeltmesi): çok sayıda nokta ama
 * birkaç kusursuz düz parçadan oluşuyor ve basınç hep aynı. El yazısı kayıtta zaten sadeleştirildiği
 * için (ink.js simplify, ≥0.12) kalan her noktası gerekli; 0.05 toleransla da köşe sayısı düşmez.
 */
function makineCizgisi(points) {
  if (points.length < 8) return false;
  const b = points[0][2];
  if (!points.every((p) => p[2] === b)) return false;
  return koseSayisi(points, 0.05) <= 6;
}

/**
 * Seçimi çözümler: hangi çizgi yazı, hangi satırda, hangi kelimede. Çizgilere dokunmaz.
 * @param {Array<{id, tool, points}>} strokes
 */
export function yaziyiCozumle(strokes) {
  const haric = [];
  const adaylar = [];
  for (const s of strokes) {
    // Şekil aracı ve basılı-tut şekil düzeltmesi "pen" olarak kaydediliyor; işaretleri (sekil) var.
    if (!YAZAN_UCLAR.has(s.tool) || s.sekil || !s.points || !s.points.length) { haric.push(s.id); continue; }
    adaylar.push({ id: s.id, points: s.points, ...kutuBul(s.points) });
  }
  const bos = { kelimeler: [], satirlar: [], haric, H0: 0, satirArasi: 0, varsayilan: { boy: 0, aralik: 2.4, bosluk: 0.8 } };
  if (!adaylar.length) return bos;

  // Ölçek: noktalar/şapkalar dışındaki çizgilerin ortanca yüksekliği.
  const boyutlar = adaylar.map((a) => Math.max(a.w, a.h)).sort(sayisal);
  const ust = yuzdelik(boyutlar, 0.9);
  const H0 = Math.max(2, ortanca(adaylar.filter((a) => Math.max(a.w, a.h) >= 0.35 * ust).map((a) => a.h)) || ust || 2);

  // Yazı olmayanlar (çok büyük çizim, uzun yatay alt çizgi) yerinde kalır. Küçükler (i noktası, ğ şapkası,
  // t'nin çizgisi, virgül) en yakın harfe bağlanır: ölçüye karışmaz, harfiyle birlikte taşınır.
  let ana = [];
  const kucuk = [];
  for (const a of adaylar) {
    if (a.h > 4.5 * H0 || (a.h < 0.3 * H0 && a.w > 3 * H0)) { haric.push(a.id); continue; }
    if (Math.max(a.w, a.h) <= 0.3 * H0 || (a.h <= 0.35 * H0 && a.w <= 0.8 * H0)) kucuk.push(a);
    else ana.push(a);
  }
  if (!ana.length) { ana = kucuk.splice(0); }
  const bagli = new Map();
  // Çerçeve: kelimeyi çevreleyen dikdörtgen/daire (en az iki harfi içine alan, onlardan belirgin büyük
  // çizgi). Ölçüye karışırsa kelimeyi küçültüyordu; ek olarak içindeki kelimeyle birlikte taşınır.
  const pay = 0.1 * H0;
  for (const a of ana.slice()) {
    if (a.h < 1.2 * H0 || a.w < H0) continue;      // küçük çizgi iki harfi içine alamaz (hız için)
    const icinde = ana.filter((b) => b !== a && b.x0 >= a.x0 - pay && b.x1 <= a.x1 + pay && b.y0 >= a.y0 - pay && b.y1 <= a.y1 + pay);
    if (icinde.length >= 2 && a.h > 1.5 * ortanca(icinde.map((b) => b.h))) {
      ana.splice(ana.indexOf(a), 1);
      bagli.set(a, icinde[0]);
    }
  }
  // Çevrelemeyen işaretsiz eski şekil (onay kutusu, ok, düz çizgi): yerinde kalır.
  ana = ana.filter((a) => { if (makineCizgisi(a.points)) { haric.push(a.id); return false; } return true; });
  for (let i = kucuk.length - 1; i >= 0; i--) if (makineCizgisi(kucuk[i].points)) { haric.push(kucuk[i].id); kucuk.splice(i, 1); }
  for (const k of kucuk) {
    let en = null, enSkor = Infinity;
    for (const m of ana) {
      const dx = Math.max(0, m.x0 - k.x1, k.x0 - m.x1);
      let dy = 0;
      // Nokta/şapka harfin üstünde durur: alttaki harfe yakınlık daha ağır basar (üst satırın kuyruğuna değil).
      if (m.y0 >= k.cy) dy = Math.max(0, m.y0 - k.y1) * 0.5;
      else if (m.y1 <= k.cy) dy = Math.max(0, k.y0 - m.y1) * 2;
      const skor = dx + dy;
      if (skor < enSkor) { enSkor = skor; en = m; }
    }
    if (en && enSkor <= H0) bagli.set(k, en);
    else haric.push(k.id);   // yazıdan uzakta tek başına küçük işaret: dokunma
  }

  // Satırlar: soldan sağa gidip her çizgiyi, dikeyde en çok örtüştüğü satıra koy. Satırın "bandı"
  // son beş çizgisinin üst/alt kenarlarının ortancası; son çizgilere bakıldığı için eğri/eğik satır
  // tek satır kalır. Örtüşme, çizgiyle bandın KISA olanına oranlanır: uzun sapı olan l, k, d (ve g
  // kuyruğu) bandı tamamen kaplar ama kendi boyuna oranla az örtüşür; eskiden ayrı satır sayılıyordu.
  ana.sort((p, q) => p.x0 - q.x0);
  let satirlar = [];
  for (const a of ana) {
    let en = null, enOrt = 0, enFark = Infinity;
    for (const s of satirlar) {
      const { b0, b1, orta } = s;
      const ort = Math.max(0, Math.min(a.y1, b1) - Math.max(a.y0, b0)) / Math.max(Math.min(a.h, b1 - b0), 1e-6);
      const fark = Math.abs(a.cy - orta);
      if (ort > enOrt + 1e-9 || (Math.abs(ort - enOrt) <= 1e-9 && fark < enFark)) { en = s; enOrt = ort; enFark = fark; }
    }
    const s = en && (enOrt >= 0.4 || enFark <= 0.6 * H0) ? en : null;
    if (s) { s.cizgiler.push(a); s.cys.push(a.cy); s.y0s.push(a.y0); s.y1s.push(a.y1); }
    else satirlar.push({ cizgiler: [a], cys: [a.cy], y0s: [a.y0], y1s: [a.y1] });
    // Bant yalnız değişen satır için yeniden hesaplanır (her karşılaştırmada sıralamak yavaştı).
    const t = s || satirlar[satirlar.length - 1];
    t.b0 = ortanca(t.y0s.slice(-5)); t.b1 = ortanca(t.y1s.slice(-5)); t.orta = ortanca(t.cys.slice(-5));
  }
  satirlar.forEach((s) => { s.orta = ortanca(s.cys); });
  satirlar.sort((p, q) => p.orta - q.orta);

  // Kelimeler: satır içinde soldan sağa; boşluk, çevredeki ana çizgilerin ortanca yüksekliğinin
  // KELIME_ESIGI katını aşınca yeni kelime.
  const kelimeler = [];
  const kelimesi = new Map();
  const sonucSatirlar = [];
  for (const s of satirlar) {
    const c = s.cizgiler;   // x0'a göre sıralı
    const gruplar = [[c[0]]];
    let sag = c[0].x1;
    for (let i = 1; i < c.length; i++) {
      const yerel = ortanca(c.slice(Math.max(0, i - 3), i + 3).map((a) => a.h));
      if (c[i].x0 - sag > KELIME_ESIGI * yerel) gruplar.push([c[i]]);
      else gruplar[gruplar.length - 1].push(c[i]);
      sag = Math.max(sag, c[i].x1);
    }
    const satirKelimeleri = gruplar.map((g) => {
      const kel = { ana: g, ekler: [] };
      for (const a of g) kelimesi.set(a, kel);
      kelimeler.push(kel);
      return kel;
    });
    sonucSatirlar.push({ kelimeler: satirKelimeleri });
  }
  for (const [k, m] of bagli) { const kel = kelimesi.get(m); if (kel) kel.ekler.push(k); else haric.push(k.id); }

  for (const kel of kelimeler) {
    const olcu = kelimeOlcusu(kel.ana.map((a) => a.points));
    const tum = kel.ana.concat(kel.ekler);
    kel.govde = olcu.govde;
    kel.x0 = Math.min(...tum.map((a) => a.x0));
    kel.x1 = Math.max(...tum.map((a) => a.x1));
    kel.ids = tum.map((a) => a.id);
    // Dayanak: kelimenin ortasında taban. Eğim, dayanak çevresinde döndürülerek sıfırlanır.
    kel.ax = olcu.xm;
    kel.taban = olcu.taban;
    const aci = -Math.atan(olcu.egim);
    kel.cos = Math.cos(aci);
    kel.sin = Math.sin(aci);
    let r0 = Infinity, r1 = -Infinity, q0 = Infinity, q1 = -Infinity;
    for (const a of tum) for (const p of a.points) {
      const dx = p[0] - kel.ax, dy = p[1] - kel.taban;
      const rx = kel.cos * dx - kel.sin * dy;
      const ry = kel.sin * dx + kel.cos * dy;
      if (rx < r0) r0 = rx;
      if (rx > r1) r1 = rx;
      if (ry < q0) q0 = ry;
      if (ry > q1) q1 = ry;
    }
    kel.rx0 = r0;
    kel.rx1 = r1;
    kel.ry0 = q0;
    kel.ry1 = q1;
  }
  for (const s of sonucSatirlar) {
    s.kelimeler.sort((p, q) => p.x0 - q.x0);
    s.taban = ortanca(s.kelimeler.map((k) => k.taban));
  }

  // Varsayılanlar: mevcut yazının ortancası (ilk açılışta yazı aşağı yukarı yerinde kalsın).
  const boy = ortanca(kelimeler.map((k) => k.govde));
  const aralar = [];
  for (let i = 1; i < sonucSatirlar.length; i++) aralar.push(sonucSatirlar[i].taban - sonucSatirlar[i - 1].taban);
  const satirArasi = aralar.length ? ortanca(aralar) : 0;
  const hamBosluk = [];
  for (const s of sonucSatirlar) for (let i = 1; i < s.kelimeler.length; i++) hamBosluk.push(s.kelimeler[i].x0 - s.kelimeler[i - 1].x1);
  const ortaBosluk = hamBosluk.length >= 2 ? ortanca(hamBosluk) : 0;
  const bosluklar = [];
  for (const s of sonucSatirlar) for (let i = 1; i < s.kelimeler.length; i++) {
    const a = s.kelimeler[i - 1], b = s.kelimeler[i];
    const ara = b.x0 - a.x1;
    // Bilinçli büyük boşluk (sütun, sağa yaslı tarih): kelime orijinal yerinden başlar.
    if (ortaBosluk > 0 && ara > BUYUK_BOSLUK * ortaBosluk) { b.ayri = true; continue; }
    bosluklar.push(ara / ((a.govde + b.govde) / 2));
  }
  // Ortanca gövdenin yarısından küçük ya da iki katından büyük "kelime" büyük olasılıkla yazı değil
  // (eski kayıtlardaki işaretsiz şekil: kelimeyi çevreleyen dikdörtgen, onay kutusu, ok): ölçeklenmez,
  // döndürülmez, yalnız satırla birlikte taşınır.
  for (const k of kelimeler) { const r = boy / k.govde; k.uyumsuz = !(r >= OLCEK_ALT && r <= OLCEK_UST); }
  const kenar = (v, a, b) => Math.min(b, Math.max(a, v));
  const disari = (k) => ({ ids: k.ids, govde: k.govde, taban: k.taban, ax: k.ax, x0: k.x0, x1: k.x1, cos: k.cos, sin: k.sin,
    rx0: k.rx0, rx1: k.rx1, ry0: k.ry0, ry1: k.ry1, ayri: !!k.ayri, uyumsuz: k.uyumsuz });
  return {
    kelimeler: kelimeler.map(disari),
    satirlar: sonucSatirlar.map((s) => ({ taban: s.taban, kelimeler: s.kelimeler.map(disari) })),
    haric,
    H0,
    satirArasi,
    varsayilan: {
      boy,
      aralik: satirArasi > 0 && boy > 0 ? kenar(satirArasi / boy, 1.2, 8) : 2.4,
      bosluk: bosluklar.length ? kenar(ortanca(bosluklar), 0.4, 1.5) : 0.8
    }
  };
}

/**
 * Hedef dönüşümler. ayar: { boy, aralik (gövdenin katı), bosluk (gövdenin katı), siddet 0..1,
 * cizgi: { aralik, ofset } | null (sayfa çizgileri y = ofset + aralik·n), sayfa: { w, h } | null }.
 * Şiddet k: ölçek, açı ve öteleme orijinalle hedef arasında doğrusal karışım; k = 0 hiçbir şeyi değiştirmez.
 * Sayfa verilirse sonuç sayfaya sığdırılır: önce blok yukarı/aşağı kaydırılır (çizgili sayfada çizgi
 * aralığının katı kadar), yetmezse yazı boyu küçültülür. Kullanılan boy sonuc.boy'da.
 */
export function yaziDonusumleri(cozum, ayar = {}) {
  const v = cozum.varsayilan;
  let T = ayar.boy > 0 ? ayar.boy : v.boy;
  const aralik = ayar.aralik > 0 ? ayar.aralik : v.aralik;
  const bosluk = ayar.bosluk != null ? ayar.bosluk : v.bosluk;
  const k = Math.min(1, Math.max(0, ayar.siddet == null ? 1 : ayar.siddet));
  const cizgi = ayar.cizgi && ayar.cizgi.aralik > 0 ? ayar.cizgi : null;
  const sayfa = ayar.sayfa && ayar.sayfa.w > 0 && ayar.sayfa.h > 0 ? ayar.sayfa : null;
  const yaslan = (y) => cizgi.ofset + cizgi.aralik * Math.round((y - cizgi.ofset) / cizgi.aralik);

  const kur = (T, dy) => {
    const out = [];
    let oncekiHedef = null, oncekiTaban = null;
    for (const satir of cozum.satirlar) {
      let hedef;
      if (oncekiHedef == null) hedef = satir.taban + dy;
      else {
        // Boş satır bırakılmışsa (paragraf) o boşluk korunur: aradaki satır sayısı kadar aralık.
        const n = cozum.satirArasi > 0 ? Math.max(1, Math.round((satir.taban - oncekiTaban) / cozum.satirArasi)) : 1;
        hedef = oncekiHedef + n * aralik * T;
      }
      if (cizgi) {
        hedef = yaslan(hedef);
        while (oncekiHedef != null && hedef < oncekiHedef + cizgi.aralik * 0.5) hedef += cizgi.aralik;
      }
      let x = null;
      for (const kel of satir.kelimeler) {
        const s = kel.uyumsuz ? 1 : Math.min(OLCEK_UST, Math.max(OLCEK_ALT, T / kel.govde));
        const aci = kel.uyumsuz ? 0 : Math.atan2(kel.sin, kel.cos);
        // Döndürülmeyen kelimenin kapsamı orijinal kutusu.
        const rx0 = kel.uyumsuz ? kel.x0 - kel.ax : kel.rx0;
        const rx1 = kel.uyumsuz ? kel.x1 - kel.ax : kel.rx1;
        // Satırın ilk kelimesinin sol kenarı yerinde kalır; sonrakiler eşit boşlukla dizilir.
        const sol = x == null ? kel.x0 : (kel.ayri ? Math.max(x, kel.x0) : x);
        const bx = sol - s * rx0;
        out.push({ kel, s, aci, bx, by: hedef, x0: sol, x1: bx + s * rx1, y0: hedef + s * kel.ry0, y1: hedef + s * kel.ry1 });
        x = bx + s * rx1 + bosluk * T;
      }
      oncekiHedef = hedef;
      oncekiTaban = satir.taban;
    }
    return out;
  };

  let dy = 0;
  let hedefler = kur(T, dy);
  if (sayfa && hedefler.length) {
    const m = KENAR_PAYI;
    const kat = (d) => (cizgi ? Math.ceil(d / cizgi.aralik - 1e-9) * cizgi.aralik : d);
    for (let deneme = 0; deneme < 12; deneme++) {
      const x0 = Math.min(...hedefler.map((h) => h.x0)), x1 = Math.max(...hedefler.map((h) => h.x1));
      const y0 = Math.min(...hedefler.map((h) => h.y0)), y1 = Math.max(...hedefler.map((h) => h.y1));
      if (x1 > sayfa.w - m && x1 - x0 > 1) {
        // Sağdan taşıyor: satırlar sol kenarlarından başladığı için genişlik boyla orantılı küçülür.
        T *= Math.max(0.5, Math.min(0.99, (sayfa.w - m - x0) / (x1 - x0)));
      } else if (y1 > sayfa.h - m) {
        const kay = kat(y1 - (sayfa.h - m));
        if (y0 - kay >= m) dy -= kay;
        else T *= Math.max(0.5, Math.min(0.99, (sayfa.h - 2 * m) / (y1 - y0)));
      } else if (y0 < m) {
        const kay = kat(m - y0);
        if (y1 + kay <= sayfa.h - m) dy += kay;
        else T *= Math.max(0.5, Math.min(0.99, (sayfa.h - 2 * m) / (y1 - y0)));
      } else break;
      hedefler = kur(T, dy);
    }
  }

  const sonuc = new Map();
  for (const h of hedefler) {
    const kel = h.kel;
    const aci = h.aci * k;
    const d = {
      ax: kel.ax, ay: kel.taban,
      bx: kel.ax + (h.bx - kel.ax) * k,
      by: kel.taban + (h.by - kel.taban) * k,
      s: 1 + (h.s - 1) * k,
      c: k === 0 || aci === 0 ? 1 : Math.cos(aci),
      sn: k === 0 || aci === 0 ? 0 : Math.sin(aci)
    };
    for (const id of kel.ids) sonuc.set(id, d);
  }
  sonuc.boy = T;
  return sonuc;
}

/** p' = B + s·R·(p − A) (R: kelimenin eğimini sıfırlayan döndürme). Basınç (3. değer) olduğu gibi kalır. */
export function noktalariDonustur(points, d) {
  const c = d && d.c != null ? d.c : 1;
  const sn = d && d.sn != null ? d.sn : 0;
  if (!d || (d.s === 1 && sn === 0 && d.bx === d.ax && d.by === d.ay)) return points.map((p) => p.slice());
  return points.map((p) => {
    const dx = p[0] - d.ax, dy = p[1] - d.ay;
    const q = p.slice();
    q[0] = Math.round((d.bx + d.s * (c * dx - sn * dy)) * 100) / 100;
    q[1] = Math.round((d.by + d.s * (sn * dx + c * dy)) * 100) / 100;
    return q;
  });
}
