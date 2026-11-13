// Karalayarak silme algılayıcısının yanlış pozitif / yanlış negatif testi.
// Çalıştır (repo kökünden):  node test/karalama-testi.mjs
// Beklenen: KARALAMA satırları "SİLER", diğerleri "—". Biri tersine dönerse algılayıcı bozulmuş demektir.

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const kok = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const src = fs.readFileSync(path.join(kok, "web", "js", "ink.js"), "utf8");
const pick = (name) => {
  const i = src.indexOf("function " + name + "(");
  if (i < 0) throw new Error(name + " bulunamadı");
  let d = 0;
  const j = src.indexOf("{", i);
  for (let k = j; k < src.length; k++) {
    if (src[k] === "{") d++;
    else if (src[k] === "}") { d--; if (!d) return src.slice(i, k + 1); }
  }
};
const { karalamaMi } = new Function(pick("karalamaMi") + "\n" + pick("kutuBul") + "\nreturn { karalamaMi };")();

const yogun = (a, n = 8) => { const o = []; for (let i = 1; i < a.length; i++) for (let j = 0; j < n; j++) { const t = j / n; o.push([a[i - 1][0] + (a[i][0] - a[i - 1][0]) * t, a[i - 1][1] + (a[i][1] - a[i - 1][1]) * t]); } return o; };
const zig = (n, en, boy) => { const a = []; for (let i = 0; i <= n; i++) a.push([100 + (i % 2 ? en : 0), 100 + (i * boy) / n]); return yogun(a); };
const yaz = (f, uz, n) => { const a = []; for (let i = 0; i <= n; i++) { const t = i / n; a.push([100 + t * uz, 200 - f(t)]); } return a; };

const durumlar = [
  ["KARALAMA 3 gidip gelme (seyrek)", zig(6, 160, 30), true],
  ["KARALAMA 4 gidip gelme", zig(8, 160, 30), true],
  ["KARALAMA yoğun", zig(30, 160, 30), true],
  ["KARALAMA dikey", zig(8, 160, 30).map((p) => [p[1], p[0]]), true],
  ["yazı mmm", yaz((t) => Math.abs(Math.sin(t * Math.PI * 5)) * 25, 200, 150), false],
  ["yazı www", yaz((t) => Math.abs(Math.cos(t * Math.PI * 4)) * 20, 70, 100), false],
  ["yazı lll (döngülü)", (() => { const a = []; for (let i = 0; i <= 200; i++) { const t = i / 200, b = t * Math.PI * 10; a.push([100 + t * 150 + Math.sin(b) * 6, 200 - Math.abs(Math.sin(b / 2)) * 40]); } return a; })(), false],
  ["yazı eee", (() => { const a = []; for (let i = 0; i <= 200; i++) { const t = i / 200, b = t * Math.PI * 10; a.push([100 + t * 120 + Math.cos(b) * 8, 200 + Math.sin(b) * 8]); } return a; })(), false],
  ["daire", (() => { const a = []; for (let i = 0; i <= 80; i++) { const g = (i / 80) * Math.PI * 2; a.push([100 + Math.cos(g) * 40, 100 + Math.sin(g) * 40]); } return a; })(), false],
  ["spiral", (() => { const a = []; for (let i = 0; i <= 200; i++) { const g = (i / 200) * Math.PI * 8; a.push([100 + Math.cos(g) * (10 + i / 5), 100 + Math.sin(g) * (10 + i / 5)]); } return a; })(), false],
  ["altını çiz-geri (2 kez)", zig(2, 200, 4), false],
  ["yıldız", (() => { const a = []; for (let i = 0; i <= 5; i++) { const g = (i * 4 * Math.PI) / 5 - Math.PI / 2; a.push([100 + Math.cos(g) * 50, 100 + Math.sin(g) * 50]); } return yogun(a); })(), false]
];

let hata = 0;
for (const [ad, noktalar, beklenen] of durumlar) {
  const sonuc = karalamaMi(noktalar.map((p) => [p[0], p[1], 0.5]), 3);
  const dogru = sonuc === beklenen;
  if (!dogru) hata++;
  console.log(`${dogru ? "✓" : "✗"} ${sonuc ? "SİLER" : "—    "} ${ad}`);
}
console.log(hata ? `\n${hata} durum beklenenden farklı` : "\nHepsi beklendiği gibi");
process.exit(hata ? 1 : 0);
