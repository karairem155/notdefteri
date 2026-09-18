// Çizim motoru. PencilKit yerine: Pointer Events + canvas.
// - Kalınlık varsayılan olarak sabittir; "Basınca duyarlı kalınlık" ayarı açılırsa Apple Pencil basıncı yansır.
// - Noktalar hafifçe yumuşatılır, çizgi tek parça eğri olarak çizilir: titreme ve üst üste binme olmaz.
// - Parmak: ayara göre sayfa çevirir, çizer ya da siler. Kalem her zaman çizer.
// - Silgi: "çizgi" kipinde dokunulan çizgi bütünüyle, "normal" kipinde yalnız dokunulan parça silinir.
// - Kement: seçilen çizgiler taşınır, büyütülür, döndürülür, kopyalanır, silinir.
// - Cetvel: cetvel açıkken kenarına yakın başlayan çizgi cetvele yapışır.
// - Şekil düzeltme: çizgiyi bitirmeden parmağı/kalemi kısa süre sabit tutunca çizgi/daire/dikdörtgen olur.
// - PDF metni: fosforlu ya da altı çizme, PDF'teki satıra hizalanır (options.textLines).
// - Geri al / ileri al sayfa başına tutulur.
import { uid } from "./store.js";

const HISTORY_LIMIT = 60;
const SMOOTH_LEVELS = [0, 0.35, 0.55, 0.78];   // Kapalı, Az, Orta, Çok
const MIN_STEP = 1.2;        // bu kadar ilerlemeyen nokta atlanır (sayfa px, 1x görünümde)
const PIXEL_BUDGET = 14e6;   // bir sayfa tuvali için en çok piksel (bellek sınırı)
const MAX_SIDE = 4000;       // iOS'ta bir tuvalin kenarı 4096'yı aşamaz; aşarsa tuval boş kalır
const HOLD_MS = 600;         // şekil düzeltme için sabit tutma süresi
const HOLD_TOLERANCE = 9;    // bu kadar ilerlemeyen hareket "duruyor" sayılır (px)

export class InkCanvas {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {object} page - store'daki sayfa nesnesi (strokes dizisi yerinde değişir)
   * @param {object} options - { getTool, fingerAction, pressureWidth, eraser, shapeRecognition, ruler, textLines, onChange, toPageCoords, neighborFor, onSelection }
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
    this.selection = null;       // { ids: Set }
    this.lasso = null;           // canlı kement noktaları
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

  fingerAction() {
    return this.options.fingerAction ? this.options.fingerAction() : "navigate";
  }

  accepts(e) {
    if (e.pointerType === "touch" && this.fingerAction() === "navigate") return false;
    if (e.pointerType === "mouse" && e.buttons !== 1) return false;
    return true;
  }

  /** Bu dokunuş için etkin araç: parmak silgi ayarındaysa parmak siler, kalem çizer. */
  toolFor(e) {
    const tool = this.options.getTool();
    if (e.pointerType === "touch" && this.fingerAction() === "erase" && tool.tool !== "lasso") return { ...tool, tool: "eraser" };
    return tool;
  }

  rawPoint(e) {
    const p = this.options.toPageCoords(e);
    const pressure = e.pointerType === "pen" ? Math.max(0.05, e.pressure || 0.5) : 0.5;
    return [p.x, p.y, pressure];
  }

  onDown(e) {
    if (!this.accepts(e) || this.activePointer !== null) return;
    const tool = this.toolFor(e);
    if (!tool || tool.tool === "frosted") return;
    this.activePointer = e.pointerId;
    this.activeTool = tool.tool;
    try { this.canvas.setPointerCapture(e.pointerId); } catch (_) { /* sentetik olaylarda yakalama olmayabilir */ }
    e.preventDefault();
    const p = this.rawPoint(e);
    if (tool.tool === "eraser") {
      const prefs = this.options.eraser ? this.options.eraser() : {};
      if (prefs.mode === "area") { this.areaErase = [p[0], p[1]]; this.lasso = [[p[0], p[1]]]; this.redrawWithLive(); return; }
      this.eraseAt(p, true);
      return;
    }
    if (tool.tool === "shape") {
      this.shapeStart = [p[0], p[1]];
      this.shapeKind = tool.shape || "line";
      this.strokeStyle = { tool: "pen", color: tool.color, width: tool.width, pressure: false, alpha: tool.alpha == null ? 1 : tool.alpha };
      this.rulerLine = null;
      this.textLine = null;
      this.liveTarget = this;
      this.startExternalLive(this.strokeStyle, round(p));
      return;
    }
    if (tool.tool === "lasso") {
      this.clearSelection();
      this.lasso = [[p[0], p[1]]];
      this.redrawWithLive();
      return;
    }
    const usePressure = this.options.pressureWidth ? this.options.pressureWidth() : false;
    this.strokeStyle = { tool: tool.tool, color: tool.color, width: tool.width, pressure: usePressure, alpha: tool.alpha == null ? 1 : tool.alpha };
    this.smooth = [p[0], p[1]];
    this.smoothing = SMOOTH_LEVELS[Math.min(3, Math.max(0, this.options.smoothing ? Number(this.options.smoothing()) : 2))] || 0;
    this.rulerLine = this.rulerFor(p);
    this.textLine = this.rulerLine ? null : this.textLineFor(p, tool);
    this.liveTarget = this;
    this.startExternalLive(this.strokeStyle, round(this.snap(p)));
    this.armHold();
  }

