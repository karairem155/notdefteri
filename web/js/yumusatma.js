// Kalem yumuşatma (Stabilizatör): hıza uyarlanan alçak geçiren süzgeç.
//
// Neden: v107'deki sabit zaman sabitli üstel süzgeç (τ = 14 / 26 / 55 ms) yazı hızında küçük
// kıvrımları içeriden kesiyordu. Birinci derece süzgeç dairesel harekette yarıçapı
// 1/√(1+(ωτ)²) oranında küçültür: 5 birimlik bir "o" 150 ms'de çizilince İpek %68'e,
// Akıcı %40'a iniyordu ("harflerimi küçültüyor").
//
// Şimdi: One Euro (Casiez 2012) fikri, kesim frekansı hızla artar:
//   fc = max(minC, gamma · v · kapı(v; v0..v1))
// Yavaşken / dururken (v < v0) fc = minC, yani eski seviyenin τ'su: titreme alma aynı kalır.
// Yazı hızında fc hızla orantılı büyür. Neden orantılı: yarıçapı r olan kıvrımı v hızıyla
// çizmek ω = v/r açısal hız demek; boyu %97 korumak için 2π·fc ≥ ~4ω gerekir, yani fc ∝ v.
// Klasik One Euro'nun "minC + beta·v" doğrusu ölü bölge (v0) ile birleşince yüksek hızda
// gereğinden çok açılıyor, yazıdaki titremeyi hiç almıyordu; gamma·v ise boyu koruyan en
// düşük kesimde kalır. Gecikme 600 birim/s'de 14 birimden ~0.05 birime iner.
//
// Hız (v) ham noktaların farkından değil, hafif ön-süzgeçten geçmiş (τ = ON_TAU) konumun
// HIZ_PENCERESI ms'lik yer değiştirmesinden ölçülür. Ham farkla 240 Hz'de ±2 birimlik sensör
// gürültüsü yüzlerce birim/s sahte hız üretip süzgeci duran kalemde bile açıyordu. v0 altı
// "kıpırtı" sayılır, v0..v1 arasında süzgeç yavaş yavaş açılır. Hız x ve y için ortaktır (2B büyüklük): eksen başına hız dairenin x
// uçlarında sıfıra düşer, süzgeç tam harfin kenarında kapanıp yine küçültürdü.
//
// Her şey ev.timeStamp'e bağlı: Apple Pencil ~240 Hz, bilgisayar ~100 Hz aynı davranır.
// gamma = 0 verilirse eski üstel süzgecin birebir aynısıdır.

const ON_TAU = 15;          // hız ölçümü için ön-süzgeç (ms)
const HIZ_PENCERESI = 40;   // hız bu kadar ms'lik yer değiştirmeden ölçülür

const fc = (tau) => 1000 / (2 * Math.PI * tau);   // τ (ms) → kesim frekansı (Hz)

// 0 Temel, 1 Yumuşak, 2 İpek, 3 Akıcı. minC eski τ'nun karşılığı (yavaşken his aynı).
// gamma: yazı hızında harf boyu (ölçüm: test/yumusatma-testi.mjs) — en küçük "e" için
// 0.30 ≈ %98, 0.26 ≈ %97.5, 0.22 ≈ %96.5. Küçüldükçe hızlı yazıda daha çok titreme alınır, harf biraz daha küçülür.
export const YUMUSATMA = [
  null,
  { minC: fc(14), gamma: 0.30, v0: 55, v1: 80 },
  { minC: fc(26), gamma: 0, v0: 55, v1: 80 },      // İpek: kullanıcı "iyi" dedi, v107'deki hâli birebir (gamma 0)
  { minC: fc(55), gamma: 0.22, v0: 55, v1: 80 }
];

export class KalemSuzgeci {
  constructor(ayar, x, y, t, olcek = 1) {
    this.ayar = ayar;
    this.olcek = Math.max(0.2, Number(olcek) || 1);
    this.x = x;
    this.y = y;
    this.on = [x, y];
    this.son = t;
    this.gecmis = [[x, y, t]];
  }

  /** Ham noktayı ekler, süzülmüş konumu döndürür. t: olay zamanı (ms). */
  ekle(x, y, t) {
    const dt = Math.min(50, Math.max(1, t - this.son));
    this.son = t;
    const { minC, gamma, v0, v1 } = this.ayar;
    let kesim = minC;
    if (gamma) {
      const ao = 1 - Math.exp(-dt / ON_TAU);
      this.on[0] += (x - this.on[0]) * ao;
      this.on[1] += (y - this.on[1]) * ao;
      const g = this.gecmis;
      g.push([this.on[0], this.on[1], t]);
      while (g.length > 2 && t - g[1][2] >= HIZ_PENCERESI) g.shift();
      // Çizginin ilk anlarında pencere dolmamışsa yarım pencereye bölünür: hız abartılmaz.
      // Hız ekran biriminde (sayfa birimi × ekran ölçeği): yakınlaştırınca ya da yatayda aynı el
      // yazısı sayfada küçük ve yavaş kalır; sayfa biriminde ölçülse süzgeç kapanıp yine küçültürdü.
      const v = this.olcek * Math.hypot(this.on[0] - g[0][0], this.on[1] - g[0][1]) / Math.max(HIZ_PENCERESI / 2, t - g[0][2]) * 1000;
      const kapi = Math.min(1, Math.max(0, (v - v0) / (v1 - v0)));
      kesim = Math.max(minC, gamma * v * kapi);
    }
    const oran = 1 - Math.exp(-2 * Math.PI * kesim * dt / 1000);
    this.x += (x - this.x) * oran;
    this.y += (y - this.y) * oran;
    return [this.x, this.y];
  }

  /** Kalem kalkınca süzülmüş uçtan gerçek uca yetişen ara noktalar (son nokta tam uç). */
  ucaYetis(x, y) {
    return [0.5, 1].map((k) => [this.x + (x - this.x) * k, this.y + (y - this.y) * k]);
  }
}

/** Seviye için süzgeç; Temel (0) ya da geçersiz seviyede null (süzgeç yok). */
export function kalemSuzgeci(seviye, x, y, t, olcek = 1) {
  const ayar = YUMUSATMA[Math.min(3, Math.max(0, Math.round(Number(seviye) || 0)))];
  return ayar ? new KalemSuzgeci(ayar, x, y, t, olcek) : null;
}
