// Klasör: defterlerin durduğu deri dosya. Girişte defterler bunların içinde.
//
// Şekil dosya klasörünün kendisi: arkada tam bir dikdörtgen, önde sağ üstte
// sekmesi olan kapak. Kapağın dokusu (kroko, düz deri, keten, karton) SVG'de
// üretiliyor — görsel dosyası taşımıyoruz, her renkte aynı doku çıksın diye.
import { h } from "./ui.js";
import { store } from "./store.js";

const SVG_NS = "http://www.w3.org/2000/svg";
let sayac = 0;

export const FOLDER_MATERIALS = [
  { id: "kroko", name: "Kroko" },
  { id: "deri", name: "Düz deri" },
  { id: "keten", name: "Keten" },
  { id: "karton", name: "Karton" }
];

export const FOLDER_COLORS = [
  "#7B1E22", "#8C3B2E", "#B8763C", "#2F4F3A",
  "#1F3A5F", "#3C3560", "#2B2B30", "#C9748E",
  "#D9C7A8", "#6B7B5E"
];

export const DEFAULT_FOLDER = { color: "#7B1E22", material: "kroko" };

/** Klasörün görünümü; kullanıcı seçmediyse ada göre sabit bir renk. */
export function folderStyle(name) {
  const kayit = (store.settings.folderStyles || {})[name];
  if (kayit && kayit.color) return kayit;
  let toplam = 0;
  for (let i = 0; i < String(name).length; i++) toplam = (toplam * 31 + name.charCodeAt(i)) >>> 0;
  return { color: FOLDER_COLORS[toplam % FOLDER_COLORS.length], material: DEFAULT_FOLDER.material };
}

export function setFolderStyle(name, style) {
  const hepsi = { ...(store.settings.folderStyles || {}) };
  hepsi[name] = { color: style.color, material: style.material };
  store.setSetting("folderStyles", hepsi);
}

export function renameFolderStyle(oldName, newName) {
  const hepsi = { ...(store.settings.folderStyles || {}) };
  if (!hepsi[oldName]) return;
  hepsi[newName] = hepsi[oldName];
  delete hepsi[oldName];
  store.setSetting("folderStyles", hepsi);
}

export function dropFolderStyle(name) {
  const hepsi = { ...(store.settings.folderStyles || {}) };
  if (!(name in hepsi)) return;
  delete hepsi[name];
  store.setSetting("folderStyles", hepsi);
}

// ── renk yardımcıları ───────────────────────────────────────────────────────

function oku(renk) {
  const hex = String(renk || "#7B1E22").replace("#", "");
  const tam = hex.length === 3 ? hex.split("").map((c) => c + c).join("") : hex;
  return [parseInt(tam.slice(0, 2), 16) || 0, parseInt(tam.slice(2, 4), 16) || 0, parseInt(tam.slice(4, 6), 16) || 0];
}

function karistir(a, b, oran) {
  const [r1, g1, b1] = oku(a);
  const [r2, g2, b2] = oku(b);
  const m = (x, y) => Math.round(x + (y - x) * oran);
  return `rgb(${m(r1, r2)},${m(g1, g2)},${m(b1, b2)})`;
}

const koyu = (renk, k) => karistir(renk, "#000000", k);
const acik = (renk, k) => karistir(renk, "#ffffff", k);

