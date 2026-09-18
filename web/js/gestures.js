// Editör jestleri: bir parmakla sayfa çevirme (yakınlaştırma yokken) ya da kaydırma (yakınken),
// iki parmakla yakınlaştırma ve kaydırma, parmakla çift dokununca yakınlaştırmayı sıfırlama.
// Kalem (Apple Pencil) buraya hiç uğramaz: tuval onu yakalar. Masaüstünde fare, masa alanında aynı işi görür.

const FLIP_START = 10;     // px, bu kadar yatay hareketten sonra çevirme başlar
const DOUBLE_TAP_MS = 320;
const ZOOM_MIN = 0.4;      // uzaklaştırma sınırı
const ZOOM_MAX = 6;        // yakınlaştırma sınırı
const ZOOM_SNAP = 0.03;    // bu kadar yakınsa tam 1 sayılır (sayfa çevirme kilitlenmesin)

export function attachEditorGestures(el, handlers) {
  const pointers = new Map();
  let mode = null;            // "flip" | "pan" | "pinch" | "pending"
  let pending = null;
  let pinch = null;
  let pan = null;
  let flip = null;
  let lastTap = 0;

  function accepts(e) {
    if (e.pointerType === "touch") return true;
    if (e.pointerType === "mouse" && e.button === 0) return handlers.acceptsMouse(e);
    return false;
  }

  el.addEventListener("pointerdown", (e) => {
    if (!accepts(e)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) {
      cancelFlip();
      const [a, b] = [...pointers.values()];
      pinch = { dist: Math.hypot(a.x - b.x, a.y - b.y), mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, zoom: handlers.getZoom(), pan: { ...handlers.getPan() } };
      mode = "pinch";
      return;
    }
    if (pointers.size === 1) {
      const now = Date.now();
      if (e.pointerType === "touch" && now - lastTap < DOUBLE_TAP_MS) {
        if (Math.abs(handlers.getZoom() - 1) > 0.02) handlers.setZoom(1, { x: 0, y: 0 });
        else if (handlers.fillWidthZoom) handlers.setZoom(handlers.fillWidthZoom(), { x: 0, y: 0 });
        lastTap = 0;
        mode = null;
        return;
      }
      lastTap = now;
      pending = { x: e.clientX, y: e.clientY, id: e.pointerId, moved: false };
      mode = "pending";
    }
  });

  el.addEventListener("pointermove", (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (mode === "pinch" && pointers.size >= 2) {
      const [a, b] = [...pointers.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      let zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, pinch.zoom * (dist / Math.max(1, pinch.dist))));
      if (Math.abs(zoom - 1) < ZOOM_SNAP) zoom = 1;
      const p = zoom !== 1 ? { x: pinch.pan.x + (mid.x - pinch.mid.x), y: pinch.pan.y + (mid.y - pinch.mid.y) } : { x: 0, y: 0 };
      handlers.setZoom(zoom, p);
      e.preventDefault();
      return;
    }
    if (mode === "pending" && pending && e.pointerId === pending.id) {
      const dx = e.clientX - pending.x;
      const dy = e.clientY - pending.y;
      if (Math.abs(handlers.getZoom() - 1) > 0.02) {
        if (Math.hypot(dx, dy) > 4) {
          pan = { start: { x: pending.x, y: pending.y }, base: { ...handlers.getPan() } };
          mode = "pan";
        }
        return;
      }
      if (Math.abs(dx) > FLIP_START && Math.abs(dx) > Math.abs(dy) * 1.2) {
        const dir = dx < 0 ? 1 : -1;
        if (handlers.beginFlip(dir)) {
          flip = { dir, startX: e.clientX, lastX: e.clientX, lastT: performance.now(), velocity: 0 };
          mode = "flip";
        } else {
          mode = null;
        }
      }
      return;
    }
    if (mode === "pan" && pan) {
      handlers.setZoom(handlers.getZoom(), { x: pan.base.x + (e.clientX - pan.start.x), y: pan.base.y + (e.clientY - pan.start.y) });
      e.preventDefault();
      return;
    }
    if (mode === "flip" && flip) {
      const now = performance.now();
      const dx = e.clientX - flip.startX;
      const progress = Math.max(0, Math.min(1, (flip.dir === 1 ? -dx : dx) / Math.max(1, handlers.flipWidth())));
      const dt = Math.max(1, now - flip.lastT);
      flip.velocity = (e.clientX - flip.lastX) / dt;
      flip.lastX = e.clientX;
      flip.lastT = now;
      flip.progress = progress;
      handlers.updateFlip(progress);
      e.preventDefault();
    }
  });

  const end = (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.delete(e.pointerId);
    if (mode === "flip" && flip) {
      const fast = flip.dir === 1 ? flip.velocity < -0.35 : flip.velocity > 0.35;
      const commit = fast || (flip.progress || 0) > 0.32;
      handlers.endFlip(commit);
      flip = null;
      mode = null;
      return;
    }
    if (mode === "pinch") {
      if (pointers.size < 2) { mode = pointers.size === 1 ? null : null; pinch = null; }
      return;
    }
    if (pointers.size === 0) { mode = null; pending = null; pan = null; }
  };
  el.addEventListener("pointerup", end);
  el.addEventListener("pointercancel", end);

  function cancelFlip() {
    if (mode === "flip") { handlers.endFlip(false); flip = null; }
    mode = null;
  }
}
