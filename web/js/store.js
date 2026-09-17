// Uygulama durumu ve kalıcılık. Veri modeli Swift sürümüyle aynı fikirde:
// her sayfa kendi şablonunu, boyutunu, çizimini, nesnelerini ve örtülerini taşır.
import { db } from "./db.js";

export const A4 = { w: 595, h: 842 };

export const PAGE_SIZES = {
  a4: { title: "A4", w: 595, h: 842 },
  letter: { title: "Letter", w: 612, h: 792 },
  square: { title: "Kare", w: 700, h: 700 },
  ipad: { title: "iPad ekranı", w: 768, h: 1024 }
};

export const PAPER_STYLES = {
  blank: "Boş",
  ruled: "Çizgili",
  grid: "Kareli",
  dotted: "Noktalı"
};

export const TOOLS = {
  pen: { title: "Kalem" },
  pencil: { title: "Kurşun Kalem" },
  highlighter: { title: "Fosforlu" },
  fineliner: { title: "Fineliner" },
  shape: { title: "Şekil" },
  eraser: { title: "Silgi" },
  lasso: { title: "Kement" },
  frosted: { title: "Buzlu Kalem" }
};

export const COVER_PRESETS = [
  { pattern: "hearts", color: "#F7C6D3" },
  { pattern: "gingham", color: "#F5DE8C" },
  { pattern: "grid", color: "#CFC6F2" },
  { pattern: "stars", color: "#B9E5CB" },
  { pattern: "lines", color: "#E9CFA0" },
  { pattern: "grid", color: "#BFD8F4" },
  { pattern: "dots", color: "#F3BFA9" }
];

export const COVER_TITLES = {
  hearts: "Kalpli", gingham: "Pötikare", grid: "Kareli", stars: "Yıldızlı", lines: "Çizgili", dots: "Puantiyeli", plain: "Düz"
};

const STARTER_PENS = [
  { id: "pen-1", tool: "pen", color: "#1C1C1E", width: 3, name: "Kalem" },
  { id: "pen-2", tool: "pen", color: "#C8352B", width: 5, name: "Kırmızı" },
  { id: "pen-3", tool: "highlighter", color: "#E0A81E", width: 14, name: "Fosforlu" },
  { id: "pen-4", tool: "pencil", color: "#3E6BB8", width: 4, name: "Kurşun" }
];

const STARTER_PALETTE = ["#1C1C1E", "#FFFFFF", "#E8862A", "#6BAF4A", "#A3B85C", "#3B7DD8", "#2BB5B5", "#C8352B", "#E0A81E", "#9B5BD8", "#E07AA8"];

const DEFAULT_SETTINGS = {
  pens: STARTER_PENS,
  defaultPenId: "pen-1",
  palette: STARTER_PALETTE,
  defaultCover: COVER_PRESETS[5],
  customCovers: [],          // asset kimlikleri
  templates: [],             // { id, name, asset }
  pageSize: "a4",
  newPageTemplate: null,     // null = son kullanılan; "builtin:ruled" | "custom:<id>"
  lastUsedTemplate: "builtin:ruled",
  pencilOnly: true,
  pressureWidth: false,      // Apple Pencil basıncı kalınlığa yansısın mı
  fingerAction: "navigate",  // parmak: "navigate" sayfa çevirir/kaydırır, "draw" çizer, "erase" siler
  eraser: { mode: "stroke", size: 12, onlyHighlighter: false, pressureSize: false },
  recentColors: [],          // son kullanılan renkler (Renk Seçici'de gösterilir)
  recentStickers: [],        // sık kullanılan çıkartmalar (emoji)
  rulerAngle: true,          // cetvelde açı rozeti
  rulerSnap: true,           // cetvele ve 15° açılara yapışma   // "stroke" dokunulan çizgiyi bütünüyle, "pixel" yalnız dokunulan parçayı siler
  shapeRecognition: true,
  smoothing: 2,              // çizgi yumuşatma: 0 kapalı, 1 az, 2 orta, 3 çok    // çizgiyi bitirmeden sabit tutunca şekle dönüşsün
  spreadMode: false,
  libraryShelf: true,
  folders: [],               // klasör adları; defter.folder bu adlardan birini tutar
  benchCollapsed: false,     // alt tezgahın kalem sırası gizli mi
  openModeByUser: false,    // kullanıcı açılış görünümünü kendisi seçti mi
  openMode: "fan",          // defter açılınca: "fan" açık defter yelpazesi (tasarım), "page" doğrudan sayfa
  frosted: { blur: 6, thickness: 28, revealOnTap: true }
};

