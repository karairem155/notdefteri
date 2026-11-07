// Anında çeviri: seçilen ya da fosforluyla çizilen metin, yanında açılan küçük bir kartta çevriliyor.
//
// Web sürümünde cihazda çeviri motoru yok; metin MyMemory'ye gidiyor (günde ~5000
// karakter ücretsiz), olmazsa Google Çeviri'nin herkese açık ucu deneniyor. App Store sürümünde bunun yerine
// Apple'ın cihazda çalışan Translation çerçevesi kullanılacak (ücretsiz, çevrimdışı).
// Kaynak dil hedef dille aynıysa (Türkçe PDF'te Türkçe çeviri) kart sessiz kalıyor.

import { h, svgIcon, toast } from "./ui.js";

export const DILLER = [["tr", "Türkçe"], ["en", "İngilizce"], ["de", "Almanca"], ["fr", "Fransızca"], ["es", "İspanyolca"], ["it", "İtalyanca"], ["ar", "Arapça"], ["ru", "Rusça"], ["ja", "Japonca"], ["ko", "Korece"], ["zh-CN", "Çince"]];
const DIL_ADI = Object.fromEntries(DILLER);

export function hedefDil() {
  try { return localStorage.getItem("notdefteri.translateTo") || "tr"; } catch (_) { return "tr"; }
}

function hedefYaz(dil) {
  try { localStorage.setItem("notdefteri.translateTo", dil); } catch (_) { /* özel kip */ }
}

const onbellek = new Map();

async function google(metin, hedef) {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(hedef)}&dt=t&q=${encodeURIComponent(metin)}`;
  const yanit = await fetch(url);
  if (!yanit.ok) throw new Error("google " + yanit.status);
  const veri = await yanit.json();
  const ceviri = (veri[0] || []).map((parca) => parca[0] || "").join("");
  if (!ceviri) throw new Error("google boş");
  return { metin: ceviri, kaynak: veri[2] || null };
}

/** MyMemory tek istekte en çok ~500 karakter alıyor; uzun metin cümle cümle bölünüyor. */
function parcala(metin, sinir = 450) {
  if (metin.length <= sinir) return [metin];
  const cumleler = metin.match(/[^.!?;]+[.!?;]*\s*/g) || [metin];
  const parcalar = [];
  let simdiki = "";
  for (const c of cumleler) {
    if ((simdiki + c).length > sinir && simdiki) { parcalar.push(simdiki); simdiki = ""; }
    simdiki += c.length > sinir ? c.slice(0, sinir) : c;
  }
  if (simdiki) parcalar.push(simdiki);
  return parcalar.slice(0, 6);
}

async function mymemoryParca(metin, hedef) {
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(metin)}&langpair=autodetect|${encodeURIComponent(hedef)}`;
  const yanit = await fetch(url);
  if (!yanit.ok) throw new Error("mymemory " + yanit.status);
  const veri = await yanit.json();
  // Kaynak ve hedef aynı dil: MyMemory çevirmeyi reddediyor, metin zaten hedef dilde.
  if (String(veri.responseStatus) === "403" && /DISTINCT/i.test(veri.responseDetails || "")) return { metin, kaynak: hedef };
  if (veri.quotaFinished) throw new Error("mymemory kota");
  const ceviri = veri && veri.responseData && veri.responseData.translatedText;
  if (!ceviri || String(veri.responseStatus) !== "200") throw new Error("mymemory " + veri.responseStatus);
  return { metin: ceviri, kaynak: (veri.responseData.detectedLanguage || "").split("-")[0] || null };
}

async function mymemory(metin, hedef) {
  const sonuclar = [];
  for (const p of parcala(metin)) sonuclar.push(await mymemoryParca(p.trim(), hedef));
  return { metin: sonuclar.map((s) => s.metin).join(" "), kaynak: sonuclar[0].kaynak };
}

/** Metni çevirir: { metin, kaynak } (kaynak: algılanan dil kodu). */
export async function cevir(metin, hedef = hedefDil()) {
  const temiz = temizle(metin).slice(0, 2700);
  const anahtar = hedef + "|" + temiz;
  if (onbellek.has(anahtar)) return onbellek.get(anahtar);
  // MyMemory önce: herkese açık, CORS izinli ve dili algılıyor. Google'ın ücretsiz ucu
  // kısa sürede "çok fazla istek" (429) verebiliyor; yedek olarak duruyor.
  let sonuc;
  try { sonuc = await mymemory(temiz, hedef); } catch (_) { sonuc = await google(temiz, hedef); }
  onbellek.set(anahtar, sonuc);
  return sonuc;
}

