// Defter içinde arama: yazı kutuları, yapılacaklar, PDF metni, sekmeler ve PDF içindekiler.
//
// Türkçe harf farkı yok sayılıyor: "ogrenci" yazınca "öğrenci" de bulunuyor.
// PDF metni ilk aramada sayfa sayfa okunuyor (300 sayfada birkaç saniye) ve
// önbelleğe alınıyor; okunan sayfaların sonuçları hemen listeye düşüyor.

import { h, svgIcon, openModal, closeModal } from "./ui.js";
import { pdfSayfaMetniAl, pdfIcindekiler } from "./paper.js";

const KATLA = { ç: "c", ğ: "g", ı: "i", i̇: "i", ö: "o", ş: "s", ü: "u", â: "a", î: "i", û: "u" };

/** Aramaya uygun biçim: küçük harf, Türkçe harfler sadeleşmiş. Uzunluk korunuyor. */
export function katla(metin) {
  return (metin || "").toLocaleLowerCase("tr").replace(/[çğıöşüâîû]/g, (c) => KATLA[c] || c);
}

/** Sayfadaki yazılı nesnelerin metni (yazı kutusu, yapılacaklar, post-it). */
function nesneMetni(page) {
  return (page.objects || []).map((o) => [o.text, o.title, ...(Array.isArray(o.items) ? o.items.map((i) => i.text || i) : [])]
    .filter((x) => typeof x === "string" && x.trim()).join("\n")).filter(Boolean).join("\n");
}

function parcaGoster(metin, katli, igne) {
  const i = katli.indexOf(igne);
  const bas = Math.max(0, i - 42);
  const son = Math.min(metin.length, i + igne.length + 60);
  const on = (bas > 0 ? "…" : "") + metin.slice(bas, i).replace(/\s+/g, " ");
  const arka = metin.slice(i + igne.length, son).replace(/\s+/g, " ") + (son < metin.length ? "…" : "");
  return h("span", { class: "ara-parca" }, on, h("mark", {}, metin.slice(i, i + igne.length)), arka);
}

/**
 * @param {object} o - { notebook, sekmeTurleri, mevcutSayfa, onJump(pageId) }
 */