export function uid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return "id-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
}

export function newPage(options = {}) {
  const size = options.size || PAGE_SIZES[DEFAULT_SETTINGS.pageSize];
  return {
    id: uid(),
    paper: options.paper || "ruled",
    templateAsset: options.templateAsset || null,
    pdf: options.pdf || null,          // { asset, index }
    size: { w: size.w, h: size.h },
    strokes: [],
    objects: [],
    covers: []
  };
}

export function newNotebook(title, cover) {
  const now = Date.now();
  return {
    id: uid(),
    title,
    createdAt: now,
    updatedAt: now,
    isFavourite: false,
    isTrashed: false,
    cover: cover || null,
    folder: null,
    pages: [newPage()]
  };
}

class Store extends EventTarget {
  constructor() {
    super();
    this.notebooks = [];
    this.settings = structuredClone(DEFAULT_SETTINGS);
    this.assetURLs = new Map();
    this.saveTimers = new Map();
    this.ready = false;
  }

  async load() {
    const [notebooks, settingsRows] = await Promise.all([db.getAll("notebooks"), db.getAll("settings")]);
    this.notebooks = notebooks.map(migrateNotebook).sort((a, b) => b.updatedAt - a.updatedAt);
    for (const row of settingsRows) {
      if (row.key in DEFAULT_SETTINGS) this.settings[row.key] = row.value;
    }
    // Kullanıcı kendisi seçmediyse tasarımdaki açılış (yelpaze) kullanılır.
    if (!this.settings.openModeByUser) this.settings.openMode = "fan";
    // Eski "Sadece Apple Pencil" ayarı kapatılmışsa parmak çizsin.
    if (this.settings.pencilOnly === false && !settingsRows.some((r) => r.key === "fingerAction")) this.settings.fingerAction = "draw";
    if (this.notebooks.length === 0) {
      const first = newNotebook("İlk Defterim", this.settings.defaultCover);
      this.notebooks.push(first);
      await db.put("notebooks", first);
    }
    this.ready = true;
    this.emit("change");
  }

  emit(type, detail) {
    this.dispatchEvent(new CustomEvent(type, { detail }));
  }

  // ---- defterler ----

  get activeNotebooks() {
    return this.notebooks.filter((n) => !n.isTrashed).sort((a, b) => {
      if (a.isFavourite !== b.isFavourite) return a.isFavourite ? -1 : 1;
      return b.updatedAt - a.updatedAt;
    });
  }

  get trashedNotebooks() {
    return this.notebooks.filter((n) => n.isTrashed).sort((a, b) => b.updatedAt - a.updatedAt);
  }

  notebook(id) {
    return this.notebooks.find((n) => n.id === id) || null;
  }

  page(notebookId, pageId) {
    const notebook = this.notebook(notebookId);
    return notebook ? notebook.pages.find((p) => p.id === pageId) || null : null;
  }

  createNotebook() {
    const notebook = newNotebook(`Defter ${this.notebooks.length + 1}`, this.settings.defaultCover);
    const template = this.initialTemplate();
    // Yeni defter üç sayfayla açılır; sonu gelince kendiliğinden eklenir.
    while (notebook.pages.length < 3) notebook.pages.push(newPage());
    for (const page of notebook.pages) {
      applyTemplate(page, template, this);
      page.size = { ...PAGE_SIZES[this.settings.pageSize] };
    }
    this.notebooks.push(notebook);
    this.persist(notebook, true);
    this.emit("change");
    return notebook.id;
  }

  /** Defteri değiştirir, kaydı planlar. `change(notebook)` içinde değişiklik yapılır. */
  mutate(notebookId, change, immediate = false) {
    const notebook = this.notebook(notebookId);
    if (!notebook) return;
    change(notebook);
    notebook.updatedAt = Date.now();
    this.persist(notebook, immediate);
    this.emit("change", { notebookId });
  }

  persist(notebook, immediate = false) {
    const existing = this.saveTimers.get(notebook.id);
    if (existing) clearTimeout(existing);
    const save = () => {
      this.saveTimers.delete(notebook.id);
      db.put("notebooks", notebook).catch((error) => {
        console.error("Kaydedilemedi", error);
        this.emit("error", "Defter kaydedilemedi: " + error.message);
      });
    };
    if (immediate) save();
    else this.saveTimers.set(notebook.id, setTimeout(save, 500));
  }

