// Giriş noktası: yönlendirme (#/, #/n/<defter>/p/<sayfa>, #/n/<defter>/pages, #/settings) ve başlangıç.
import { store } from "./store.js";
import { requestPersistentStorage } from "./db.js";
import { renderLibrary } from "./library.js";
import { toast } from "./ui.js";

const app = document.getElementById("app");
let current = null;

// Defter ekranları ağır (çizim, sayfa çevirme, paneller): kütüphane açılırken
// beklenmesin diye ilk gerektiklerinde yükleniyorlar.
const editorYukle = () => import("./editor.js");
const sayfalarYukle = () => import("./pages.js");
const yanYanaYukle = () => import("./split.js");
const ayarlarYukle = () => import("./settings.js");
let rotaSirasi = 0;

export function navigate(hash) {
  if (location.hash === hash) route();
  else location.hash = hash;
}

async function route() {
  const sira = ++rotaSirasi;
  // "?p=..." gibi sorgu kısmı yol parçası değildir; ekranlar onu kendileri okur.
  const parts = (location.hash.slice(1).split("?")[0] || "/").split("/").filter(Boolean);
  let kur;
  if (parts[0] === "s" && parts[1] && parts[2] && store.notebook(parts[1]) && store.notebook(parts[2])) {
    // Yan yana iki defter: #/s/<defter>/<defter>
    const m = await yanYanaYukle();
    kur = () => m.renderSplit(app, parts[1], parts[2]);
  } else if (parts[0] === "n" && parts[1] && store.notebook(parts[1])) {
    if (parts[2] === "pages") { const m = await sayfalarYukle(); kur = () => m.renderPages(app, parts[1]); }
    else { const m = await editorYukle(); kur = () => m.renderEditor(app, parts[1], parts[2] === "p" ? parts[3] : null); }
  } else if (parts[0] === "settings") {
    const m = await ayarlarYukle();
    kur = () => m.renderSettings(app);
  } else {
    if (parts[0] === "n" || parts[0] === "s") { location.hash = "#/"; return; }
    kur = () => renderLibrary(app);
  }
  // Yükleme sürerken başka bir yere gidildiyse bu ekran artık geçersiz.
  if (sira !== rotaSirasi) return;
  if (current && current.destroy) current.destroy();
  current = null;
  app.replaceChildren();
  window.scrollTo(0, 0);
  current = kur();
}

window.addEventListener("hashchange", route);
window.addEventListener("pagehide", () => { store.flush(); });
document.addEventListener("visibilitychange", () => { if (document.hidden) store.flush(); });
store.addEventListener("error", (e) => toast(e.detail));

/** Servis çalışanı takılı kalırsa uygulama eski sürümde donar; sürüm farklıysa bir kez temizleyip yenile. */
async function surumKontrol() {
  try {
    const metin = await (await fetch("./sw.js", { cache: "no-store" })).text();
    const eslesme = metin.match(/notdefteri-v\d+/);
    if (!eslesme) return;
    const yeni = eslesme[0];
    const anahtarlar = await caches.keys();
    const kurulu = anahtarlar.filter((k) => k.startsWith("notdefteri-v"));
    if (!kurulu.length || kurulu.includes(yeni)) return;
    if (sessionStorage.getItem("notdefteri.tazeleme") === yeni) return;
    sessionStorage.setItem("notdefteri.tazeleme", yeni);
    for (const kayit of await navigator.serviceWorker.getRegistrations()) await kayit.unregister();
    for (const anahtar of anahtarlar) await caches.delete(anahtar);
    await store.flush();
    location.reload();
  } catch (_) { /* çevrimdışı olabilir */ }
}

/**
 * Masa yüzeyi <html data-masa> ile CSS'te değişiyor. "logo" masası pudranın
 * üstüne kurulu (menüler, paneller aynı), yalnız zemin, çubuklar ve düğmeler
 * logodaki gibi: gül zemin üstünde dolgun lacivert. O yüzden data-logo ekleniyor.
 */
function masaYaz(masa) {
  const kok = document.documentElement;
  // "marka": nötr zemin + lacivert çubuklar (varsayılan). "gul": aynısı, gül zeminde. ("logo" eski adı.)
  const lacivertCubuk = masa === "marka" || masa === "gul" || masa === "logo";
  kok.dataset.masa = lacivertCubuk ? "pudra" : masa;
  if (lacivertCubuk) kok.dataset.logo = ""; else delete kok.dataset.logo;
  if (masa === "gul" || masa === "logo") kok.dataset.gul = ""; else delete kok.dataset.gul;
}
function masaUygula() {
  const masa = store.settings.masa || "marka";
  masaYaz(masa);
  try { localStorage.setItem("notdefteri.masa", masa); } catch (_) {}
}
// Veri yüklenene kadar yanlış renk parlamasın: son seçilen masa hemen gelsin.
try { masaYaz(localStorage.getItem("notdefteri.masa") || "marka"); } catch (_) {}
store.addEventListener("settings", (e) => { if (!e.detail || e.detail.key === "masa") masaUygula(); });

store.load().then(async () => {
  masaUygula();
  route();
  // Kütüphane göründükten sonra defter ekranı arka planda hazırlansın: ilk açılış beklemesin.
  setTimeout(() => { editorYukle().catch(() => {}); }, 1200);
  const persisted = await requestPersistentStorage();
  if (!persisted) console.info("Kalıcı depolama verilmedi; yedekleme önemli.");
  if ("serviceWorker" in navigator) {
    // Yeni sürüm yayınlandığında: yeni çalışan kurulur, denetimi alınca sayfa bir kez yenilenir.
    let refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (refreshing || !navigator.serviceWorker.controller) return;
      refreshing = true;
      store.flush().finally(() => location.reload());
    });
    navigator.serviceWorker.register("./sw.js").then((registration) => {
      registration.addEventListener("updatefound", () => {
        const worker = registration.installing;
        if (!worker) return;
        worker.addEventListener("statechange", () => {
          if (worker.state === "installed" && navigator.serviceWorker.controller) toast("Yeni sürüm yüklendi, yenileniyor…");
        });
      });
      registration.update().catch(() => {});
      surumKontrol();
    }).catch((error) => console.warn("Servis çalışanı kurulamadı", error));
  }
}).catch((error) => {
  app.replaceChildren();
  app.append(Object.assign(document.createElement("div"), { className: "empty", textContent: "Veri açılamadı: " + error.message }));
});
