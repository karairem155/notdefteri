// Giriş noktası: yönlendirme (#/, #/n/<defter>/p/<sayfa>, #/n/<defter>/pages, #/settings) ve başlangıç.
import { store } from "./store.js";
import { requestPersistentStorage } from "./db.js";
import { renderLibrary } from "./library.js";
import { renderEditor } from "./editor.js";
import { renderPages } from "./pages.js";
import { renderFan } from "./fan.js";
import { renderSettings } from "./settings.js";
import { toast } from "./ui.js";

const app = document.getElementById("app");
let current = null;

export function navigate(hash) {
  if (location.hash === hash) route();
  else location.hash = hash;
}

function route() {
  const parts = (location.hash.slice(1) || "/").split("/").filter(Boolean);
  if (current && current.destroy) current.destroy();
  current = null;
  app.replaceChildren();
  window.scrollTo(0, 0);
  if (parts[0] === "n" && parts[1] && store.notebook(parts[1])) {
    if (parts[2] === "pages") current = renderPages(app, parts[1]);
    else if (parts[2] === "fan" || parts[2] === undefined) current = renderFan(app, parts[1]);
    else current = renderEditor(app, parts[1], parts[2] === "p" ? parts[3] : null);
  } else if (parts[0] === "settings") {
    current = renderSettings(app);
  } else {
    if (parts[0] === "n") location.hash = "#/";
    current = renderLibrary(app);
  }
}

window.addEventListener("hashchange", route);
window.addEventListener("pagehide", () => { store.flush(); });
document.addEventListener("visibilitychange", () => { if (document.hidden) store.flush(); });
store.addEventListener("error", (e) => toast(e.detail));

store.load().then(async () => {
  route();
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
    }).catch((error) => console.warn("Servis çalışanı kurulamadı", error));
  }
}).catch((error) => {
  app.replaceChildren();
  app.append(Object.assign(document.createElement("div"), { className: "empty", textContent: "Veri açılamadı: " + error.message }));
});