  onMove(e) {
    if (e.pointerId !== this.activePointer) return;
    e.preventDefault();
    if (this.activeTool === "eraser") {
      if (this.areaErase) {
        const p = this.rawPoint(e);
        const [x0, y0] = this.areaErase;
        this.lasso = [[x0, y0], [p[0], y0], [p[0], p[1]], [x0, p[1]]];
        this.redrawWithLive();
        return;
      }
      this.eraseAt(this.rawPoint(e), false);
      return;
    }
    if (this.activeTool === "shape") {
      if (!this.live) return;
      const p = this.rawPoint(e);
      const snap = this.options.rulerSnap ? this.options.rulerSnap() !== false : true;
      this.live.points = shapePoints(this.shapeKind, this.shapeStart, [p[0], p[1]], snap);
      this.redrawWithLive();
      return;
    }
    if (this.activeTool === "lasso") {
      const p = this.rawPoint(e);
      const last = this.lasso[this.lasso.length - 1];
      if (Math.hypot(p[0] - last[0], p[1] - last[1]) >= 2) { this.lasso.push([p[0], p[1]]); this.redrawWithLive(); }
      return;
    }
    if (!this.liveTarget) return;
    // Birleştirilmiş olaylar boş dönerse (bazı tarayıcılar / sentetik olaylar) olayın kendisi kullanılır.
    const coalesced = e.getCoalescedEvents ? e.getCoalescedEvents() : [];
    const events = coalesced && coalesced.length ? coalesced : [e];
    const touched = new Set();
    for (const ev of events) {
      const raw = this.rawPoint(ev);
      // Üstel yumuşatma: el titremesi ve sensör gürültüsü azalır.
      this.smooth[0] += (raw[0] - this.smooth[0]) * (1 - this.smoothing);
      this.smooth[1] += (raw[1] - this.smooth[1]) * (1 - this.smoothing);
      const snapped = this.snap([this.smooth[0], this.smooth[1], raw[2]]);
      const sx = snapped[0];
      const sy = snapped[1];
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
      if (target.addLivePoint(round([sx + offset, sy, raw[2]]))) { touched.add(target); this.rearmHoldIfMoved([sx + offset, sy]); }
    }
    for (const t of touched) t.redrawWithLive();
  }

  onUp(e) {
    if (e.pointerId !== this.activePointer) return;
    this.activePointer = null;
    this.disarmHold();
    try { this.canvas.releasePointerCapture(e.pointerId); } catch (_) { /* yok sayılır */ }
    if (this.activeTool === "eraser") {
      if (this.areaErase) {
        this.areaErase = null;
        this.finishLasso(true);
        if (this.selection) this.deleteSelection();
        if (this.options.onEraseEnd && e.pointerType !== "touch") this.options.onEraseEnd();
        return;
      }
      if (this.eraseSession && this.eraseSession.removed) this.commit();
      this.eraseSession = null;
      if (this.options.onEraseEnd && e.pointerType !== "touch") this.options.onEraseEnd();
      return;
    }
    if (this.activeTool === "lasso") {
      this.finishLasso();
      return;
    }
    if (!this.liveTarget) return;
    this.liveTarget.finishLive();
    this.liveTarget = null;
  }

  // ---- cetvel ve PDF satırı ----

  rulerFor(p) {
    const ruler = this.options.ruler ? this.options.ruler() : null;
    if (!ruler) return null;
    if (this.options.rulerSnap && this.options.rulerSnap() === false) return null;
    // Cetvelin çizim kenarı: merkezden geçen, açısı ruler.angle olan doğru; kenara 40 px'e kadar yakınlık yapışır.
    const angle = ruler.angle * Math.PI / 180;
    const dir = { x: Math.cos(angle), y: Math.sin(angle) };
    const normal = { x: -dir.y, y: dir.x };
    const edge = { x: ruler.x + normal.x * ruler.edgeOffset, y: ruler.y + normal.y * ruler.edgeOffset };
    const dist = Math.abs((p[0] - edge.x) * normal.x + (p[1] - edge.y) * normal.y);
    if (dist > 40) return null;
    return { edge, dir };
  }

  /** PDF sayfasında fosforlu: satırın ortasına, kalem: satırın altına hizalanır. */
  textLineFor(p, tool) {
    if (!this.options.textLines || (tool.tool !== "highlighter" && tool.tool !== "pen" && tool.tool !== "fineliner")) return null;
    const lines = this.options.textLines();
    if (!lines || !lines.length) return null;
    let best = null;
    for (const line of lines) {
      if (p[0] < line.x - 6 || p[0] > line.x + line.w + 6) continue;
      const y = tool.tool === "highlighter" ? line.y + line.h / 2 : line.y + line.h * 0.95;
      const d = Math.abs(p[1] - y);
      if (d < line.h * 0.9 && (!best || d < best.d)) best = { d, y, line };
    }
    if (!best) return null;
    return { y: best.y, x0: best.line.x, x1: best.line.x + best.line.w, width: tool.tool === "highlighter" ? best.line.h / 2.4 : null };
  }