  async flush() {
    for (const [id, timer] of this.saveTimers) {
      clearTimeout(timer);
      this.saveTimers.delete(id);
      const notebook = this.notebook(id);
      if (notebook) await db.put("notebooks", notebook);
    }
  }

  async permanentlyDelete(notebookId) {
    const notebook = this.notebook(notebookId);
    if (!notebook) return;
    this.notebooks = this.notebooks.filter((n) => n.id !== notebookId);
    await db.delete("notebooks", notebookId);
    await this.removeUnreferencedAssets();
    this.emit("change");
  }

  // ---- sayfalar ----

  addPage(notebookId, index, template, extra = {}) {
    let newId = null;
    this.mutate(notebookId, (notebook) => {
      const page = newPage({ size: extra.size || PAGE_SIZES[this.settings.pageSize], pdf: extra.pdf || null });
      if (template) applyTemplate(page, template, this);
      const at = Math.min(Math.max(index, 0), notebook.pages.length);
      notebook.pages.splice(at, 0, page);
      newId = page.id;
    });
    if (template) this.setSetting("lastUsedTemplate", template);
    return newId;
  }

  addPDFPages(notebookId, index, assetId, sizes) {
    let firstId = null;
    this.mutate(notebookId, (notebook) => {
      const pages = sizes.map((size, i) => newPage({ size, paper: "blank", pdf: { asset: assetId, index: i } }));
      const at = Math.min(Math.max(index, 0), notebook.pages.length);
      notebook.pages.splice(at, 0, ...pages);
      firstId = pages[0] ? pages[0].id : null;
    });
    return firstId;
  }

  duplicatePage(notebookId, pageId) {
    let newId = null;
    this.mutate(notebookId, (notebook) => {
      const index = notebook.pages.findIndex((p) => p.id === pageId);
      if (index < 0) return;
      const copy = structuredClone(notebook.pages[index]);
      copy.id = uid();
      copy.strokes.forEach((s) => { s.id = uid(); });
      copy.objects.forEach((o) => { o.id = uid(); });
      copy.covers.forEach((c) => { c.id = uid(); });
      notebook.pages.splice(index + 1, 0, copy);
      newId = copy.id;
    });
    return newId;
  }

  movePage(notebookId, pageId, toIndex) {
    this.mutate(notebookId, (notebook) => {
      const from = notebook.pages.findIndex((p) => p.id === pageId);
      if (from < 0) return;
      const target = Math.min(Math.max(toIndex, 0), notebook.pages.length - 1);
      if (target === from) return;
      const [page] = notebook.pages.splice(from, 1);
      notebook.pages.splice(target, 0, page);
    });
  }

  deletePage(notebookId, pageId) {
    const notebook = this.notebook(notebookId);
    if (!notebook || notebook.pages.length <= 1) return false;
    this.mutate(notebookId, (n) => {
      n.pages = n.pages.filter((p) => p.id !== pageId);
    });
    this.removeUnreferencedAssets();
    return true;
  }

  setTemplate(notebookId, pageId, template) {
    this.mutate(notebookId, (notebook) => {
      const page = notebook.pages.find((p) => p.id === pageId);
      if (page) applyTemplate(page, template, this);
    });
  }

  updatePage(notebookId, pageId, change, immediate = false) {
    this.mutate(notebookId, (notebook) => {
      const page = notebook.pages.find((p) => p.id === pageId);
      if (page) change(page);
    }, immediate);
  }

  // ---- ayarlar ----

  setSetting(key, value) {
    this.settings[key] = value;
    db.setSetting(key, value).catch((error) => console.error(error));
    this.emit("settings", { key });
  }

  initialTemplate(fallback = "builtin:ruled") {
    return this.settings.newPageTemplate || this.settings.lastUsedTemplate || fallback;
  }

  get defaultPen() {
    const pens = this.settings.pens;
    return pens.find((p) => p.id === this.settings.defaultPenId) || pens[0];
  }

  addPen(pen) {
    const exists = this.settings.pens.some((p) => p.tool === pen.tool && p.color.toUpperCase() === pen.color.toUpperCase() && p.width === pen.width);
    if (exists) return;
    this.setSetting("pens", [...this.settings.pens, { id: uid(), ...pen }]);
  }

