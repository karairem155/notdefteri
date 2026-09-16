// Çizim motoru. PencilKit yerine: Pointer Events + canvas.
// - Kalınlık varsayılan olarak sabittir; "Basınca duyarlı kalınlık" ayarı açılırsa Apple Pencil basıncı yansır.
// - Noktalar hafifçe yumuşatılır, çizgi tek parça eğri olarak çizilir: titreme ve üst üste binme olmaz.
// - "Sadece Apple Pencil" açıkken parmak dokunuşları çizmez (avuç reddi), parmak sayfa çevirir.
// - Silgi vektörel: dokunulan çizgi bütünüyle silinir.
// - Geri al / ileri al sayfa başına tutulur.
import { uid } from "./store.js";

const HISTORY_LIMIT = 60;
const SMOOTHING = 0.55;      // 0 = ham, 1 = çok gecikmeli
const MIN_STEP = 1.2;        // bu kadar ilerlemeyen nokta atlanır (px)

export class InkCanvas {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {object} page - store'daki sayfa nesnesi (strokes dizisi yerinde değişir)
   * @param {object} options - { getTool, pencilOnly, pressureWidth, onChange, toPageCoords }
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

  rawPoint(e) {
    const p = this.options.toPageCoords(e);
    const pressure = e.pointerType === "pen" ? Math.max(0.05, e.pressure || 0.5) : 0.5;
    return [p.x, p.y, pressure];
  }

  onDown(e) {
    if (!this.accepts(e) || this.activePointer !== null) return;
    const tool = this.options.getTool();
    if (!tool || tool.tool === "frosted") return;
    this.activePointer = e.pointerId;
    this.canvas.setPointerCapture(e.pointerId);
    e.preventDefault();
    const p = this.rawPoint(e);
    if (tool.tool === "eraser") {
      this.eraseAt(p, true);
      return;
    }
    const usePressure = this.options.pressureWidth ? this.options.pressureWidth() : false;
    this.strokeStyle = { tool: tool.tool, color: tool.color, width: tool.width, pressure: usePressure };
    this.smooth = [p[0], p[1]];
    this.liveTarget = this;
    this.startExternalLive(this.strokeStyle, round(p));
  }

  onMove(e) {
    if (e.pointerId !== this.activePointer) return;
    e.preventDefault();
    const tool = this.options.getTool();
    if (tool.tool === "eraser") {
      this.eraseAt(this.rawPoint(e), false);
      return;
    }
    if (!this.liveTarget) return;
    const events = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    const touched = new Set();
    for (const ev of events) {
      const raw = this.rawPoint(ev);
      // Üstel yumuşatma: el titremesi ve sensör gürültüsü azalır.
      this.smooth[0] += (raw[0] - this.smooth[0]) * (1 - SMOOTHING);
      this.smooth[1] += (raw[1] - this.smooth[1]) * (1 - SMOOTHING);
      const sx = this.smooth[0];
      const sy = this.smooth[1];
      // Çift sayfada çizgi ciltten öbür sayfaya geçer: orada yeni bir çizgi olarak devam eder.
      let target = this;
      let offset = 0;
      if (this.options.neighborFor && (sx < 0 || sx > this.page.size.w)) {
        const nb = this.options.neighborFor(sx < 0 ? -1 : 1);
        if (nb) { target = nb.ink; offset = nb.offset; }
      }
      if (target !== this.liveTarget) {
        this.liveTarget.finishLive();
        this.liveTarget = target;
        target.startExternalLive(this.strokeStyle, round([sx + offset, sy, raw[2]]));
        touched.add(target);
        continue;
      }
      if (target.addLivePoint(round([sx + offset, sy, raw[2]]))) touched.add(target);
    }
    for (const t of touched) t.redrawWithLive();
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
    if (!this.liveTarget) return;
    this.liveTarget.finishLive();
    this.liveTarget = null;
  }

  // ---- canlı çizgi (kendi tuvali ya da komşu sayfadan devralınan) ----

  startExternalLive(style, firstPoint) {
    this.live = { id: uid(), tool: style.tool, color: style.color, width: style.width, pressure: style.pressure, points: [firstPoint] };
  }

  /** Nokta ekler; eklendiyse true. */
  addLivePoint(p) {
    if (!this.live) return false;
    const last = this.live.points[this.live.points.length - 1];
    if (Math.hypot(p[0] - last[0], p[1] - last[1]) < MIN_STEP) return false;
    this.live.points.push(p);
    return true;
  }

  finishLive() {
    if (!this.live) return;
    const stroke = this.live;
    this.live = null;
    if (stroke.points.length === 1) {
      const [x, y, p] = stroke.points[0];
      stroke.points.push([x + 0.4, y + 0.4, p]);
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

  /** Canlı çizgi tek parça çizildiği için her harekette baştan çizilir; sayfa çizimleri az olduğundan ucuzdur. */
  redrawWithLive() {
    this.redraw();
    if (this.live) drawStroke(this.ctx, this.live);
  }
}

function round(p) {
  return [Math.round(p[0] * 10) / 10, Math.round(p[1] * 10) / 10, Math.round(p[2] * 100) / 100];
}

function styleFor(ctx, stroke) {
  ctx.lineCap = stroke.tool === "highlighter" ? "butt" : "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = stroke.color;
  ctx.globalAlpha = stroke.tool === "highlighter" ? 0.38 : stroke.tool === "pencil" ? 0.93 : 1;
  ctx.globalCompositeOperation = stroke.tool === "highlighter" ? "multiply" : "source-over";
}

function baseWidth(stroke) {
  return stroke.tool === "highlighter" ? stroke.width * 2.4 : stroke.width;
}

function widthAt(stroke, pressure) {
  const w = baseWidth(stroke);
  if (!stroke.pressure || stroke.tool === "highlighter") return w;
  return w * (0.6 + pressure * 0.8);
}

/** Çizgi: noktaların orta noktalarından geçen eğriler. Sabit kalınlıkta tek yol, basınçlıysa segment segment. */
export function drawStroke(ctx, stroke) {
  const pts = stroke.points;
  if (pts.length < 2) return;
  styleFor(ctx, stroke);
  if (!stroke.pressure || stroke.tool === "highlighter") {
    ctx.lineWidth = baseWidth(stroke);
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length - 1; i++) {
      const mx = (pts[i][0] + pts[i + 1][0]) / 2;
      const my = (pts[i][1] + pts[i + 1][1]) / 2;
      ctx.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
    }
    const last = pts[pts.length - 1];
    ctx.lineTo(last[0], last[1]);
    ctx.stroke();
  } else {
    for (let i = 1; i < pts.length; i++) {
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
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
}

/** Sayfayı küçük bir görsele çevirir (sayfa ızgarası, şerit ve sayfa çevirme için). */
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