  snap(p) {
    if (this.rulerLine) {
      const { edge, dir } = this.rulerLine;
      const t = (p[0] - edge.x) * dir.x + (p[1] - edge.y) * dir.y;
      return [edge.x + dir.x * t, edge.y + dir.y * t, p[2]];
    }
    if (this.textLine) {
      return [Math.min(Math.max(p[0], this.textLine.x0), this.textLine.x1), this.textLine.y, p[2]];
    }
    return p;
  }

  // ---- şekil düzeltme (sabit tutunca) ----

  /** Kalem gerçekten ilerlediyse sayacı sıfırlar; el titremesi şekle dönüşmeyi engellemez. */
  rearmHoldIfMoved(point) {
    if (!this.holdOrigin) { this.armHold(); return; }
    if (Math.hypot(point[0] - this.holdOrigin[0], point[1] - this.holdOrigin[1]) > HOLD_TOLERANCE) this.armHold();
  }

  armHold() {
    this.disarmHold();
    const delay = this.options.holdDelay ? Number(this.options.holdDelay()) : HOLD_MS;
    if (!delay) return;
    if (!(this.options.shapeRecognition && this.options.shapeRecognition())) return;
    if (this.rulerLine || this.textLine) return;
    if (this.liveTarget && this.liveTarget.live && this.liveTarget.live.shape) return;
    const livePts = this.liveTarget && this.liveTarget.live ? this.liveTarget.live.points : null;
    this.holdOrigin = livePts && livePts.length ? [livePts[livePts.length - 1][0], livePts[livePts.length - 1][1]] : null;
    this.holdTimer = setTimeout(() => {
      this.holdTimer = null;
      const target = this.liveTarget;
      if (!target || !target.live || target.live.points.length < 6) return;
      const raw = target.live.points;
      const handle = raw[raw.length - 1];
      const shape = recognizeShape(raw);
      if (!shape) return;
      const box = bounds(shape);
      const anchor = shape.length === 2
        ? [shape[0][0], shape[0][1]]
        : [Math.abs(handle[0] - box.minX) > Math.abs(handle[0] - box.maxX) ? box.minX : box.maxX,
           Math.abs(handle[1] - box.minY) > Math.abs(handle[1] - box.maxY) ? box.minY : box.maxY];
      target.live.points = shape;
      target.live.shape = true;
      target.live.shapeBase = shape.map((q) => q.slice());
      target.live.shapeHandle = [handle[0], handle[1]];
      target.live.shapeAnchor = anchor;
      target.live.shapeUniform = !!shape.uniform;
      target.redrawWithLive();
      if (navigator.vibrate) navigator.vibrate(10);
    }, delay);
  }

  disarmHold() {
    if (this.holdTimer) { clearTimeout(this.holdTimer); this.holdTimer = null; }
    this.holdOrigin = null;
  }

  // ---- canlı çizgi (kendi tuvali ya da komşu sayfadan devralınan) ----

  startExternalLive(style, firstPoint) {
    const width = this.textLine && this.textLine.width ? this.textLine.width / 2.4 : style.width;
    this.live = { id: uid(), tool: style.tool, color: style.color, width, pressure: style.pressure, points: [firstPoint] };
    if (style.alpha != null && style.alpha < 1) this.live.alpha = style.alpha;
  }

  /** Nokta ekler; eklendiyse true. Şekle dönüştürülmüş çizgiye nokta eklenince serbest çizime dönülür. */
  addLivePoint(p) {
    if (!this.live) return false;
    if (this.live.shape) {
      // Şekle dönüşmüş çizgi: kalem hâlâ basılıyken sürüklemek şekli büyütür/küçültür.
      const { shapeBase, shapeAnchor: a, shapeHandle: hd } = this.live;
      if (Math.hypot(p[0] - hd[0], p[1] - hd[1]) < 1.5) return false;
      if (shapeBase.length === 2) { this.live.points = [shapeBase[0], [p[0], p[1], shapeBase[0][2]]]; return true; }
      const dx = hd[0] - a[0];
      const dy = hd[1] - a[1];
      let sx = Math.abs(dx) > 10 ? (p[0] - a[0]) / dx : 1;
      let sy = Math.abs(dy) > 10 ? (p[1] - a[1]) / dy : 1;
      if (this.live.shapeUniform) { const u = (Math.abs(sx) + Math.abs(sy)) / 2; sx = Math.sign(sx || 1) * u; sy = Math.sign(sy || 1) * u; }
      this.live.points = shapeBase.map((q) => [a[0] + (q[0] - a[0]) * sx, a[1] + (q[1] - a[1]) * sy, q[2]]);
      return true;
    }
    const last = this.live.points[this.live.points.length - 1];
    if (Math.hypot(p[0] - last[0], p[1] - last[1]) < (this.minStep || MIN_STEP)) return false;
    this.live.points.push(p);
    return true;
  }

