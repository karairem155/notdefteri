// Yan yana iki defter: aynı anda iki defteri açıp birinden ötekine bakmak için.
//
// İki ayrı editör örneği kuruluyor; ikisi de kendi üst çubuğunu, tezgâhını ve
// mürekkep tuvallerini taşıyor. Aralarındaki tutamak sürüklenerek genişlik
// değiştiriliyor. Klavye kısayolları yalnız son dokunulan bölmeye gidiyor,
// yoksa geri alma iki defterde birden çalışıyordu.
import { store } from "./store.js";
import { h } from "./ui.js";
import { renderEditor } from "./editor.js";
import { navigate } from "./app.js";

const EN_AZ = 24;   // bir bölmenin en az yüzdesi

export function renderSplit(root, idA, idB) {
  const a = store.notebook(idA);
  const b = store.notebook(idB);
  if (!a || !b || a.isTrashed || b.isTrashed) {
    navigate(a && !a.isTrashed ? `#/n/${idA}` : "#/");
    return { destroy() { /* yönlendirildi */ } };
  }

  const sol = h("div", { class: "split-pane aktif" });
  const tutamak = h("div", { class: "split-handle", role: "separator", "aria-label": "Bölme genişliği", "aria-orientation": "vertical", tabindex: "0" }, h("span", {}));
  const sag = h("div", { class: "split-pane" });
  const kap = h("div", { class: "split" }, sol, tutamak, sag);
  root.append(kap);

  // Son dokunulan bölme etkin sayılıyor: klavye oraya gidiyor.
  const etkinYap = (pano) => {
    if (pano.classList.contains("aktif")) return;
    sol.classList.toggle("aktif", pano === sol);
    sag.classList.toggle("aktif", pano === sag);
  };
  const solDokunus = () => etkinYap(sol);
  const sagDokunus = () => etkinYap(sag);
  sol.addEventListener("pointerdown", solDokunus, true);
  sag.addEventListener("pointerdown", sagDokunus, true);

  // Tutamak: bölmelerin genişliği.
  let oran = 50;
  const uygula = () => {
    sol.style.flex = `0 0 ${oran}%`;
    sag.style.flex = `1 1 0`;
  };
  uygula();
  let surukleme = null;
  tutamak.addEventListener("pointerdown", (e) => {
    surukleme = e.pointerId;
    try { tutamak.setPointerCapture(e.pointerId); } catch (_) { /* yakalayamadıysa yine çalışır */ }
    tutamak.classList.add("tutuluyor");
    e.preventDefault();
  });
  tutamak.addEventListener("pointermove", (e) => {
    if (surukleme !== e.pointerId) return;
    const kutu = kap.getBoundingClientRect();
    if (!kutu.width) return;
    oran = Math.max(EN_AZ, Math.min(100 - EN_AZ, ((e.clientX - kutu.left) / kutu.width) * 100));
    uygula();
    e.preventDefault();
  });
  const birak = (e) => {
    if (surukleme !== e.pointerId) return;
    surukleme = null;
    tutamak.classList.remove("tutuluyor");
    try { localStorage.setItem("notdefteri.bolmeOrani", String(Math.round(oran))); } catch (_) { /* özel kip */ }
  };
  tutamak.addEventListener("pointerup", birak);
  tutamak.addEventListener("pointercancel", birak);
  try {
    const kayit = parseFloat(localStorage.getItem("notdefteri.bolmeOrani"));
    if (kayit >= EN_AZ && kayit <= 100 - EN_AZ) { oran = kayit; uygula(); }
  } catch (_) { /* özel kip */ }

  const panolar = [
    renderEditor(sol, idA, null, { split: true, kapat: () => navigate(`#/n/${idB}`), esi: idB }),
    renderEditor(sag, idB, null, { split: true, kapat: () => navigate(`#/n/${idA}`), esi: idA })
  ];

  return {
    destroy() {
      sol.removeEventListener("pointerdown", solDokunus, true);
      sag.removeEventListener("pointerdown", sagDokunus, true);
      for (const pano of panolar) if (pano && pano.destroy) pano.destroy();
    }
  };
}
