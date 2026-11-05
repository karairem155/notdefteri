// Fotoğraftan çıkartma yapma ekranı: görsel tam ekranda açılır, parmakla ya da
// kalemle çevresi çizilir ya da hazır bir şekil (daire, kare, kalp, yıldız) yerleştirilir.
// Sayfanın üstünde küçük fotoğrafa çizmek zor olduğu için ayrı ekran.
import { h, toast } from "./ui.js";

const SVG_NS = "http://www.w3.org/2000/svg";
const SEKILLER = [["serbest", "Serbest"], ["daire", "Daire"], ["kare", "Kare"], ["kalp", "Kalp"], ["yildiz", "Yıldız"]];
const IPUCLARI = {
  serbest: "Kesmek istediğin yerin çevresini çiz; beğenmezsen yeniden çiz.",
  sekil: "Şekli sürükleyerek taşı; köşedeki noktayla ya da iki parmakla büyüt."
};
const EN_BUYUK_KENAR = 1024;   // çıktının uzun kenarı
const KENAR_ORANI = 0.035;     // beyaz kenarın kalınlığı, kesilen parçanın kısa kenarına göre

const svgOge = (ad, oz = {}) => {
  const el = document.createElementNS(SVG_NS, ad);
  for (const [k, v] of Object.entries(oz)) el.setAttribute(k, v);
  return el;
};

/** Köşeleri yumuşatır: elle çizilen yol titrek, yıldızın uçları sivri kalmasın. */
function chaikin(noktalar, tur) {
  let n = noktalar;
  for (let t = 0; t < tur; t++) {
    const yeni = [];
    for (let i = 0; i < n.length; i++) {
      const [ax, ay] = n[i];
      const [bx, by] = n[(i + 1) % n.length];
      yeni.push([ax * 0.75 + bx * 0.25, ay * 0.75 + by * 0.25], [ax * 0.25 + bx * 0.75, ay * 0.25 + by * 0.75]);
    }
    n = yeni;
  }
  return n;
}

/** Şeklin -1..1 aralığındaki çevresi. */
function birimSekil(tur) {
  const n = [];
  if (tur === "daire") {
    for (let i = 0; i < 96; i++) { const a = (i / 96) * Math.PI * 2; n.push([Math.cos(a), Math.sin(a)]); }
  } else if (tur === "kare") {
    const r = 0.16;
    const koseler = [[1 - r, 1 - r, 0], [-1 + r, 1 - r, 90], [-1 + r, -1 + r, 180], [1 - r, -1 + r, 270]];
    for (const [x, y, bas] of koseler) {
      for (let i = 0; i <= 10; i++) { const a = (bas + i * 9) * Math.PI / 180; n.push([x + Math.cos(a) * r, y + Math.sin(a) * r]); }
    }
  } else if (tur === "kalp") {
    for (let i = 0; i < 96; i++) {
      const t = (i / 96) * Math.PI * 2;
      n.push([Math.pow(Math.sin(t), 3), -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t) - 2.5) / 16]);
    }
  } else {
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i / 10) * Math.PI * 2;
      const r = i % 2 ? 0.5 : 1;
      n.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
    return chaikin(n, 3);
  }
  return n;
}

const yolYaz = (n, kapali = true) => "M" + n.map((p) => p[0].toFixed(1) + " " + p[1].toFixed(1)).join("L") + (kapali ? "Z" : "");

/**
 * Ekranı açar; bitince { blob, w, h, kutu, gorselW, gorselH } döner, vazgeçilirse null.
 * kutu: çıkartmanın görsel üzerindeki yeri (görsel pikseli), sayfaya yerleştirmek için.
 */
export function openStickerMaker(url) {
  return new Promise((resolve, reject) => {
    const gorsel = new Image();
    gorsel.onerror = () => reject(new Error("görsel yüklenemedi"));
    gorsel.onload = () => kur(gorsel, url, resolve);
    gorsel.src = url;
  });
}