  finishLive() {
    if (!this.live) return;
    const stroke = this.live;
    this.live = null;
    // Örnekleme titremesini at: çizginin biçimi değişmez, görüntü temizlenir.
    if (!stroke.shape && stroke.points.length > 8 && stroke.points.length < 4000) {
      const eps = Math.max(0.12, 0.35 / Math.max(1, this.viewScale || 1));   // yakınken daha az sadeleştir
      stroke.points = simplify(stroke.points, eps);
    }
    delete stroke.shape;
    delete stroke.shapeBase;
    delete stroke.shapeHandle;
    delete stroke.shapeAnchor;
    delete stroke.shapeUniform;
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
    const prefs = this.options.eraser ? this.options.eraser() : { mode: "stroke", size: 12 };
    const radius = (prefs.size || 12) * (prefs.pressureSize ? 0.4 + (point[2] || 0.5) * 1.2 : 1);
    const skip = (stroke) => prefs.onlyHighlighter && stroke.tool !== "highlighter";
    const before = this.page.strokes;
    let after;
    if (prefs.mode === "pixel") {
      after = [];
      for (const stroke of before) {
        if (skip(stroke) || !strokeHits(stroke, point, radius + stroke.width / 2)) { after.push(stroke); continue; }
        for (const piece of cutStroke(stroke, point, radius + stroke.width / 2)) after.push(piece);
      }
    } else {
      after = before.filter((stroke) => skip(stroke) || !strokeHits(stroke, point, radius + stroke.width / 2));
    }
    if (after.length !== before.length || after.some((s, i) => s !== before[i])) {
      if (!this.eraseSession.removed) {
        this.undoStack.push(this.eraseSession.snapshot);
        if (this.undoStack.length > HISTORY_LIMIT) this.undoStack.shift();
        this.redoStack = [];
      }
      this.eraseSession.removed = true;
      this.page.strokes = after;
      this.redraw();
    }
  }

  // ---- kement seçimi ----

  finishLasso(silent = false) {
    const polygon = this.lasso;
    this.lasso = null;
    if (!polygon || polygon.length < 3) { this.redraw(); return; }
    const ids = new Set();
    for (const stroke of this.page.strokes) {
      let inside = 0;
      for (const p of stroke.points) if (pointInPolygon(p, polygon)) inside++;
      if (inside >= Math.max(1, stroke.points.length * 0.5)) ids.add(stroke.id);
    }
    if (ids.size) this.selection = { ids };
    this.redraw();
    if (this.options.onSelection && !silent) this.options.onSelection(this.selectionBounds());
  }

  selectedStrokes() {
    if (!this.selection) return [];
    return this.page.strokes.filter((s) => this.selection.ids.has(s.id));
  }

