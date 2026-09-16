// Çizim motoru. PencilKit yerine: Pointer Events + canvas.
// - Apple Pencil basıncı kalınlığa yansır (pointerType "pen", pressure 0..1).
// - "Sadece Apple Pencil" açıkken parmak dokunuşları çizmez (avuç reddi).
// - Silgi vektörel: dokunulan çizgi bütünüyle silinir.
// - Geri al / ileri al sayfa başına tutulur.
import { uid } from "./store.js";

const HISTORY_LIMIT = 60;

export class InkCanvas {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {object} page - store'daki sayfa nesnesi (strokes dizisi yerinde değişir)
   * @param {object} options - { getTool: () => {tool,color,width}, pencilOnly: () => bool, onChange: () => void, toPageCoords: (e) => {x,y} }
   */
  constructor(canvas, page, options) {
    this.canvas = canvas;
    this.page = page;
    this.options = options;
    this.ctx = canvas.getContext("2d");
    this.undoStack = [];
    this.redoStack = [];
    this.live = null;
    this.activePointer = null;
    this.setup();
    this.redraw();
    this.bind();
  }

  setup() {
    const dpr = window.devicePixelRatio || 1;
    const { w, h } = this.page.size;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.canvas.style.width = w + "px";
    this.canvas.style.height = h + "px";
    this.dpr = dpr;
  }

  bind() {
    const c = this.canvas;
    c.style.touchAction = "none";
    c.addEventListener("pointerdown", (e) => this.onDown(e));
    c.addEventListener("pointermove", (e) => this.onMove(e));
    c.addEventListener("pointerup", (e) => this.onUp(e));
    c.addEventListener("pointercancel", (e) => this.onUp(e));
    c.addEventListener("pointerleave", (e) => { if (this.live) this.onUp(e); });
  }

  accepts(e) {
    if (e.pointerType === "touch" && this.options.pencilOnly()) return false;
    if (e.pointerType === "mouse" && e.buttons !== 1) return false;
    return true;
  }

  point(e) {
    const p = this.options.toPageCoords(e);
    const pressure = e.pointerType === "pen" ? Math.max(0.05, e.pressure || 0.5) : 0.5;
    return [Math.round(p.x * 10) / 10, Math.round(p.y * 10) / 10, Math.round(pressure * 100) / 100];
  }

  onDown(e) {
    if (!this.accepts(e) || this.activePointer !== null) return;
    const tool = this.options.getTool();
    if (!tool || tool.tool === "frosted") return;
    this.activePointer = e.pointerId;
    this.canvas.setPointerCapture(e.pointerId);
    e.preventDefault();
    if (tool.tool === "eraser") {
      this.eraseAt(this.point(e), true);
      return;
    }
    this.live = { id: uid(), tool: tool.tool, color: tool.color, width: tool.width, points: [this.point(e)] };
  }

  onMove(e) {
    if (e.pointerId !== this.activePointer) return;
    e.preventDefault();
    const tool = this.options.getTool();
    if (tool.tool === "eraser") {
      this.eraseAt(this.point(e), false);
      return;
    }
    if (!this.live) return;
    const events = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    for (const ev of events) {
      const p = this.point(ev);
      const last = this.live.points[this.live.points.length - 1];
      if (Math.hypot(p[0] - last[0], p[1] - last[1]) < 0.7) continue;
      this.live.points.push(p);
      this.drawSegment(this.live, this.live.points.length - 2);
    }
  }

  onUp(e) {
    if (e.pointerId !== this.activePointer) return;
    this.activePointer = null;
    try { this.canvas.releasePointerCapture(e.pointerId); } catch (_) { /* yok sayılır */ }
    if (this.eraseSession) {
      if (this.eraseSession.removed) this.commit();
      this.eraseSession = null;
      return;
    }
    if (!this.live) return;
    const stroke = this.live;
    this.live = null;
    if (stroke.points.length === 1) {
      const [x, y, p] = stroke.points[0];
      stroke.points.push([x + 0.3, y + 0.3, p]);
    }
    this.pushHistory();
    this.page.strokes.push(stroke);
    this.redraw();
    this.commit();
  }

  // ---- silgi ----