export function openNotebookSearch({ notebook, sekmeTurleri, mevcutSayfa, onJump }) {
  const sayfalar = notebook.pages;
  const giris = h("input", { type: "search", class: "ara-giris", placeholder: "Bu defterde ara: yazı, PDF metni, sekme", "aria-label": "Defterde ara", enterkeyhint: "search" });
  const liste = h("div", { class: "ara-liste" });
  const durum = h("div", { class: "ara-durum" });
  let iptal = { yapildi: false };

  const git = (pageId) => { iptal.yapildi = true; closeModal(); onJump(pageId); };
  const satir = (pageId, ust, alt, renk) => {
    const no = sayfalar.findIndex((p) => p.id === pageId) + 1;
    return h("button", { class: "ara-satir" + (pageId === mevcutSayfa ? " mevcut" : ""), type: "button", onTap: () => git(pageId) },
      renk ? h("span", { class: "ara-sekme", style: { "--renk": renk } }) : h("span", { class: "ara-no" }, String(no)),
      h("span", { class: "ara-metin" }, ust, alt ? h("span", { class: "ara-alt" }, alt) : null));
  };
  const bolum = (baslik, ...cocuklar) => h("div", { class: "ara-bolum" }, h("div", { class: "ara-baslik" }, baslik), ...cocuklar);

  // ---------- boş arama: sekmeler + içindekiler ----------
  async function gezinme() {
    const parcalar = [];
    const sekmeli = sayfalar.filter((p) => p.sekme);
    if (sekmeli.length) {
      parcalar.push(bolum("Sekmeler", ...sekmeli.map((p) => {
        const t = sekmeTurleri[(p.sekme.tur | 0)] || sekmeTurleri[0];
        return satir(p.id, t.ad, `${sayfalar.indexOf(p) + 1}. sayfa`, t.renk);
      })));
    }
    liste.replaceChildren(...parcalar);
    // PDF içindekiler (birden çok PDF varsa her biri ayrı)
    const pdfler = [...new Set(sayfalar.filter((p) => p.pdf).map((p) => p.pdf.asset))];
    for (const asset of pdfler) {
      const ogeler = await pdfIcindekiler(asset).catch(() => []);
      if (giris.value.trim() || !ogeler.length) continue;
      const satirlar = ogeler.map((o) => {
        const sayfa = sayfalar.find((p) => p.pdf && p.pdf.asset === asset && p.pdf.index === o.index);
        if (!sayfa) return null;
        const s = satir(sayfa.id, o.baslik, null);
        s.style.paddingLeft = 12 + o.derinlik * 18 + "px";
        return s;
      }).filter(Boolean);
      if (satirlar.length) liste.append(bolum("İçindekiler", ...satirlar));
    }
    if (!liste.children.length) {
      liste.replaceChildren(h("div", { class: "ara-bos" }, "Yazı kutularında, yapılacaklarda ve PDF metninde arayabilirsin. Sayfaya sekme takınca burada da listelenir."));
    }
    durum.textContent = "";
  }

  // ---------- arama ----------
  async function ara(sorgu) {
    iptal.yapildi = true;
    const benim = (iptal = { yapildi: false });
    const igne = katla(sorgu.trim());
    if (igne.length < 2) { gezinme(); return; }
    const sonuclar = h("div");
    liste.replaceChildren(sonuclar);
    let bulunan = 0;
    const ekle = (page, metin, kaynak) => {
      const katli = katla(metin);
      if (!katli.includes(igne)) return;
      bulunan++;
      sonuclar.append(satir(page.id, parcaGoster(metin, katli, igne), kaynak));
    };
    // 1) Sekme adları ve yazılı nesneler: anında
    for (const p of sayfalar) {
      if (p.sekme) { const t = sekmeTurleri[(p.sekme.tur | 0)]; if (t) ekle(p, t.ad, "Sekme"); }
      const nm = nesneMetni(p);
      if (nm) ekle(p, nm, "Yazı");
    }
    // 2) PDF metni: sayfa sayfa, arada ekranı bırakarak
    const pdfSayfalar = sayfalar.filter((p) => p.pdf);
    for (let i = 0; i < pdfSayfalar.length; i++) {
      if (benim.yapildi) return;
      if (i % 8 === 0) durum.textContent = `PDF taranıyor… ${i}/${pdfSayfalar.length}`;
      const metin = await pdfSayfaMetniAl(pdfSayfalar[i].pdf).catch(() => "");
      if (benim.yapildi) return;
      if (metin) ekle(pdfSayfalar[i], metin, "PDF");
    }
    if (benim.yapildi) return;
    durum.textContent = bulunan ? `${bulunan} sayfada bulundu` : "";
    if (!bulunan) sonuclar.append(h("div", { class: "ara-bos" }, `"${sorgu.trim()}" bulunamadı. El yazısı henüz aranamıyor; App Store sürümünde gelecek.`));
  }

  let zamanlayici = 0;
  giris.addEventListener("input", () => { clearTimeout(zamanlayici); zamanlayici = setTimeout(() => ara(giris.value), 250); });
  giris.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { const ilk = liste.querySelector(".ara-satir"); if (ilk) ilk.click(); }
  });

  openModal(h("div", { class: "dialog ara-pencere" },
    h("div", { class: "ara-ust" }, svgIcon("search", 20), giris,
      h("button", { class: "ara-kapat", type: "button", "aria-label": "Kapat", onTap: () => { iptal.yapildi = true; closeModal(); } }, svgIcon("close", 18))),
    durum, liste), { onClose: () => { iptal.yapildi = true; } });
  gezinme();
  setTimeout(() => giris.focus(), 60);
}