  selectionBounds() {
    const strokes = this.selectedStrokes();
    if (!strokes.length) return null;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const s of strokes) for (const p of s.points) {
      minX = Math.min(minX, p[0]); minY = Math.min(minY, p[1]); maxX = Math.max(maxX, p[0]); maxY = Math.max(maxY, p[1]);
    }
    const pad = 10;
    return { x: minX - pad, y: minY - pad, w: maxX - minX + pad * 2, h: maxY - minY + pad * 2 };
  }

  clearSelection() {
    if (!this.selection) return;
    this.selection = null;
    this.redraw();
    if (this.options.onSelection) this.options.onSelection(null);
  }

  /** Seçimi dönüştürür: önce ölçek ve döndürme merkez etrafında, sonra taşıma. */
  transformSelection({ dx = 0, dy = 0, scale = 1, rotate = 0, center }) {
    const strokes = this.selectedStrokes();
    if (!strokes.length) return;
    const rad = rotate * Math.PI / 180;
    const cos = Math.cos(rad), sin = Math.sin(rad);
    for (const stroke of strokes) {
      stroke.points = stroke.points.map(([x, y, p]) => {
        let px = x - center.x, py = y - center.y;
        px *= scale; py *= scale;
        const rx = px * cos - py * sin;
        const ry = px * sin + py * cos;
        return [Math.round((rx + center.x + dx) * 10) / 10, Math.round((ry + center.y + dy) * 10) / 10, p];
      });
      if (scale !== 1) stroke.width = Math.max(0.5, Math.round(stroke.width * scale * 10) / 10);
    }
    this.redraw();
  }

  beginSelectionEdit() {
    this.pushHistory();
    // Geri al'ın çalışması için çizgiler kopyalanır; yerinde değişen noktalar eski kopyaya dokunmaz.
    this.page.strokes = this.page.strokes.map((s) => (this.selection && this.selection.ids.has(s.id) ? { ...s, points: s.points.slice() } : s));
    this.editBase = new Map(this.selectedStrokes().map((s) => [s.id, { points: s.points.map((p) => p.slice()), width: s.width }]));
  }

  /** Düzenleme başındaki hâle göre toplam dönüşümü uygular (canlı sürükleme için). */
  applySelectionTransform(transform) {
    if (!this.editBase) this.beginSelectionEdit();
    for (const stroke of this.selectedStrokes()) {
      const base = this.editBase.get(stroke.id);
      if (!base) continue;
      stroke.points = base.points.map((p) => p.slice());
      stroke.width = base.width;
    }
    this.transformSelection(transform);
  }

  deleteSelection() {
    if (!this.selection) return;
    this.pushHistory();
    this.page.strokes = this.page.strokes.filter((s) => !this.selection.ids.has(s.id));
    this.selection = null;
    this.redraw();
    this.commit();
    if (this.options.onSelection) this.options.onSelection(null);
  }

  duplicateSelection() {
    const strokes = this.selectedStrokes();
    if (!strokes.length) return;
    this.pushHistory();
    const copies = strokes.map((s) => ({ ...s, id: uid(), points: s.points.map(([x, y, p]) => [x + 24, y + 24, p]) }));
    this.page.strokes.push(...copies);
    this.selection = { ids: new Set(copies.map((c) => c.id)) };
    this.redraw();
    this.commit();
    if (this.options.onSelection) this.options.onSelection(this.selectionBounds());
  }

  recolorSelection(hex) {
    const strokes = this.selectedStrokes();
    if (!strokes.length) return;
    this.pushHistory();
    this.page.strokes = this.page.strokes.map((s) => (this.selection.ids.has(s.id) ? { ...s, color: hex } : s));
    this.redraw();
    this.commit();
  }

  bringSelectionFront() {
    const strokes = this.selectedStrokes();
    if (!strokes.length) return;
    this.pushHistory();
    this.page.strokes = this.page.strokes.filter((s) => !this.selection.ids.has(s.id)).concat(strokes);
    this.redraw();
    this.commit();
  }

  sendSelectionBack() {
    const strokes = this.selectedStrokes();
    if (!strokes.length) return;
    this.pushHistory();
    this.page.strokes = strokes.concat(this.page.strokes.filter((s) => !this.selection.ids.has(s.id)));
    this.redraw();
    this.commit();
  }

  clearPage() {
    if (!this.page.strokes.length) return;
    this.pushHistory();
    this.page.strokes = [];
    this.selection = null;
    this.redraw();
    this.commit();
    if (this.options.onSelection) this.options.onSelection(null);
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
    this.selection = null;
    if (this.options.onSelection) this.options.onSelection(null);
    this.redraw();
    this.commit();
  }

  redo() {
    if (!this.canRedo) return;
    this.undoStack.push(this.snapshot());
    this.page.strokes = this.redoStack.pop();
    this.selection = null;
    if (this.options.onSelection) this.options.onSelection(null);
    this.redraw();
    this.commit();
  }

  commit() {
    this.editBase = null;
    if (this.options.onChange) this.options.onChange();
  }

  // ---- çizim ----

  /** Tuval çözünürlüğü: yakınlaştırınca çizgiler bulanıklaşmasın diye ekran ölçeğine uyar (en çok 3x). */
  /** Ekrandaki gerçek ölçeğe göre tuval çözünürlüğü: yakınlaşınca yazı keskin kalır. */
  setResolution(scale) {
    this.viewScale = Math.max(0.2, scale || 1);
    // Yakınlaşınca daha sık nokta al: 1 ekran pikselinden kısa adımlar atlanmasın.
    this.minStep = Math.max(0.15, Math.min(MIN_STEP, 1 / this.viewScale));
    const wanted = (window.devicePixelRatio || 1) * Math.max(1, this.viewScale);
    const budget = Math.sqrt(PIXEL_BUDGET / Math.max(1, this.page.size.w * this.page.size.h));
    const side = Math.min(MAX_SIDE / this.page.size.w, MAX_SIDE / this.page.size.h);
    const dpr = Math.max(0.5, Math.min(wanted, budget, side));
    if (Math.abs(dpr - this.dpr) < 0.05) return;
    this.dpr = dpr;
    this.canvas.width = Math.round(this.page.size.w * dpr);
    this.canvas.height = Math.round(this.page.size.h * dpr);
    this.redraw();
  }

  redraw() {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.page.size.w, this.page.size.h);
    const selected = this.selection ? this.selection.ids : null;
    // Fosforlu çizgiler yazının altında kalsın diye önce çizilir.
    for (const stroke of orderForDrawing(this.page.strokes)) {
      if (selected && selected.has(stroke.id)) drawHighlight(ctx, stroke);
      drawStroke(ctx, stroke);
    }
  }

  /** Canlı çizgi tek parça çizildiği için her harekette baştan çizilir; sayfa çizimleri az olduğundan ucuzdur. */
  redrawWithLive() {
    this.redraw();
    if (this.live) drawStroke(this.ctx, this.live);
    if (this.lasso && this.lasso.length > 1) {
      const ctx = this.ctx;
      ctx.save();
      ctx.setLineDash([6, 5]);
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = "#5d58d6";
      ctx.fillStyle = "rgba(93,88,214,0.08)";
      ctx.beginPath();
      ctx.moveTo(this.lasso[0][0], this.lasso[0][1]);
      for (const p of this.lasso) ctx.lineTo(p[0], p[1]);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }
}

function round(p) {
  return [Math.round(p[0] * 10) / 10, Math.round(p[1] * 10) / 10, Math.round(p[2] * 100) / 100];
}

function styleFor(ctx, stroke) {
  ctx.lineCap = stroke.tool === "highlighter" ? "butt" : "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = stroke.color;
  const base = stroke.tool === "highlighter" ? 0.42 : stroke.tool === "pencil" ? 0.93 : 1;
  ctx.globalAlpha = stroke.alpha != null ? base * stroke.alpha : base;
  ctx.globalCompositeOperation = "source-over";
}

function baseWidth(stroke) {
  return stroke.tool === "highlighter" ? stroke.width * 2.4 : stroke.width;
}

function widthAt(stroke, pressure) {
  const w = baseWidth(stroke);
  if (!stroke.pressure || stroke.tool === "highlighter") return w;
  return w * (0.6 + pressure * 0.8);
}

