// Geri al / ileri al geçmişinin testi (web/js/ink.js InkCanvas + editörün sayfa başına yığını).
// Çalıştır (repo kökünden):  node test/geri-al-testi.mjs
// Hata (19 Kas, iPad): editör sahneyi her yeniden kurduğunda (sayfa çevirme, yazı kutusu, nesne
// düzenleme) InkCanvas yeniden yaratılıyor, yığın tuvalin içinde durduğu için geçmiş sıfırlanıyordu.
// Şimdi yığın dışarıdan veriliyor (options.gecmis); yeni tuval aynı geçmişle devam etmeli. Hepsi ✓ olmalı.

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const kok = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
let src = fs.readFileSync(path.join(kok, "web", "js", "ink.js"), "utf8");
// Tarayıcıya bağlı içe aktarmalar (store IndexedDB açıyor) yerine küçük taklitler.
let sayac = 0;
globalThis.__inkStub = {
  uid: () => "id" + (++sayac),
  store: {},
  yaziyiCozumle: () => ({ kelimeler: [] }),
  yaziDonusumleri: () => new Map(),
  noktalariDonustur: (p) => p,
  kalemSuzgeci: null
};
src = src.replace(/^import .*$/gm, "");
src = "const { uid, store, yaziyiCozumle, yaziDonusumleri, noktalariDonustur, kalemSuzgeci } = globalThis.__inkStub;\n" + src;
globalThis.window = { devicePixelRatio: 1 };
globalThis.Path2D = class { moveTo() {} lineTo() {} quadraticCurveTo() {} bezierCurveTo() {} arc() {} closePath() {} rect() {} };
const { InkCanvas } = await import("data:text/javascript;base64," + Buffer.from(src).toString("base64"));

// Hiçbir şey yapmayan 2B bağlam ve tuval.
const ctx = new Proxy({}, { get: (t, k) => (k in t ? t[k] : () => ({ addColorStop() {} })), set: (t, k, v) => { t[k] = v; return true; } });
const tuval = () => ({ style: {}, width: 0, height: 0, getContext: () => ctx, addEventListener() {}, getBoundingClientRect: () => ({ width: 600, height: 800 }) });

let hata = 0;
const kontrol = (ad, kosul, ek = "") => { console.log((kosul ? "✓ " : "✗ ") + ad + (ek ? "   " + ek : "")); if (!kosul) hata++; };

const sayfa = { size: { w: 600, h: 800 }, strokes: [] };
const cizgi = (y) => ({ id: "c" + y, tool: "pen", color: "#000", width: 2, points: [[100, y, 0.5], [200, y, 0.5], [300, y + 2, 0.5]] });
/** Kalemin bitiş yolu: canlı çizgi finishLive ile sayfaya eklenir (pushHistory + commit). */
const ciz = (ink, y) => { ink.live = cizgi(y); ink.finishLive(); };

// 1) Sayfa başına yığın: tuval yeniden yaratılınca (renderStage) geçmiş kalmalı.
const gecmis = { undo: [], redo: [] };
let ink = new InkCanvas(tuval(), sayfa, { gecmis });
for (let i = 1; i <= 6; i++) ciz(ink, i * 50);
kontrol("6 çizgi çizildi", sayfa.strokes.length === 6 && ink.undoStack.length === 6, `çizgi ${sayfa.strokes.length}, yığın ${ink.undoStack.length}`);

ink = new InkCanvas(tuval(), sayfa, { gecmis });   // sayfa çevirip dönme / yazı kutusu ekleme
kontrol("yeni tuvalde geri al etkin", ink.canUndo, `yığın ${ink.undoStack.length}`);
const adimlar = [];
while (ink.canUndo) { ink.undo(); adimlar.push(sayfa.strokes.length); }
kontrol("arka arkaya geri al hepsini geri alıyor", adimlar.join(",") === "5,4,3,2,1,0", adimlar.join(","));
kontrol("sonda geri al pasif, ileri al etkin", !ink.canUndo && ink.canRedo);

ink = new InkCanvas(tuval(), sayfa, { gecmis });   // arada yine sahne kuruldu
const ileri = [];
while (ink.canRedo) { ink.redo(); ileri.push(sayfa.strokes.length); }
kontrol("ileri al hepsini geri getiriyor", ileri.join(",") === "1,2,3,4,5,6", ileri.join(","));
kontrol("çizgiler aynı sırada", sayfa.strokes.map((s) => s.id).join(",") === "c50,c100,c150,c200,c250,c300");

// 2) Karışık: silgi oturumu ve kement silme de aynı yığına girer, sırayla geri alınır.
ink.eraseSession = { removed: false, snapshot: ink.snapshot() };
ink.undoStack.push(ink.eraseSession.snapshot); ink.redoStack = [];
sayfa.strokes = sayfa.strokes.filter((s) => s.id !== "c300");
ink.selection = { ids: new Set(["c50"]) };
ink.deleteSelection();
kontrol("silgi + kement silme sonrası 4 çizgi", sayfa.strokes.length === 4);
ink = new InkCanvas(tuval(), sayfa, { gecmis });
ink.undo();
kontrol("geri al: kement silmesi geri geldi", sayfa.strokes.some((s) => s.id === "c50") && sayfa.strokes.length === 5);
ink.undo();
kontrol("geri al: silinen çizgi geri geldi", sayfa.strokes.length === 6);

// 3) Yeni çizgi ileri al yığınını temizler (yeni tuvalde de).
ink.undo();
ink = new InkCanvas(tuval(), sayfa, { gecmis });
ciz(ink, 700);
kontrol("yeni çizgiden sonra ileri al yok", !ink.canRedo);

// 4) Sınır: 60 adım.
const g2 = { undo: [], redo: [] };
const s2 = { size: { w: 600, h: 800 }, strokes: [] };
const ink2 = new InkCanvas(tuval(), s2, { gecmis: g2 });
for (let i = 0; i < 75; i++) ciz(ink2, 10 + i);
kontrol("geçmiş 60 adımla sınırlı", g2.undo.length === 60, String(g2.undo.length));

// 5) Eski davranış (gecmis verilmezse): her tuvalin kendi yığını; yeniden yaratılınca boş.
const s3 = { size: { w: 600, h: 800 }, strokes: [] };
const a = new InkCanvas(tuval(), s3, {});
ciz(a, 100);
const b = new InkCanvas(tuval(), s3, {});
kontrol("gecmis verilmezse yeni tuval boş geçmişle başlar", a.canUndo && !b.canUndo);

console.log(hata ? `\n${hata} hata` : "\nHepsi ✓");
process.exit(hata ? 1 : 0);