  eraseAt(point, starting) {
    if (starting) this.eraseSession = { removed: false, snapshot: this.snapshot() };
    const radius = 12;
    const before = this.page.strokes.length;
    this.page.strokes = this.page.strokes.filter((stroke) => !strokeHits(stroke, point, radius + stroke.width / 2));
    if (this.page.strokes.length !== before) {
      if (!this.eraseSession.removed) {
        this.undoStack.push(this.eraseSession.snapshot);
        if (this.undoStack.length > HISTORY_LIMIT) this.undoStack.shift();
        this.redoStack = [];
      }
      this.eraseSession.removed = true;
      this.redraw();
    }
  }

  // ---- geri al / ileri al ----

  snapshot() {
    return this.page.strokes.slice();
  }

  pushHistory() {
    this.undoStack.push(this.snapshot());
    if (this.undoStack.length > HISTORY_LIMIT) this.undoStack.shift();
    this.redoStack = [];
  }

  get canUndo() { return this.undoStack.length > 0; }
  get canRedo() { return this.redoStack.length > 0; }

  undo() {
    if (!this.canUndo) return;
    this.redoStack.push(this.snapshot());
    this.page.strokes = this.undoStack.pop();
    this.redraw();
    this.commit();
  }

  redo() {
    if (!this.canRedo) return;
    this.undoStack.push(this.snapshot());
    this.page.strokes = this.redoStack.pop();
    this.redraw();
    this.commit();
  }

  commit() {
    if (this.options.onChange) this.options.onChange();
  }

  // ---- çizim ----

  redraw() {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.page.size.w, this.page.size.h);
    for (const stroke of this.page.strokes) drawStroke(ctx, stroke);
  }

  drawSegment(stroke, fromIndex) {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    drawStroke(ctx, stroke, Math.max(0, fromIndex - 1));
  }
}

function styleFor(ctx, stroke) {
  ctx.lineCap = stroke.tool === "highlighter" ? "butt" : "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = stroke.color;
  ctx.globalAlpha = stroke.tool === "highlighter" ? 0.38 : stroke.tool === "pencil" ? 0.82 : 1;
  ctx.globalCompositeOperation = stroke.tool === "highlighter" ? "multiply" : "source-over";
}

function widthAt(stroke, pressure) {
  if (stroke.tool === "highlighter") return stroke.width * 2.4;
  if (stroke.tool === "pencil") return stroke.width * (0.7 + pressure * 0.6);
  return stroke.width * (0.55 + pressure * 0.9);
}

/** Çizgiyi noktaların orta noktalarından geçen eğrilerle çizer; kalınlık basınca göre segment segment değişir. */
export function drawStroke(ctx, stroke, fromIndex = 0) {
  const pts = stroke.points;
  if (pts.length < 2) return;
  styleFor(ctx, stroke);
  for (let i = Math.max(1, fromIndex); i < pts.length; i++) {
    const p0 = pts[i - 1];
    const p1 = pts[i];
    const prev = pts[i - 2] || p0;
    const m0 = [(prev[0] + p0[0]) / 2, (prev[1] + p0[1]) / 2];
    const m1 = [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2];
    ctx.lineWidth = widthAt(stroke, (p0[2] + p1[2]) / 2);
    ctx.beginPath();
    ctx.moveTo(m0[0], m0[1]);
    ctx.quadraticCurveTo(p0[0], p0[1], m1[0], m1[1]);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
}

/** Sayfayı küçük bir görsele çevirir (sayfa ızgarası ve şerit için). */
export function renderStrokesToDataURL(page, pixelWidth) {
  const scale = pixelWidth / page.size.w;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(page.size.w * scale);
  canvas.height = Math.round(page.size.h * scale);
  const ctx = canvas.getContext("2d");
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  for (const stroke of page.strokes) drawStroke(ctx, stroke);
  return canvas.toDataURL("image/png");
}

function strokeHits(stroke, point, radius) {
  const [x, y] = point;
  const pts = stroke.points;
  for (let i = 0; i < pts.length; i++) {
    if (Math.hypot(pts[i][0] - x, pts[i][1] - y) <= radius) return true;
    if (i > 0 && segmentDistance(pts[i - 1], pts[i], x, y) <= radius) return true;
  }
  return false;
}

function segmentDistance(a, b, x, y) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const lengthSq = dx * dx + dy * dy;
  let t = lengthSq === 0 ? 0 : ((x - a[0]) * dx + (y - a[1]) * dy) / lengthSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(a[0] + t * dx - x, a[1] + t * dy - y);
}