/** Noktaların tam üstünden geçen yumuşak eğri (Catmull-Rom -> Bezier). El yazısı köşeli görünmez. */
function curveThrough(ctx, pts, move) {
  if (move) ctx.moveTo(pts[0][0], pts[0][1]);
  else ctx.lineTo(pts[0][0], pts[0][1]);
  if (pts.length === 2) { ctx.lineTo(pts[1][0], pts[1][1]); return; }
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    ctx.bezierCurveTo(
      p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6,
      p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6,
      p2[0], p2[1]);
  }
}

function tracePath(ctx, pts) {
  ctx.beginPath();
  curveThrough(ctx, pts, true);
}

/** Basınçlı çizgi: dilim dilim değil, tek parça dolgu. Kalınlık yumuşak değişir, uçlar incelir. */
function drawPressureStroke(ctx, stroke) {
  const pts = stroke.points;
  const n = pts.length;
  const rad = new Array(n);
  for (let i = 0; i < n; i++) {
    let sum = 0;
    let count = 0;
    for (let k = Math.max(0, i - 3); k <= Math.min(n - 1, i + 3); k++) { sum += pts[k][2] == null ? 0.5 : pts[k][2]; count++; }
    rad[i] = widthAt(stroke, sum / count) / 2;
  }
  const taper = Math.min(5, Math.floor(n / 4));
  for (let i = 0; i < taper; i++) {
    const f = 0.5 + 0.5 * (i / taper);
    rad[i] *= f;
    rad[n - 1 - i] *= f;
  }
  const left = [];
  const right = [];
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(n - 1, i + 1)];
    let dx = b[0] - a[0];
    let dy = b[1] - a[1];
    const len = Math.hypot(dx, dy);
    if (!len) { dx = 1; dy = 0; } else { dx /= len; dy /= len; }
    left.push([pts[i][0] - dy * rad[i], pts[i][1] + dx * rad[i]]);
    right.push([pts[i][0] + dy * rad[i], pts[i][1] - dx * rad[i]]);
  }
  right.reverse();
  ctx.fillStyle = stroke.color;
  ctx.beginPath();
  curveThrough(ctx, left, true);
  curveThrough(ctx, right, false);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.arc(pts[0][0], pts[0][1], rad[0], 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(pts[n - 1][0], pts[n - 1][1], rad[n - 1], 0, Math.PI * 2);
  ctx.fill();
}