/** PDF'ten gelen satır sonu tirelerini ve fazla boşlukları toplar. */
function temizle(metin) {
  return (metin || "").replace(/-\s*\n\s*/g, "").replace(/\s+/g, " ").trim();
}

export function googleCeviriAc(metin, hedef = hedefDil()) {
  const temiz = temizle(metin);
  if (!temiz) return;
  window.open(`https://translate.google.com/?sl=auto&tl=${encodeURIComponent(hedef)}&op=translate&text=${encodeURIComponent(temiz.slice(0, 4000))}`, "_blank", "noopener");
}

// ---------- kart ----------

let kart = null;
let istekNo = 0;

export function ceviriKartiKapat() {
  istekNo++;
  if (kart) { kart.remove(); kart = null; }
}

/**
 * Metni çevirip kartı `kutu` (ekran dikdörtgeni) yakınında gösterir.
 * sessizAyniDil: kaynak dil hedefle aynıysa kartı hiç açma (fosforluyla çizerken).
 */
export async function ceviriGoster(metin, kutu, { sessizAyniDil = false } = {}) {
  const temiz = temizle(metin);
  if (!temiz) return;
  const no = ++istekNo;
  const hedef = hedefDil();
  const ceviriAlani = h("div", { class: "ceviri-metin yukleniyor" }, "Çevriliyor…");
  const dilSec = h("select", { class: "ceviri-dil", "aria-label": "Hedef dil",
    onChange: (e) => { hedefYaz(e.target.value); ceviriGoster(temiz, kutu); } },
    ...DILLER.map(([kod, ad]) => h("option", { value: kod }, ad)));
  dilSec.value = hedef;
  const ust = h("span", { class: "ceviri-ust" }, "Çeviri");
  const yeni = h("div", { class: "ceviri-kart", role: "dialog", "aria-label": "Çeviri" },
    h("div", { class: "ceviri-bas" }, ust, dilSec,
      h("button", { class: "ceviri-kapat", type: "button", "aria-label": "Kapat", onTap: ceviriKartiKapat }, svgIcon("close", 16))),
    ceviriAlani,
    h("div", { class: "ceviri-kaynak" }, temiz),
    h("div", { class: "ceviri-dugmeler" },
      h("button", { class: "ceviri-dugme", type: "button", onTap: () => {
        const t = ceviriAlani.dataset.hazir ? ceviriAlani.textContent : "";
        if (!t) return;
        navigator.clipboard.writeText(t).then(() => toast("Çeviri kopyalandı")).catch(() => toast("Kopyalanamadı"));
      } }, "Kopyala"),
      h("button", { class: "ceviri-dugme", type: "button", onTap: () => googleCeviriAc(temiz, dilSec.value) }, "Google Çeviri'de aç")));

  let sonuc = null, hata = null;
  if (sessizAyniDil) {
    // Önce çeviriyi bekle: aynı dildeyse hiçbir şey gösterme.
    try { sonuc = await cevir(temiz, hedef); } catch (e) { hata = e; }
    if (no !== istekNo) return;
    if (hata || (sonuc && sonuc.kaynak && sonuc.kaynak.split("-")[0] === hedef.split("-")[0])) return;
  }
  if (kart) kart.remove();
  kart = yeni;
  document.body.append(yeni);
  yerlestir(yeni, kutu);

  if (!sonuc && !hata) {
    try { sonuc = await cevir(temiz, hedef); } catch (e) { hata = e; }
  }
  if (no !== istekNo || kart !== yeni) return;
  ceviriAlani.classList.remove("yukleniyor");
  if (hata) {
    ceviriAlani.classList.add("hata");
    ceviriAlani.textContent = "Çeviri alınamadı. İnternet bağlantını kontrol et ya da Google Çeviri'de aç.";
  } else {
    ceviriAlani.textContent = sonuc.metin;
    ceviriAlani.dataset.hazir = "1";
    if (sonuc.kaynak && DIL_ADI[sonuc.kaynak]) ust.textContent = `${DIL_ADI[sonuc.kaynak]} →`;
  }
  yerlestir(yeni, kutu);
}

function yerlestir(el, kutu) {
  const en = Math.min(380, innerWidth - 24);
  el.style.width = en + "px";
  const yuk = el.offsetHeight;
  let x = (kutu ? kutu.left + kutu.width / 2 : innerWidth / 2) - en / 2;
  x = Math.max(12, Math.min(innerWidth - en - 12, x));
  let y = kutu ? kutu.bottom + 12 : innerHeight - yuk - 120;
  if (y + yuk > innerHeight - 90 && kutu) y = kutu.top - yuk - 12;
  y = Math.max(12, Math.min(innerHeight - yuk - 12, y));
  el.style.left = x + "px";
  el.style.top = y + "px";
}