  removePen(id) {
    if (this.settings.pens.length <= 1) return;
    const pens = this.settings.pens.filter((p) => p.id !== id);
    this.setSetting("pens", pens);
    if (this.settings.defaultPenId === id) this.setSetting("defaultPenId", pens[0].id);
  }

  updatePen(id, change) {
    const pens = this.settings.pens.map((p) => (p.id === id ? { ...p, ...change } : p));
    this.setSetting("pens", pens);
  }

  addPaletteColor(hex) {
    const normalized = hex.toUpperCase();
    if (this.settings.palette.some((c) => c.toUpperCase() === normalized)) return;
    this.setSetting("palette", [...this.settings.palette, normalized]);
  }

  /** Kullanılan renk "son kullanılanlar" listesinin başına geçer (palet elle düzenlenir). */
  noteColorUsed(hex) {
    if (!hex) return;
    const normalized = hex.toUpperCase();
    const current = this.settings.recentColors || [];
    if (current.length && current[0].toUpperCase() === normalized) return;
    this.setSetting("recentColors", [normalized, ...current.filter((c) => c.toUpperCase() !== normalized)].slice(0, 12));
  }

  noteSticker(emoji) {
    const current = this.settings.recentStickers || [];
    this.setSetting("recentStickers", [emoji, ...current.filter((e) => e !== emoji)].slice(0, 16));
  }

  removePaletteColor(hex) {
    if (this.settings.palette.length <= 1) return;
    this.setSetting("palette", this.settings.palette.filter((c) => c.toUpperCase() !== hex.toUpperCase()));
  }

  template(id) {
    return this.settings.templates.find((t) => t.id === id) || null;
  }

  // ---- görseller ----

  async importAsset(blob, name) {
    const id = uid();
    await db.put("assets", { id, blob, type: blob.type, name: name || "" });
    return id;
  }

  async assetURL(id) {
    if (!id) return null;
    if (this.assetURLs.has(id)) return this.assetURLs.get(id);
    const row = await db.get("assets", id);
    if (!row) return null;
    const url = URL.createObjectURL(row.blob);
    this.assetURLs.set(id, url);
    return url;
  }

  async assetBlob(id) {
    const row = await db.get("assets", id);
    return row ? row.blob : null;
  }

  async removeAsset(id) {
    const url = this.assetURLs.get(id);
    if (url) URL.revokeObjectURL(url);
    this.assetURLs.delete(id);
    await db.delete("assets", id);
  }

  /** Hiçbir yerde kullanılmayan görselleri siler (şablonlar ve kapaklar hariç). */
  async removeUnreferencedAssets() {
    const used = new Set();
    for (const t of this.settings.templates) used.add(t.asset);
    for (const c of this.settings.customCovers) used.add(c);
    if (this.settings.defaultCover && this.settings.defaultCover.imageAsset) used.add(this.settings.defaultCover.imageAsset);
    for (const notebook of this.notebooks) {
      if (notebook.cover && notebook.cover.imageAsset) used.add(notebook.cover.imageAsset);
      for (const page of notebook.pages) {
        if (page.templateAsset) used.add(page.templateAsset);
        if (page.pdf) used.add(page.pdf.asset);
        for (const object of page.objects) if (object.asset) used.add(object.asset);
      }
    }
    const rows = await db.getAll("assets");
    for (const row of rows) {
      if (!used.has(row.id)) await this.removeAsset(row.id);
    }
  }
}

/** "builtin:ruled" ya da "custom:<id>" biçimindeki şablonu sayfaya uygular. */
export function applyTemplate(page, template, store) {
  if (!template) return;
  const [kind, value] = template.split(":");
  if (kind === "builtin" && value in PAPER_STYLES) {
    page.paper = value;
    page.templateAsset = null;
  } else if (kind === "custom") {
    const entry = store.template(value);
    if (entry) {
      page.templateAsset = entry.asset;
      page.paper = "blank";
    }
  }
}

export function templateOf(page, store) {
  if (page.templateAsset) {
    const entry = store.settings.templates.find((t) => t.asset === page.templateAsset);
    if (entry) return "custom:" + entry.id;
  }
  return "builtin:" + page.paper;
}

function migrateNotebook(notebook) {
  for (const page of notebook.pages) {
    page.size = page.size || { ...A4 };
    page.strokes = page.strokes || [];
    page.objects = page.objects || [];
    page.covers = page.covers || [];
  }
  return notebook;
}

export const store = new Store();