/** Çizgi: noktaların orta noktalarından geçen eğriler. Sabit kalınlıkta tek yol, basınçlıysa segment segment. */
export function drawStroke(ctx, stroke) {
  const pts = stroke.points;
  if (pts.length < 2) return;
  styleFor(ctx, stroke);
  if (!stroke.pressure || stroke.tool === "highlighter") {
    ctx.lineWidth = baseWidth(stroke);
    tracePath(ctx, pts);
    ctx.stroke();
  } else if (pts.length < 3) {
    ctx.lineWidth = widthAt(stroke, pts[0][2]);
    tracePath(ctx, pts);
    ctx.stroke();
  } else {
    drawPressureStroke(ctx, stroke);
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
}

function drawHighlight(ctx, stroke) {
  if (stroke.points.length < 2) return;
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = "rgba(242,122,176,0.4)";
  ctx.lineWidth = baseWidth(stroke) + 8;
  tracePath(ctx, stroke.points);
  ctx.stroke();
  ctx.restore();
}

/** Sayfayı küçük bir görsele çevirir (sayfa ızgarası, şerit ve sayfa çevirme için). */
export function renderStrokesToDataURL(page, pixelWidth) {
  const scale = pixelWidth / page.size.w;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(page.size.w * scale);
  canvas.height = Math.round(page.size.h * scale);
  const ctx = canvas.getContext("2d");
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  for (const stroke of orderForDrawing(page.strokes)) drawStroke(ctx, stroke);
  return canvas.toDataURL("image/png");
}

/** Fosforlular önce, sonra diğerleri; kendi içlerinde çizim sırası korunur. */
export function orderForDrawing(strokes) {
  const highlighters = [];
  const others = [];
  for (const s of strokes) (s.tool === "highlighter" ? highlighters : others).push(s);
  return highlighters.concat(others);
}

// ---- geometri yardımcıları ----

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

/** Normal silgi: yarıçap içindeki noktalar atılır, kalan parçalar ayrı çizgiler olur. */
function cutStroke(stroke, point, radius) {
  const pieces = [];
  let current = [];
  for (const p of stroke.points) {
    if (Math.hypot(p[0] - point[0], p[1] - point[1]) <= radius) {
      if (current.length >= 2) pieces.push(current);
      current = [];
    } else {
      current.push(p);
    }
  }
  if (current.length >= 2) pieces.push(current);
  return pieces.map((points, i) => ({ ...stroke, id: i === 0 ? stroke.id : uid(), points }));
}

function pointInPolygon(p, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0], yi = polygon[i][1];
    const xj = polygon[j][0], yj = polygon[j][1];
    const intersect = (yi > p[1]) !== (yj > p[1]) && p[0] < ((xj - xi) * (p[1] - yi)) / ((yj - yi) || 1e-9) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/** Çizgi, kırık çizgi, üçgen/dörtgen/çokgen, kare/dikdörtgen, daire/elips tanıma. Uymazsa null. */
export function recognizeShape(points) {
  const pts = points;
  const first = pts[0];
  const last = pts[pts.length - 1];
  const length = pathLength(pts);
  if (length < 20) return null;
  const chord = Math.hypot(last[0] - first[0], last[1] - first[1]);
  const pressure = first[2];

  // Düz çizgi: bütün noktalar kirişe yakın.
  let maxDeviation = 0;
  for (const p of pts) maxDeviation = Math.max(maxDeviation, segmentDistance(first, last, p[0], p[1]));
  if (chord > 0.85 * length && maxDeviation < Math.max(4, chord * 0.05)) {
    return [[first[0], first[1], pressure], [last[0], last[1], pressure]];
  }

  const eps = Math.max(5, length * 0.03);
  const closed = chord < Math.max(24, length * 0.18);
  if (!closed) {
    // Açık kırık çizgi: 2-5 uzun düz parça (L, V, zikzak, ok gövdesi...).
    const simple = simplify(pts, eps);
    if (simple.length >= 3 && simple.length <= 6) {
      const minSeg = Math.max(18, length * 0.12);
      let ok = true;
      for (let i = 1; i < simple.length; i++) if (Math.hypot(simple[i][0] - simple[i - 1][0], simple[i][1] - simple[i - 1][1]) < minSeg) ok = false;
      if (ok) { const out = simple.map((q) => [q[0], q[1], pressure]); snapEdges(out); return densify(out); }
    }
    return null;
  }

  const box = bounds(pts);
  const cx = (box.minX + box.maxX) / 2;
  const cy = (box.minY + box.maxY) / 2;
  const rx = (box.maxX - box.minX) / 2;
  const ry = (box.maxY - box.minY) / 2;
  if (rx < 8 || ry < 8) return null;

  // Kapalı çokgen: köşeleri sadeleştirilmiş yoldan al.
  let verts = simplify(pts.concat([[first[0], first[1], pressure]]), eps).slice(0, -1);
  while (verts.length > 1 && Math.hypot(verts[verts.length - 1][0] - verts[0][0], verts[verts.length - 1][1] - verts[0][1]) < eps * 2) verts.pop();
  if (verts.length >= 3 && verts.length <= 6) {
    if (verts.length === 4 && axisAligned(verts)) {
      let x0 = box.minX, x1 = box.maxX, y0 = box.minY, y1 = box.maxY;
      if (Math.abs(rx - ry) < 0.12 * Math.max(rx, ry)) { const r = (rx + ry) / 2; x0 = cx - r; x1 = cx + r; y0 = cy - r; y1 = cy + r; }   // kare
      return densify([[x0, y0, pressure], [x1, y0, pressure], [x1, y1, pressure], [x0, y1, pressure], [x0, y0, pressure]]);
    }
    const out = verts.map((q) => [q[0], q[1], pressure]);
    out.push([out[0][0], out[0][1], pressure]);
    snapEdges(out);
    return densify(out);
  }

  // Elips / daire: noktaların normalize yarıçapı 1'e yakın.
  let ellipseError = 0;
  for (const p of pts) {
    const r = Math.hypot((p[0] - cx) / rx, (p[1] - cy) / ry);
    ellipseError += Math.abs(r - 1);
  }
  ellipseError /= pts.length;
  if (ellipseError < 0.2) {
    const circle = Math.abs(rx - ry) < 0.15 * Math.max(rx, ry);
    const ex = circle ? (rx + ry) / 2 : rx;
    const ey = circle ? ex : ry;
    const out = [];
    const n = 48;
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2;
      out.push([Math.round((cx + Math.cos(a) * ex) * 10) / 10, Math.round((cy + Math.sin(a) * ey) * 10) / 10, pressure]);
    }
    out.uniform = circle;
    return out;
  }
  return null;
}

/** Şekil aracı: başlangıç ve uç noktadan hazır şekil üretir (çizgi, ok, dikdörtgen, daire, üçgen, yıldız). */
export function shapePoints(kind, a, b, snap) {
  const pr = 0.5;
  const [x0, y0] = a;
  let [x1, y1] = b;
  if (kind === "line" || kind === "arrow") {
    if (snap) {
      const ang = Math.atan2(y1 - y0, x1 - x0);
      const step = Math.PI / 12;
      const snapped = Math.round(ang / step) * step;
      if (Math.abs(snapped - ang) < 0.1) { const len = Math.hypot(x1 - x0, y1 - y0); x1 = x0 + Math.cos(snapped) * len; y1 = y0 + Math.sin(snapped) * len; }
    }
    const pts = [[x0, y0, pr], [x1, y1, pr]];
    if (kind === "arrow") {
      const ang = Math.atan2(y1 - y0, x1 - x0);
      const len = Math.hypot(x1 - x0, y1 - y0);
      const head = Math.min(44, Math.max(12, len * 0.22));
      const a1 = ang + Math.PI * 0.82, a2 = ang - Math.PI * 0.82;
      pts.push([x1 + Math.cos(a1) * head, y1 + Math.sin(a1) * head, pr], [x1, y1, pr], [x1 + Math.cos(a2) * head, y1 + Math.sin(a2) * head, pr]);
    }
    return densify(pts);
  }
  const minX = Math.min(x0, x1), maxX = Math.max(x0, x1), minY = Math.min(y0, y1), maxY = Math.max(y0, y1);
  if (kind === "rect") return densify([[minX, minY, pr], [maxX, minY, pr], [maxX, maxY, pr], [minX, maxY, pr], [minX, minY, pr]]);
  if (kind === "triangle") return densify([[(minX + maxX) / 2, minY, pr], [maxX, maxY, pr], [minX, maxY, pr], [(minX + maxX) / 2, minY, pr]]);
  if (kind === "star") {
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    const R = Math.max(1, Math.min(maxX - minX, maxY - minY) / 2);
    const r = R * 0.42;
    const pts = [];
    for (let i = 0; i <= 10; i++) {
      const ang = -Math.PI / 2 + i * Math.PI / 5;
      const rad = i % 2 === 0 ? R : r;
      pts.push([cx + Math.cos(ang) * rad, cy + Math.sin(ang) * rad, pr]);
    }
    return densify(pts);
  }
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  let rx = Math.max(1, (maxX - minX) / 2), ry = Math.max(1, (maxY - minY) / 2);
  if (snap && Math.abs(rx - ry) < 0.2 * Math.max(rx, ry)) { rx = ry = (rx + ry) / 2; }
  const out = [];
  const n = 64;
  for (let i = 0; i <= n; i++) { const t = (i / n) * Math.PI * 2; out.push([cx + Math.cos(t) * rx, cy + Math.sin(t) * ry, pr]); }
  return out;
}