function kur(gorsel, url, bitir) {
  const W = gorsel.naturalWidth;
  const H = gorsel.naturalHeight;
  let tur = "serbest";
  let kenarAcik = true;
  let serbest = null;               // kapanmış serbest yol
  let cizim = null;                 // çizilmekte olan yol
  const kisa = Math.min(W, H);
  let sekil = { cx: W / 2, cy: H / 2, w: kisa * 0.7, h: kisa * 0.7 };
  let goster = 1;                   // ekran pikseli / görsel pikseli

  const svg = svgOge("svg", { viewBox: `0 0 ${W} ${H}`, class: "ck-svg" });
  const klipId = "ck-klip-" + Math.random().toString(36).slice(2);
  const klipYol = svgOge("path");
  const klip = svgOge("clipPath", { id: klipId });
  klip.append(klipYol);
  const defs = svgOge("defs");
  defs.append(klip);
  const taban = svgOge("image", { href: url, x: 0, y: 0, width: W, height: H });
  const karart = svgOge("path", { class: "ck-karart", "fill-rule": "evenodd" });
  const kenar = svgOge("path", { class: "ck-kenar" });
  const kesik = svgOge("image", { href: url, x: 0, y: 0, width: W, height: H, "clip-path": `url(#${klipId})` });
  const cizgi = svgOge("path", { class: "ck-cizgi" });
  const tutamak = svgOge("circle", { class: "ck-tutamak" });
  svg.append(defs, taban, karart, kenar, kesik, cizgi, tutamak);

  const tuval = h("div", { class: "ck-tuval" });
  tuval.append(svg);
  const sahne = h("div", { class: "ck-sahne" }, tuval);
  const ipucu = h("div", { class: "ck-ipucu" });
  const bitirDugme = h("button", { class: "ck-bitti", type: "button", disabled: true, onTap: tamamla }, "Çıkartma yap");
  const sekilSatir = h("div", { class: "ck-sekiller", role: "group", "aria-label": "Şekil" });
  const kenarDugme = h("button", { class: "ck-kenar-dugme", type: "button", onTap: () => { kenarAcik = !kenarAcik; ciz(); } });
  const ekran = h("div", { class: "cikartma-ekran", role: "dialog", "aria-label": "Çıkartma yap" },
    h("div", { class: "ck-ust" },
      h("button", { class: "ck-vazgec", type: "button", onTap: () => kapat(null) }, "Vazgeç"),
      h("div", { class: "ck-baslik" }, "Çıkartma yap"),
      bitirDugme),
    sahne, ipucu,
    h("div", { class: "ck-alt" }, sekilSatir, kenarDugme));
  document.body.append(ekran);

  const noktalar = () => (tur === "serbest"
    ? serbest
    : birimSekil(tur).map(([x, y]) => [sekil.cx + x * sekil.w / 2, sekil.cy + y * sekil.h / 2]));

  const kenarKalinligi = (n) => {
    if (!kenarAcik || !n) return 0;
    const xs = n.map((p) => p[0]);
    const ys = n.map((p) => p[1]);
    const k = Math.min(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
    return Math.max(k * KENAR_ORANI, 5 / goster);
  };

  function ciz() {
    const n = noktalar();
    const var_ = !!n;
    karart.setAttribute("d", var_ ? `M0 0H${W}V${H}H0Z` + yolYaz(n) : "");
    const d = var_ ? yolYaz(n) : "";
    klipYol.setAttribute("d", d);
    kesik.style.display = var_ ? "" : "none";
    kenar.setAttribute("d", d);
    kenar.setAttribute("stroke-width", kenarKalinligi(n) * 2);
    kenar.style.display = kenarAcik && var_ ? "" : "none";
    cizgi.setAttribute("stroke-width", 3 / goster);
    cizgi.setAttribute("stroke-dasharray", `${8 / goster} ${6 / goster}`);
    cizgi.setAttribute("d", cizim ? yolYaz(cizim, false) : d);
    tutamak.style.display = tur === "serbest" ? "none" : "";
    if (tur !== "serbest") {
      tutamak.setAttribute("cx", sekil.cx + sekil.w / 2);
      tutamak.setAttribute("cy", sekil.cy + sekil.h / 2);
      tutamak.setAttribute("r", 13 / goster);
      tutamak.setAttribute("stroke-width", 3 / goster);
    }
    bitirDugme.disabled = !var_;
    ipucu.textContent = tur === "serbest" ? IPUCLARI.serbest : IPUCLARI.sekil;
    kenarDugme.textContent = kenarAcik ? "Beyaz kenar: açık" : "Beyaz kenar: kapalı";
    kenarDugme.classList.toggle("acik", kenarAcik);
  }

  function sekilleriCiz() {
    sekilSatir.replaceChildren(...SEKILLER.map(([k, ad]) => h("button", {
      type: "button", class: tur === k ? "secili" : "", "aria-pressed": String(tur === k),
      onTap: () => { tur = k; cizim = null; sekilleriCiz(); ciz(); }
    }, ad)));
  }

  function boyutla() {
    const r = sahne.getBoundingClientRect();
    goster = Math.min(r.width / W, r.height / H);
    tuval.style.width = Math.round(W * goster) + "px";
    tuval.style.height = Math.round(H * goster) + "px";
    ciz();
  }

  // ---------- dokunuş ----------
  const parmaklar = new Map();
  let is = null;

  const gorselNoktasi = (e) => {
    const r = tuval.getBoundingClientRect();
    return [(e.clientX - r.left) / goster, (e.clientY - r.top) / goster];
  };
  const sinirla = ([x, y]) => [Math.min(W, Math.max(0, x)), Math.min(H, Math.max(0, y))];

  sahne.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    try { sahne.setPointerCapture(e.pointerId); } catch (_) { /* yakalanamazsa da devam */ }
    const p = gorselNoktasi(e);
    parmaklar.set(e.pointerId, p);
    if (tur === "serbest") {
      if (parmaklar.size === 1) { cizim = [sinirla(p)]; serbest = null; ciz(); }
      return;
    }
    if (parmaklar.size === 2) {
      const [a, b] = [...parmaklar.values()];
      is = { tur: "cimdik", ilk: Math.hypot(a[0] - b[0], a[1] - b[1]) || 1, w: sekil.w, h: sekil.h };
    } else if (Math.hypot(p[0] - (sekil.cx + sekil.w / 2), p[1] - (sekil.cy + sekil.h / 2)) < 26 / goster) {
      is = { tur: "boyut" };
    } else {
      is = { tur: "tasi", dx: p[0] - sekil.cx, dy: p[1] - sekil.cy };
    }
  });

  sahne.addEventListener("pointermove", (e) => {
    if (!parmaklar.has(e.pointerId)) return;
    const p = gorselNoktasi(e);
    parmaklar.set(e.pointerId, p);
    if (tur === "serbest") {
      if (!cizim || e.pointerId !== [...parmaklar.keys()][0]) return;
      const s = cizim[cizim.length - 1];
      const q = sinirla(p);
      if (Math.hypot(q[0] - s[0], q[1] - s[1]) * goster >= 3) { cizim.push(q); cizgi.setAttribute("d", yolYaz(cizim, false)); }
      return;
    }
    const enAz = 44 / goster;
    if (is && is.tur === "tasi") {
      sekil.cx = Math.min(W, Math.max(0, p[0] - is.dx));
      sekil.cy = Math.min(H, Math.max(0, p[1] - is.dy));
    } else if (is && is.tur === "boyut") {
      const genis = Math.max(enAz, Math.abs(p[0] - sekil.cx) * 2);
      const yuksek = Math.max(enAz, Math.abs(p[1] - sekil.cy) * 2);
      // Kare dikdörtgene de dönebilir; daire, kalp ve yıldız oranını korur.
      if (tur === "kare") { sekil.w = genis; sekil.h = yuksek; } else { sekil.w = sekil.h = Math.max(genis, yuksek); }
    } else if (is && is.tur === "cimdik" && parmaklar.size >= 2) {
      const [a, b] = [...parmaklar.values()];
      const oran = Math.hypot(a[0] - b[0], a[1] - b[1]) / is.ilk;
      sekil.w = Math.max(enAz, is.w * oran);
      sekil.h = Math.max(enAz, is.h * oran);
    }
    ciz();
  });

  const birak = (e) => {
    if (!parmaklar.has(e.pointerId)) return;
    const ilk = [...parmaklar.keys()][0] === e.pointerId;
    parmaklar.delete(e.pointerId);
    is = null;
    if (tur !== "serbest" || !cizim || !ilk) return;
    const c = cizim;
    cizim = null;
    const xs = c.map((p) => p[0]);
    const ys = c.map((p) => p[1]);
    const genis = (Math.max(...xs) - Math.min(...xs)) * goster;
    const yuksek = (Math.max(...ys) - Math.min(...ys)) * goster;
    if (e.type === "pointercancel") { ciz(); return; }
    if (c.length < 8 || genis < 30 || yuksek < 30) { toast("Kesmek istediğin yerin çevresini çiz."); ciz(); return; }
    serbest = chaikin(c, 2);
    ciz();
  };
  sahne.addEventListener("pointerup", birak);
  sahne.addEventListener("pointercancel", birak);

  // ---------- çıktı ----------
  async function tamamla() {
    const ham = noktalar();
    if (!ham) return;
    const b = kenarKalinligi(ham);
    const n = ham.map(sinirla);
    const xs = n.map((p) => p[0]);
    const ys = n.map((p) => p[1]);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    if (maxX - minX < 8 || maxY - minY < 8) { toast("Şekil görselin dışında kaldı."); return; }
    bitirDugme.disabled = true;
    const pay = b ? b + 2 : 0;
    const kutu = { x: minX - pay, y: minY - pay, w: maxX - minX + pay * 2, h: maxY - minY + pay * 2 };
    const s = Math.min(1, EN_BUYUK_KENAR / Math.max(kutu.w, kutu.h));
    const tuvalC = document.createElement("canvas");
    tuvalC.width = Math.ceil(kutu.w * s);
    tuvalC.height = Math.ceil(kutu.h * s);
    const c = tuvalC.getContext("2d");
    c.scale(s, s);
    c.translate(-kutu.x, -kutu.y);
    const yol = () => { c.beginPath(); n.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]))); c.closePath(); };
    if (b) {
      yol();
      c.lineJoin = "round";
      c.lineWidth = b * 2;
      c.strokeStyle = "#ffffff";
      c.stroke();
    }
    c.save();
    yol();
    c.clip();
    if (b) { c.fillStyle = "#ffffff"; c.fillRect(kutu.x, kutu.y, kutu.w, kutu.h); }   // saydam görselde de dolu görünsün
    c.drawImage(gorsel, 0, 0, W, H);
    c.restore();
    const blob = await new Promise((res) => tuvalC.toBlob(res, "image/png"));
    if (!blob) { toast("Çıkartma yapılamadı."); bitirDugme.disabled = false; return; }
    kapat({ blob, w: tuvalC.width, h: tuvalC.height, kutu, gorselW: W, gorselH: H });
  }

  function kapat(sonuc) {
    window.removeEventListener("resize", boyutla);
    ekran.remove();
    bitir(sonuc);
  }

  window.addEventListener("resize", boyutla);
  sekilleriCiz();
  boyutla();
}
