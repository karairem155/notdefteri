// Sayfalar ekranı (12-Sayfalar.png): bütün sayfalar ızgarada, sürükle-sırala,
// uzun bas: renk / boyut / şablon / çoğalt / sil, dokununca o sayfaya git.
import { renderPageCanvas, spillFor } from "./pagerender.js";
import { store } from "./store.js";
import { h, svgIcon, iconButton, pressable, actionSheet, confirmDialog, openModal, closeModal } from "./ui.js";
import { openAddPageSheet, openTemplatePicker, openPageSizeSheet } from "./addpage.js";
import { navigate } from "./app.js";

export function renderPages(root, notebookId) {
  const notebook = store.notebook(notebookId);
  const params = new URLSearchParams(location.hash.split("?")[1] || "");
  let selectedId = params.get("p") || (notebook.pages[0] && notebook.pages[0].id);

  const screen = h("div", { class: "screen screen-light" });
  const body = h("div", { class: "pages-body" });
  const topbar = h("div", { class: "topbar" },
    h("div", { class: "topbar-side" }, h("button", { class: "back-btn", type: "button", onTap: () => navigate(`#/n/${notebookId}/p/${selectedId}`) }, svgIcon("back", 20), notebook.title)),
    h("div", { class: "topbar-title" }, "Sayfalar"),
    h("div", { class: "topbar-side right" },
      h("button", { class: "btn small", type: "button", style: { color: "var(--accent)", background: "var(--accent-soft)" },
        onTap: () => openAddPageSheet(notebookId, indexOf(selectedId), (id) => { selectedId = id; render(); }) }, "+ Sayfa Ekle"))
  );
  screen.append(topbar, body);
  root.append(screen);

  function indexOf(id) {
    return Math.max(0, store.notebook(notebookId).pages.findIndex((p) => p.id === id));
  }

  // ---------- sürükleyip sıralama ----------
  //
  // Basılı tutunca sayfa kalkıyor ve parmağı izliyor, öbür sayfalar yol açıyor;
  // numaralar da bırakınca alacakları değeri gösteriyor. Kıpırdatmadan bırakırsan
  // menü açılıyor; basar basmaz kaydırırsan ızgara kayıyor, sürükleme başlamıyor.

  let surukleme = null;
  const KALKMA_MS = 380;
  const KENAR_PAYI = 80;       // ekranın üst/alt kenarına bu kadar yaklaşınca ızgara kayıyor
  const KAYMA_HIZI = 14;
  const onizlemeler = new Map();   // sayfa id -> son önizleme: sıralayınca kareler boş yanıp sönmesin

  // iOS, parmak kıpırdayınca sayfayı kaydırmaya karar veriyor ve dokunuşu
  // iptal ediyor; sürüklerken bunu ancak touchmove'u durdurarak önleyebiliyoruz.
  const kaydirmayiDurdur = (e) => { if (surukleme) e.preventDefault(); };
  document.addEventListener("touchmove", kaydirmayiDurdur, { passive: false });

  function kaldir(el, bas) {
    const hucreler = [...body.querySelectorAll(".page-cell")];
    const kutu = el.getBoundingClientRect();
    // Yuvalar içerik koordinatında: ızgara kayınca da geçerli.
    const yuvalar = hucreler.map((c) => {
      const r = c.getBoundingClientRect();
      return { x: r.left, y: r.top + body.scrollTop, w: r.width, h: r.height };
    });
    const hayalet = el.cloneNode(true);
    hayalet.classList.add("sayfa-hayalet");
    Object.assign(hayalet.style, { width: kutu.width + "px", left: kutu.left + "px", top: kutu.top + "px" });
    document.body.append(hayalet);
    el.parentElement.classList.add("siralaniyor");
    el.classList.add("dragging");
    try { el.setPointerCapture(bas.id); } catch (_) { /* yakalanamazsa da devam */ }
    const kaynak = hucreler.indexOf(el);
    surukleme = { id: bas.id, hucreler, yuvalar, hayalet, kaynak, hedef: kaynak,
      dx: bas.x - kutu.left, dy: bas.y - kutu.top, x0: bas.x, y0: bas.y, x: bas.x, y: bas.y, kipirdadi: false,
      kayma: setInterval(kenardaKaydir, 16) };
    if (navigator.vibrate) navigator.vibrate(8);
  }

  function tasi(x, y) {
    const s = surukleme;
    if (!s) return;
    if (!s.kipirdadi && Math.hypot(x - s.x0, y - s.y0) > 12) s.kipirdadi = true;
    s.x = x;
    s.y = y;
    s.hayalet.style.left = (x - s.dx) + "px";
    s.hayalet.style.top = (y - s.dy) + "px";
    hedefiGuncelle();
  }

  /** Parmağa en yakın yuva hedef; aradaki sayfalar birer yuva kayarak yer açıyor. */
  function hedefiGuncelle() {
    const s = surukleme;
    const py = s.y + body.scrollTop;
    let hedef = s.hedef;
    let enYakin = Infinity;
    s.yuvalar.forEach((y, i) => {
      const uzaklik = Math.hypot(s.x - (y.x + y.w / 2), py - (y.y + y.h / 2));
      if (uzaklik < enYakin) { enYakin = uzaklik; hedef = i; }
    });
    if (hedef === s.hedef) return;
    s.hedef = hedef;
    s.hucreler.forEach((c, i) => {
      let j = i;
      if (i === s.kaynak) j = hedef;
      else if (s.kaynak < hedef && i > s.kaynak && i <= hedef) j = i - 1;
      else if (hedef < s.kaynak && i >= hedef && i < s.kaynak) j = i + 1;
      c.style.transform = j === i ? "" : `translate(${s.yuvalar[j].x - s.yuvalar[i].x}px, ${s.yuvalar[j].y - s.yuvalar[i].y}px)`;
      c.querySelector(".num").textContent = String(j + 1);
    });
    s.hayalet.querySelector(".num").textContent = String(hedef + 1);
  }

  /** Uzak bir sayfaya taşırken: parmak kenara gelince ızgara kayıyor. */
  function kenardaKaydir() {
    const s = surukleme;
    if (!s) return;
    const r = body.getBoundingClientRect();
    let hiz = 0;
    if (s.y < r.top + KENAR_PAYI) hiz = -Math.min(1, (r.top + KENAR_PAYI - s.y) / KENAR_PAYI) * KAYMA_HIZI;
    else if (s.y > r.bottom - KENAR_PAYI) hiz = Math.min(1, (s.y - (r.bottom - KENAR_PAYI)) / KENAR_PAYI) * KAYMA_HIZI;
    if (!hiz) return;
    const once = body.scrollTop;
    body.scrollTop += hiz;
    if (body.scrollTop !== once) hedefiGuncelle();
  }

  /** Sürüklemeyi bitirir; taşınacak bir şey varsa önce onu yapar. */
  function surukleBitir(page, iptal) {
    const s = surukleme;
    surukleme = null;
    clearInterval(s.kayma);
    s.hayalet.remove();
    if (!iptal && s.kipirdadi && s.hedef !== s.kaynak) store.movePage(notebookId, page.id, s.hedef);
    // Menü basılan kareye bağlanıyor: kare yeniden çizilmeden önce açılmalı.
    if (!iptal && !s.kipirdadi) pageMenu(page);
    render();
  }

  // ---------- önizlemeler ----------
  //
  // Yüzlerce sayfalık PDF'te bütün önizlemeleri aynı anda (üstelik ekran
  // çözünürlüğünde) çizmek iPad'in belleğini bitirip uygulamayı kapatıyordu.
  // Artık yalnızca ekrana yaklaşan sayfalar, ikişer ikişer ve küçük boyutta çiziliyor.

  const AYNI_ANDA = 2;
  const kuyruk = [];
  let calisan = 0;
  const gozcu = new IntersectionObserver((girdiler) => {
    for (const g of girdiler) {
      if (!g.isIntersecting) continue;
      gozcu.unobserve(g.target);
      kuyruk.push(g.target._ciz);
    }
    isle();
  }, { root: body, rootMargin: "800px 0px" });

  function isle() {
    while (calisan < AYNI_ANDA && kuyruk.length) {
      const is = kuyruk.shift();
      calisan++;
      is().catch(() => {}).finally(() => { calisan--; isle(); });
    }
  }

  function render() {
    const pages = store.notebook(notebookId).pages;
    if (!pages.some((p) => p.id === selectedId)) selectedId = pages[0].id;
    // Eski ızgaranın bekleyen çizimleri artık geçersiz.
    kuyruk.length = 0;
    gozcu.disconnect();
    const grid = h("div", { class: "pages-grid" });
    pages.forEach((page, index) => grid.append(cell(page, index)));
    body.replaceChildren(
      h("div", { class: "pages-hint" },
        h("span", {}, `${pages.length} sayfa · basılı tutup sürükleyerek sırayı değiştir`),
        h("span", {}, "Sayfaya uzun bas: rengi, boyutu, şablonu değiştir; çoğalt, sil")),
      grid
    );
  }

  /** Izgaradan sayfa rengi: hazır tonlar ve sistem renk seçicisi. */
  function sayfaRengiSec(page) {
    const TONLAR = [["", "Varsayılan"], ["#FFFFFF", "Beyaz"], ["#FBF6E9", "Sıcak"], ["#F6EFE0", "Kraft"], ["#EFF4EC", "Nane"], ["#EAF1FA", "Gökyüzü"], ["#F3EEF9", "Lavanta"], ["#FBEEF1", "Gül"], ["#2A2C34", "Gece"]];
    const uygula = (renk) => { store.setPageColor(notebookId, page.id, renk || null, false); render(); };
    const girdi = h("input", { type: "color", class: "pc-input", value: page.bg || "#F2F0E6", onChange: (e) => { uygula(e.target.value); closeModal(); } });
    openModal(h("div", { class: "sheet-page" },
      h("div", { class: "sheet-head" }, h("span", {}, "Sayfa Rengi"), h("button", { class: "btn ghost", type: "button", onTap: closeModal }, "Kapat")),
      h("div", { class: "sheet-body" },
        h("div", { class: "pc-row" },
          ...TONLAR.map(([hex, ad]) => h("button", { type: "button", class: "pc-dot" + ((page.bg || "") === hex ? " active" : ""), "aria-label": ad, title: ad, style: { "--c": hex || "#F2F0E6" }, onTap: () => { uygula(hex); closeModal(); } })),
          h("label", { class: "pc-dot pc-dot-wheel", "aria-label": "Renk seç", title: "Renk seç" }, girdi)),
        h("div", { class: "note" }, "Seçtiğin renk yalnızca bu sayfaya uygulanır."))
    ));
  }

  function cell(page, index) {
    const thumb = h("div", { class: "thumb", style: { aspectRatio: `${page.size.w} / ${page.size.h}` } });
    // Önizleme sayfanın gerçeği: kağıt + nesneler + mürekkep aynı çizimle üretilir.
    const ink = h("img", { class: "ink", alt: "", draggable: "false" });
    if (onizlemeler.has(page.id)) ink.src = onizlemeler.get(page.id);
    thumb.append(ink);
    const el = h("div", { class: "page-cell" + (page.id === selectedId ? " selected" : ""), dataset: { index: String(index) }, role: "button", tabindex: "0", "aria-label": `${index + 1}. sayfa` },
      thumb, h("div", { class: "num" }, String(index + 1)));
    el._ciz = async () => {
      if (!ink.isConnected) return;
      const pages = store.notebook(notebookId).pages;
      const sira = pages.findIndex((p) => p.id === page.id);
      if (sira < 0) return;
      // PDF sayfası küçük önizleme boyunda isteniyor (300 px); büyük boy yalnız ekranda açık sayfa için.
      const olcek = page.pdf ? Math.min(0.5, 300 / page.size.w) : Math.min(1, 460 / page.size.w);
      const canvas = await renderPageCanvas(page, olcek, { background: true, opaque: true, spill: spillFor(pages, sira) });
      if (!ink.isConnected) return;
      ink.src = canvas.toDataURL("image/jpeg", 0.85);
      onizlemeler.set(page.id, ink.src);
    };
    gozcu.observe(el);

    // Kısa dokunuş: sayfaya git. Basılı tutup sürükleme: sıralama. Basılı tutup bırakma: menü.
    let bekle = null;
    let bas = null;
    el.addEventListener("pointerdown", (e) => {
      if ((e.pointerType === "mouse" && e.button !== 0) || surukleme) return;
      bas = { x: e.clientX, y: e.clientY, id: e.pointerId };
      bekle = setTimeout(() => { bekle = null; if (bas) kaldir(el, bas); }, KALKMA_MS);
    });
    el.addEventListener("pointermove", (e) => {
      if (surukleme && surukleme.id === e.pointerId) { tasi(e.clientX, e.clientY); e.preventDefault(); return; }
      if (bekle && bas && Math.hypot(e.clientX - bas.x, e.clientY - bas.y) > 10) { clearTimeout(bekle); bekle = null; bas = null; }
    });
    const bitir = (e, iptal) => {
      if (surukleme && surukleme.id === e.pointerId) { bas = null; surukleBitir(page, iptal); return; }
      if (bekle) { clearTimeout(bekle); bekle = null; }
      if (bas && !iptal) {
        selectedId = page.id;
        navigate(`#/n/${notebookId}/p/${page.id}`);
      }
      bas = null;
    };
    el.addEventListener("pointerup", (e) => bitir(e, false));
    el.addEventListener("pointercancel", (e) => bitir(e, true));
    el.addEventListener("contextmenu", (e) => e.preventDefault());
    return el;
  }

  function pageMenu(page) {
    const pages = store.notebook(notebookId).pages;
    actionSheet(`${indexOf(page.id) + 1}. sayfa`, [
      { title: "Sayfa Rengi", onSelect: () => sayfaRengiSec(page) },
      { title: "Sayfa Boyutu", onSelect: () => openPageSizeSheet(notebookId, page, render) },
      { title: "Şablonu Değiştir", onSelect: () => openTemplatePicker((template) => { store.setTemplate(notebookId, page.id, template); render(); }) },
      { title: "Çoğalt", onSelect: () => { const id = store.duplicatePage(notebookId, page.id); if (id) selectedId = id; render(); } },
      { title: "Sil", destructive: true, disabled: pages.length <= 1, onSelect: () => confirmDialog("Bu sayfa silinsin mi?", "Sayfa ve üzerindeki yazılar silinir. Defterde en az bir sayfa kalmalı.", "Sayfayı Sil", () => { store.deletePage(notebookId, page.id); render(); }) }
    ]);
  }

  render();
  return {
    destroy() {
      document.removeEventListener("touchmove", kaydirmayiDurdur);
      gozcu.disconnect();
      kuyruk.length = 0;
      if (surukleme) { clearInterval(surukleme.kayma); surukleme.hayalet.remove(); surukleme = null; }
    }
  };
}