/** Köşeler keskin kalsın diye kenarlara 3 px aralıkla ara nokta ekler (çizim yumuşatması köşeleri yuvarlamasın). */
function densify(out) {
  const dense = [out[0]];
  for (let i = 1; i < out.length; i++) {
    const p = out[i - 1];
    const q = out[i];
    const n = Math.max(1, Math.ceil(Math.hypot(q[0] - p[0], q[1] - p[1]) / 3));
    for (let k = 1; k <= n; k++) dense.push([p[0] + (q[0] - p[0]) * k / n, p[1] + (q[1] - p[1]) * k / n, q[2]]);
  }
  return dense;
}

/** Ramer-Douglas-Peucker sadeleştirme: eps'ten az sapan ara noktalar atılır. */
function simplify(pts, eps) {
  if (pts.length < 3) return pts.slice();
  const a = pts[0];
  const b = pts[pts.length - 1];
  let maxD = -1;
  let idx = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = segmentDistance(a, b, pts[i][0], pts[i][1]);
    if (d > maxD) { maxD = d; idx = i; }
  }
  if (maxD > eps) {
    const l = simplify(pts.slice(0, idx + 1), eps);
    const r = simplify(pts.slice(idx), eps);
    return l.slice(0, -1).concat(r);
  }
  return [a, b];
}

/** Dört kenar da yatay/dikeye 14° içinde mi? */
function axisAligned(verts) {
  for (let i = 0; i < verts.length; i++) {
    const p = verts[i];
    const q = verts[(i + 1) % verts.length];
    const deg = Math.abs(Math.atan2(q[1] - p[1], q[0] - p[0]) * 180 / Math.PI) % 90;
    if (Math.min(deg, 90 - deg) > 14) return false;
  }
  return true;
}

/** Yataya/dikeye 8° içindeki kenarları tam yatay/dikey yapar (üçgen tabanı, zikzak kolları). */
function snapEdges(out) {
  for (let i = 1; i < out.length; i++) {
    const p = out[i - 1];
    const q = out[i];
    const deg = Math.abs(Math.atan2(q[1] - p[1], q[0] - p[0]) * 180 / Math.PI);
    if (deg < 8 || deg > 172) { const y = (p[1] + q[1]) / 2; p[1] = y; q[1] = y; }
    else if (Math.abs(deg - 90) < 8) { const x = (p[0] + q[0]) / 2; p[0] = x; q[0] = x; }
  }
  if (out.length > 2 && out[0][0] === out[out.length - 1][0] && out[0][1] === out[out.length - 1][1]) return;
  if (out.length > 2 && Math.hypot(out[0][0] - out[out.length - 1][0], out[0][1] - out[out.length - 1][1]) < 0.01) return;
}

function pathLength(pts) {
  let total = 0;
  for (let i = 1; i < pts.length; i++) total += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return total;
}

function bounds(pts) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of pts) { minX = Math.min(minX, p[0]); minY = Math.min(minY, p[1]); maxX = Math.max(maxX, p[0]); maxY = Math.max(maxY, p[1]); }
  return { minX, minY, maxX, maxY };
}

/** Yön değişimlerini sayar: ardışık 12 px'lik adımlar arasında 60°'den keskin dönüşler köşe sayılır. */
function countCorners(pts) {
  const step = 12;
  const sampled = [pts[0]];
  for (const p of pts) {
    const last = sampled[sampled.length - 1];
    if (Math.hypot(p[0] - last[0], p[1] - last[1]) >= step) sampled.push(p);
  }
  let corners = 0;
  for (let i = 1; i < sampled.length - 1; i++) {
    const a = Math.atan2(sampled[i][1] - sampled[i - 1][1], sampled[i][0] - sampled[i - 1][0]);
    const b = Math.atan2(sampled[i + 1][1] - sampled[i][1], sampled[i + 1][0] - sampled[i][0]);
    let d = Math.abs(b - a);
    if (d > Math.PI) d = Math.PI * 2 - d;
    if (d > Math.PI / 3) corners++;
  }
  return corners;
}
