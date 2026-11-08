// Sürüm geçmişi: defterin geri dönülebilir kopyaları, cihazda.
//
// Defter kaydedilirken son kopyanın üstünden 20 dakika geçmişse yeni bir kopya
// alınıyor; defter başına en yeni 20 kopya saklanıyor. Kopyalar iki depoda:
// "surumler" yalnız özet ve kullandığı dosyaların listesi (hızlı okunur),
// "surumVeri" defterin tam JSON'u. Fotoğraf ve PDF'ler kopyalanmıyor; kopyanın
// kullandığı dosyalar temizlikte silinmesin diye listeleniyor.

import { db } from "./db.js";

const ARALIK = 20 * 60 * 1000;
const SINIR = 20;
const sonKopya = new Map();   // notebookId -> zaman (bellekte; ilk sorguda depodan doluyor)
let yuklendi = null;

function kimlik() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/** Defterin kullandığı dosyalar (kapak, arka kapak, şablon, PDF, fotoğraf, ses). */
export function varliklariTopla(notebook) {
  const set = new Set();
  if (notebook.cover && notebook.cover.imageAsset) set.add(notebook.cover.imageAsset);
  if (notebook.backCover && notebook.backCover.imageAsset) set.add(notebook.backCover.imageAsset);
  for (const page of notebook.pages || []) {
    if (page.templateAsset) set.add(page.templateAsset);
    if (page.pdf) set.add(page.pdf.asset);
    for (const o of page.objects || []) if (o.asset) set.add(o.asset);
  }
  return [...set];
}

function bosMu(notebook) {
  return !(notebook.pages || []).some((p) => (p.strokes && p.strokes.length) || (p.objects && p.objects.length) || p.pdf);
}

async function ozetler() {
  try { return await db.getAll("surumler"); } catch (_) { return []; }
}

async function hazirla() {
  if (!yuklendi) {
    yuklendi = ozetler().then((liste) => {
      for (const s of liste) if ((sonKopya.get(s.notebookId) || 0) < s.zaman) sonKopya.set(s.notebookId, s.zaman);
    });
  }
  return yuklendi;
}

/** Kopya al (zorla = aralığa bakmadan). Boş defterin kopyası alınmıyor. */
export async function surumAl(notebook, { zorla = false, neden = "otomatik" } = {}) {
  if (!notebook || bosMu(notebook)) return false;
  await hazirla();
  const simdi = Date.now();
  if (!zorla && simdi - (sonKopya.get(notebook.id) || 0) < ARALIK) return false;
  sonKopya.set(notebook.id, simdi);
  const id = kimlik();
  const sayfa = notebook.pages.length;
  try {
    await db.put("surumVeri", { id, veri: JSON.stringify(notebook) });
    await db.put("surumler", { id, notebookId: notebook.id, zaman: simdi, baslik: notebook.title, sayfa, varliklar: varliklariTopla(notebook), neden });
    // Eskileri buda
    const benim = (await ozetler()).filter((s) => s.notebookId === notebook.id).sort((a, b) => b.zaman - a.zaman);
    for (const eski of benim.slice(SINIR)) { await db.delete("surumler", eski.id); await db.delete("surumVeri", eski.id); }
    return true;
  } catch (e) {
    console.warn("Sürüm kaydedilemedi", e);
    return false;
  }
}

/** Defterin kopyaları, yeniden eskiye. */
export async function surumler(notebookId) {
  return (await ozetler()).filter((s) => s.notebookId === notebookId).sort((a, b) => b.zaman - a.zaman);
}

export async function surumVerisi(id) {
  const satir = await db.get("surumVeri", id);
  return satir ? JSON.parse(satir.veri) : null;
}

/** Bütün kopyaların kullandığı dosyalar: bunlar temizlikte silinmemeli. */
export async function surumVarliklari() {
  const set = new Set();
  for (const s of await ozetler()) for (const a of s.varliklar || []) set.add(a);
  return set;
}

/** Defter kalıcı silinince kopyaları da gitsin. */
export async function surumleriSil(notebookId) {
  for (const s of await surumler(notebookId)) { await db.delete("surumler", s.id); await db.delete("surumVeri", s.id); }
  sonKopya.delete(notebookId);
}