/** Aynı klasör her açılışta aynı görünsün diye tohumlu rastgele. */
function rastgele(tohum) {
  let t = tohum >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function el(tag, attrs = {}) {
  const e = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
}

/** Köşeleri yuvarlatılmış çokgen yolu. */
function yuvarlakYol(noktalar, yaricap) {
  const n = noktalar.length;
  let d = "";
  for (let i = 0; i < n; i++) {
    const onceki = noktalar[(i - 1 + n) % n];
    const simdi = noktalar[i];
    const sonraki = noktalar[(i + 1) % n];
    const r = Array.isArray(yaricap) ? yaricap[i] : yaricap;
    const girisUzunluk = Math.hypot(simdi[0] - onceki[0], simdi[1] - onceki[1]);
    const cikisUzunluk = Math.hypot(sonraki[0] - simdi[0], sonraki[1] - simdi[1]);
    const rg = Math.min(r, girisUzunluk / 2);
    const rc = Math.min(r, cikisUzunluk / 2);
    const giris = [simdi[0] + (onceki[0] - simdi[0]) * (rg / girisUzunluk), simdi[1] + (onceki[1] - simdi[1]) * (rg / girisUzunluk)];
    const cikis = [simdi[0] + (sonraki[0] - simdi[0]) * (rc / cikisUzunluk), simdi[1] + (sonraki[1] - simdi[1]) * (rc / cikisUzunluk)];
    d += (i === 0 ? `M${giris[0]} ${giris[1]}` : `L${giris[0]} ${giris[1]}`);
    d += `Q${simdi[0]} ${simdi[1]} ${cikis[0]} ${cikis[1]}`;
  }
  return d + "Z";
}

function yuvarlakDikdortgen(x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  return `M${x + rr} ${y}H${x + w - rr}Q${x + w} ${y} ${x + w} ${y + rr}V${y + h - rr}Q${x + w} ${y + h} ${x + w - rr} ${y + h}H${x + rr}Q${x} ${y + h} ${x} ${y + h - rr}V${y + rr}Q${x} ${y} ${x + rr} ${y}Z`;
}

// ── dokular ─────────────────────────────────────────────────────────────────

/**
 * Kroko: iri, kabarık pullar; aralarında derin derz.
 *
 * Pullar küçük ve düzenli olursa tuğla duvara benziyor. Gerçek kroko derisinde
 * pul, satır yüksekliği kadar geniş ve neredeyse kare; ortada iri, kenarlara
 * doğru küçülüyor. Her pulun sol üstünde parlama, sağ altında koyu kenar var —
 * kabarıklığı veren bu.
 */
function kroko(W, H, renk, id) {
  const g = el("g");
  const rnd = rastgele(97);
  const satirSayisi = 4.4;
  let y = -H * 0.05;
  let satir = 0;
  while (y < H) {
    // Ortadaki satırlar iri, üst ve alta doğru küçülüyor.
    const merkez = 1 - Math.abs((y + H * 0.05) / H - 0.5) * 0.55;
    const yukseklik = (H / satirSayisi) * merkez * (0.88 + rnd() * 0.26);
    let x = -W * 0.08;
    while (x < W) {
      const genislik = yukseklik * (0.95 + rnd() * 0.55);
      const derz = Math.max(1.1, yukseklik * 0.11);
      const w = genislik - derz;
      const h = yukseklik - derz;
      if (w > 1.5 && h > 1.5) {
        const d = yuvarlakDikdortgen(x + derz / 2, y + derz / 2, w, h, Math.min(w, h) * (0.21 + rnd() * 0.13));
        g.append(el("path", { d, fill: `url(#${id}-pul)` }));
        g.append(el("path", { d, fill: "none", stroke: "rgba(0,0,0,0.35)", "stroke-width": "0.45" }));
      }
      x += genislik;
    }
    y += yukseklik;
    satir++;
  }
  return g;
}

/** Düz deri: iri gözenekler ve yumuşak dalgalanma. */
function deri(W, H, renk, id) {
  const g = el("g", { fill: "none" });
  const rnd = rastgele(41);
  for (let i = 0; i < 90; i++) {
    const x = rnd() * W;
    const y = rnd() * H;
    const r = 0.6 + rnd() * 1.6;
    g.append(el("circle", { cx: x.toFixed(1), cy: y.toFixed(1), r: r.toFixed(2), fill: rnd() > 0.5 ? "rgba(0,0,0,0.16)" : "rgba(255,255,255,0.09)" }));
  }
  for (let i = 0; i < 14; i++) {
    const y = rnd() * H;
    g.append(el("path", {
      d: `M0 ${y.toFixed(1)}Q${(W / 2).toFixed(1)} ${(y + (rnd() - 0.5) * H * 0.08).toFixed(1)} ${W} ${(y + (rnd() - 0.5) * H * 0.05).toFixed(1)}`,
      stroke: "rgba(0,0,0,0.07)", "stroke-width": (0.5 + rnd()).toFixed(2)
    }));
  }
  return g;
}

/** Keten: ince dokuma. */
function keten(W, H, renk, id) {
  const g = el("g", { "stroke-width": "0.7" });
  for (let x = 0; x < W; x += 3) g.append(el("line", { x1: x, y1: 0, x2: x, y2: H, stroke: "rgba(255,255,255,0.07)" }));
  for (let y = 0; y < H; y += 3) g.append(el("line", { x1: 0, y1: y, x2: W, y2: y, stroke: "rgba(0,0,0,0.10)" }));
  return g;
}

/** Karton: kısa lif kırıntıları. */
function karton(W, H, renk, id) {
  const g = el("g");
  const rnd = rastgele(13);
  for (let i = 0; i < 260; i++) {
    const x = rnd() * W;
    const y = rnd() * H;
    const u = 1 + rnd() * 3;
    const aci = rnd() * Math.PI;
    g.append(el("line", {
      x1: x.toFixed(1), y1: y.toFixed(1),
      x2: (x + Math.cos(aci) * u).toFixed(1), y2: (y + Math.sin(aci) * u).toFixed(1),
      stroke: rnd() > 0.45 ? "rgba(0,0,0,0.16)" : "rgba(255,255,255,0.12)", "stroke-width": "0.6"
    }));
  }
  return g;
}

const DOKULAR = { kroko, deri, keten, karton };

/**
 * Klasör öğesi.
 *
 * `style` = { color, material }. Oran 4:3, sekme sağ üstte.
 */
export function folderElement(style, { className = "", count = 0 } = {}) {
  const s = style && style.color ? style : DEFAULT_FOLDER;
  const renk = s.color;
  const id = "klasor" + (++sayac);
  const W = 120;
  const H = 90;
  const sekmeY = 13;        // ön kapağın sol taraftaki üst kenarı
  const sekmeX = 58;        // çaprazın başladığı yer
  const sekmeUc = 68;       // çaprazın bittiği yer

  const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, class: "klasor-svg", "aria-hidden": "true" });
  const defs = el("defs");

  // Pulun kabarıklığı: sol üstte parlama, kenarda koyuluk. Gradyan her pulun
  // kendi kutusuna göre hesaplanıyor (objectBoundingBox), tek tanım yetiyor.
  const pul = el("radialGradient", { id: id + "-pul", cx: "0.34", cy: "0.26", r: "0.82" });
  pul.append(el("stop", { offset: "0", "stop-color": acik(renk, 0.34) }));
  pul.append(el("stop", { offset: "0.28", "stop-color": acik(renk, 0.1) }));
  pul.append(el("stop", { offset: "0.72", "stop-color": renk }));
  pul.append(el("stop", { offset: "1", "stop-color": koyu(renk, 0.5) }));
  defs.append(pul);

  // Cilalı derinin ışığı: sol üstten gelen geniş, yumuşak bir yansıma.
  const cila = el("radialGradient", { id: id + "-cila", cx: "0.28", cy: "0.2", r: "0.75" });
  cila.append(el("stop", { offset: "0", "stop-color": "rgba(255,255,255,0.26)" }));
  cila.append(el("stop", { offset: "0.45", "stop-color": "rgba(255,255,255,0.07)" }));
  cila.append(el("stop", { offset: "1", "stop-color": "rgba(255,255,255,0)" }));
  defs.append(cila);

  const parlama = el("linearGradient", { id: id + "-parlama", x1: "0", y1: "0", x2: "0.7", y2: "1" });
  parlama.append(el("stop", { offset: "0", "stop-color": "rgba(255,255,255,0.28)" }));
  parlama.append(el("stop", { offset: "0.35", "stop-color": "rgba(255,255,255,0.05)" }));
  parlama.append(el("stop", { offset: "0.62", "stop-color": "rgba(0,0,0,0)" }));
  parlama.append(el("stop", { offset: "1", "stop-color": "rgba(0,0,0,0.22)" }));
  defs.append(parlama);

  const onYol = yuvarlakYol([[0, sekmeY], [sekmeX, sekmeY], [sekmeUc, 0], [W, 0], [W, H], [0, H]], [6, 4, 4, 6, 6, 6]);
  const kirp = el("clipPath", { id: id + "-kirp" });
  kirp.append(el("path", { d: onYol }));
  defs.append(kirp);
  svg.append(defs);

  // Arka kapak: sol üstte, önün sekmesinin altından görünen koyu kısım.
  svg.append(el("path", { d: yuvarlakDikdortgen(0, 0, W, H, 6), fill: koyu(renk, 0.52) }));
  // İçerideki kâğıt: klasör doluysa kapağın üstünden iki ince yaprak görünüyor.
  // Dar tutuluyor ki klasörün derisi de görünsün.
  if (count > 0) {
    svg.append(el("path", { d: yuvarlakDikdortgen(13, 5.5, W - 38, H - 11, 2.5), fill: "#d9d2c0" }));
    svg.append(el("path", { d: yuvarlakDikdortgen(10, 8.5, W - 32, H - 17, 2.5), fill: "#f1ebdd" }));
  }

  const on = el("g", { "clip-path": `url(#${id}-kirp)` });
  // Derzlerin dibi: pulların arasından bu koyu zemin görünüyor.
  on.append(el("path", { d: onYol, fill: koyu(renk, 0.74) }));
  const doku = DOKULAR[s.material] || kroko;
  on.append(doku(W, H, renk, id));
  if (s.material !== "kroko") on.append(el("path", { d: onYol, fill: renk, opacity: "0.55" }));
  on.append(el("path", { d: onYol, fill: `url(#${id}-cila)` }));
  on.append(el("path", { d: onYol, fill: `url(#${id}-parlama)` }));
  // Kapağın üst kenarında ince ışık, altında gölge: kartonun kalınlığı.
  on.append(el("path", { d: onYol, fill: "none", stroke: "rgba(255,255,255,0.18)", "stroke-width": "1" }));
  svg.append(on);
  svg.append(el("path", { d: onYol, fill: "none", stroke: koyu(renk, 0.65), "stroke-width": "0.8" }));

  return h("div", { class: "klasor " + className, style: { "--klasor": renk } }, svg);
}
