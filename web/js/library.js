// Kütüphane, Paper (WeTransfer) tarzı: mor zeminde yatay kapak sırası, üstte ad ve sayfa sayısı,
// altta işlem düğmeleri. Kapağa dokununca sayfa yelpazesi açılır. Liste görünümü de duruyor.
import { store, COVER_PRESETS, COVER_TITLES } from "./store.js";
import { h, svgIcon, iconButton, pressable, actionSheet, confirmDialog, promptDialog, openModal, closeModal, toast, pickFile } from "./ui.js";
import { coverElement, sameCover } from "./covers.js";
import { exportBackup, importBackup } from "./backup.js";
import { shrinkImage } from "./addpage.js";
import { pdfPageSizes } from "./paper.js";
import { navigate } from "./app.js";

export function renderLibrary(root) {
  let showingTrash = false;
  let search = "";
  let currentFolder = null;   // null = Tüm Notlar
  let currentIndex = 0;       // sıradaki (ortadaki) defter
  let scrollTimer = null;

  const screen = h("div", { class: "screen screen-paper" });
  const body = h("div", { class: "paper-body" });
  const topbar = h("div", { class: "paper-topbar" });
  screen.append(topbar, body);
  root.append(screen);

  function visible() {
    let source = showingTrash ? store.trashedNotebooks : store.activeNotebooks;
    if (currentFolder && !showingTrash) source = source.filter((n) => n.folder === currentFolder);
    if (!search) return source;
    const needle = search.toLocaleLowerCase("tr");
    return source.filter((n) => n.title.toLocaleLowerCase("tr").includes(needle));
  }

  function current() {
    const list = visible();
    if (!list.length) return null;
    currentIndex = Math.min(Math.max(currentIndex, 0), list.length - 1);
    return list[currentIndex];
  }

  // ---------- üst çubuk ----------

  function renderTopbar() {
    topbar.replaceChildren(
      h("div", { class: "topbar-side" },
        iconButton("list", "Klasörler ve liste", openFoldersSheet),
        iconButton(showingTrash ? "books" : "trash", showingTrash ? "Kütüphane" : "Çöp Kutusu", () => { showingTrash = !showingTrash; search = ""; currentIndex = 0; render(); })),
      h("div", { class: "topbar-title" }),
      h("div", { class: "topbar-side right" },
        iconButton("search", "Ara", openSearch),
        !showingTrash && iconButton("share", "Yedekle", () => exportBackup()),
        !showingTrash && iconButton("gear", "Ayarlar", () => navigate("#/settings")))
    );
  }

  function openSearch() {
    promptDialog("Defterlerde ara", "Defter adı", search, (value) => { search = value; currentIndex = 0; render(); });
  }

  // ---------- gövde ----------

  function render() {
    renderTopbar();
    const list = visible();
    const notebook = current();
    body.replaceChildren(
      h("div", { class: "paper-head" },
        h("h1", {}, notebook ? notebook.title : (showingTrash ? "Çöp Kutusu" : (currentFolder || "Defterlerim"))),
        h("div", { class: "sub" }, notebook ? `${notebook.pages.length} sayfa${notebook.folder ? " · " + notebook.folder : ""}${search ? " · arama: " + search : ""}` : (showingTrash ? "Silinen defterler burada" : "Henüz defter yok"))),
      list.length ? carousel(list) : emptyState(),
      actionBar(notebook)
    );
    requestAnimationFrame(() => centerOn(currentIndex, false));
  }

  function emptyState() {
    return h("div", { class: "paper-empty" },
      svgIcon(showingTrash ? "trash" : "books", 40),
      h("p", {}, showingTrash ? "Çöp kutusu boş." : (search ? "Bu ada uyan defter yok." : "İlk defterini + ile aç.")));
  }

  function carousel(list) {
    const track = h("div", { class: "carousel", role: "list" });
    for (const [index, notebook] of list.entries()) {
      const cover = coverElement(notebook.cover);
      const cell = h("div", { class: "carousel-item" + (index === currentIndex ? " current" : ""), role: "listitem", dataset: { index: String(index) }, "aria-label": `${notebook.title}, ${notebook.pages.length} sayfa` },
        h("div", { class: "cover-wrap" }, cover),
        h("div", { class: "carousel-title" }, notebook.title));
      pressable(cell, {
        onTap: () => {
          if (index !== currentIndex) { currentIndex = index; centerOn(index, true); updateCurrent(); return; }
          openNotebook(notebook, cover);
        },
        onLong: () => showingTrash ? trashMenu(notebook) : notebookMenu(notebook)
      });
      track.append(cell);
    }
    track.addEventListener("scroll", () => {
      if (scrollTimer) clearTimeout(scrollTimer);
      scrollTimer = setTimeout(() => {
        const items = [...track.children];
        const center = track.scrollLeft + track.clientWidth / 2;
        let best = 0;
        let bestDistance = Infinity;
        items.forEach((item, i) => {
          const d = Math.abs(item.offsetLeft + item.offsetWidth / 2 - center);
          if (d < bestDistance) { bestDistance = d; best = i; }
        });
        if (best !== currentIndex) { currentIndex = best; updateCurrent(); }
      }, 80);
    }, { passive: true });
    return track;
  }

  function centerOn(index, smooth) {
    const track = body.querySelector(".carousel");
    if (!track) return;
    const item = track.children[index];
    if (!item) return;
    const left = item.offsetLeft + item.offsetWidth / 2 - track.clientWidth / 2;
    track.scrollTo({ left, behavior: smooth ? "smooth" : "auto" });
  }

  /** Ortadaki defter değişince başlık, sayfa sayısı ve vurgu güncellenir; sıra yeniden kurulmaz. */
  function updateCurrent() {
    const notebook = current();
    const head = body.querySelector(".paper-head");
    if (head && notebook) {
      head.querySelector("h1").textContent = notebook.title;
      head.querySelector(".sub").textContent = `${notebook.pages.length} sayfa${notebook.folder ? " · " + notebook.folder : ""}`;
    }
    body.querySelectorAll(".carousel-item").forEach((item, i) => item.classList.toggle("current", i === currentIndex));
    const bar = body.querySelector(".paper-actions");
    if (bar) bar.replaceWith(actionBar(notebook));
  }

  function actionBar(notebook) {
    const bar = h("div", { class: "paper-actions" });
    if (notebook && !showingTrash) {
      bar.append(
        iconButton("more", "Defter işlemleri", () => notebookMenu(notebook)),
        iconButton("page", "Sayfalar", () => navigate(`#/n/${notebook.id}/fan`)),
        iconButton("trash", "Çöpe at", () => confirmDialog("Defter çöpe atılsın mı?", `"${notebook.title}" çöp kutusuna taşınır; oradan geri alınabilir.`, "Çöpe At", () => store.mutate(notebook.id, (n) => { n.isTrashed = true; })))
      );
    } else if (notebook && showingTrash) {
      bar.append(
        iconButton("undo", "Geri al", () => store.mutate(notebook.id, (n) => { n.isTrashed = false; })),
        iconButton("trash", "Kalıcı olarak sil", () => trashMenu(notebook))
      );
    }
    if (!showingTrash) bar.append(iconButton("plus", "Yeni defter", newMenu, "accent-fill"));
    return bar;
  }

  // ---------- klasörler ve liste (sol üst) ----------

  function openFoldersSheet() {
    const list = h("div", { class: "folder-sheet" });
    const all = store.activeNotebooks;
    const item = (title, key, count, icon) => {
      const el = h("div", { class: "folder-item" + (currentFolder === key ? " active" : ""), role: "button", tabindex: "0" },
        svgIcon(icon, 18), h("span", {}, title), h("span", { class: "count" }, String(count)));
      pressable(el, {
        onTap: () => { currentFolder = key; currentIndex = 0; closeModal(); render(); },
        onLong: key ? () => { closeModal(); folderMenu(key); } : null
      });
      return el;
    };
    list.append(item("Tüm Notlar", null, all.length, "books"));
    for (const name of store.settings.folders) list.append(item(name, name, all.filter((n) => n.folder === name).length, "note"));
    list.append(h("div", { class: "folder-item add", role: "button", tabindex: "0", onTap: () => { closeModal(); promptDialog("Yeni Klasör", "Klasör adı", "", addFolder); } }, svgIcon("plus", 18), "Yeni Klasör"));
    list.append(h("div", { class: "folder-item", role: "button", tabindex: "0", onTap: () => { closeModal(); openListView(); } }, svgIcon("list", 18), "Liste görünümü"));
    openModal(h("div", { class: "dialog", style: { width: "min(380px, 100%)" } }, h("h3", {}, "Klasörler"), list));
  }

  function addFolder(name) {
    if (store.settings.folders.includes(name)) { toast("Bu adda bir klasör zaten var."); return; }
    store.setSetting("folders", [...store.settings.folders, name]);
    currentFolder = name;
    currentIndex = 0;
    render();
  }

  function folderMenu(name) {
    actionSheet(name, [
      { title: "Yeniden Adlandır", onSelect: () => promptDialog("Klasörü Yeniden Adlandır", "Klasör adı", name, (newName) => {
        if (newName === name) return;
        if (store.settings.folders.includes(newName)) { toast("Bu adda bir klasör zaten var."); return; }
        store.setSetting("folders", store.settings.folders.map((f) => (f === name ? newName : f)));
        for (const n of store.notebooks) if (n.folder === name) store.mutate(n.id, (x) => { x.folder = newName; });
        if (currentFolder === name) currentFolder = newName;
        render();
      }) },
      { title: "Klasörü Sil (defterler kalır)", destructive: true, onSelect: () => {
        store.setSetting("folders", store.settings.folders.filter((f) => f !== name));
        for (const n of store.notebooks) if (n.folder === name) store.mutate(n.id, (x) => { x.folder = null; });
        if (currentFolder === name) currentFolder = null;
        render();
      } }
    ]);
  }

  function moveToFolderMenu(notebook) {
    const actions = [{ title: "Klasörsüz (Tüm Notlar)", onSelect: () => store.mutate(notebook.id, (n) => { n.folder = null; }) }];
    for (const name of store.settings.folders) {
      actions.push({ title: (notebook.folder === name ? "✓ " : "") + name, onSelect: () => store.mutate(notebook.id, (n) => { n.folder = name; }) });
    }
    actions.push({ title: "Yeni Klasör...", onSelect: () => promptDialog("Yeni Klasör", "Klasör adı", "", (name) => {
      if (!store.settings.folders.includes(name)) store.setSetting("folders", [...store.settings.folders, name]);
      store.mutate(notebook.id, (n) => { n.folder = name; });
    }) });
    actionSheet("Klasöre Taşı", actions);
  }

  function openListView() {
    const list = h("div", { class: "list" });
    for (const notebook of visible()) {
      const row = h("div", { class: "list-row", role: "button", tabindex: "0" },
        coverElement(notebook.cover),
        h("div", { class: "row-text" },
          h("div", { class: "row-title" }, h("span", {}, notebook.title), notebook.isFavourite && h("span", { style: { color: "#e8a020" } }, svgIcon("star", 14))),
          h("div", { class: "row-sub" }, `${notebook.pages.length} sayfa · ${new Date(notebook.updatedAt).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" })}`)),
        svgIcon("forward", 18));
      pressable(row, { onTap: () => { closeModal(); navigate(`#/n/${notebook.id}/fan`); }, onLong: () => { closeModal(); notebookMenu(notebook); } });
      list.append(row);
    }
    openModal(h("div", { class: "dialog", style: { width: "min(560px, 100%)" } }, h("h3", {}, currentFolder || "Defterlerim"), list));
  }

  // ---------- defter işlemleri ----------

  function openNotebook(notebook, cover) {
    cover.classList.add("opening");
    setTimeout(() => navigate(`#/n/${notebook.id}/fan`), 320);
  }

  function newMenu() {
    actionSheet("Yeni", [
      { title: "Yeni Defter", onSelect: createNotebook },
      { title: "PDF'ten Defter", onSelect: createFromPDF }
    ]);
  }

  async function createFromPDF() {
    const file = await pickFile("file-pdf");
    if (!file) return;
    toast("PDF açılıyor…");
    try {
      const asset = await store.importAsset(file, file.name);
      const sizes = await pdfPageSizes(asset);
      if (!sizes.length) { toast("PDF açılamadı ya da boş."); await store.removeAsset(asset); return; }
      const id = store.createNotebook();
      store.mutate(id, (n) => {
        n.title = (file.name || "PDF").replace(/\.[^.]+$/, "") || n.title;
        n.pages = [];
        if (currentFolder) n.folder = currentFolder;
      }, true);
      store.addPDFPages(id, 0, asset, sizes);
      toast(`${sizes.length} sayfalık PDF defteri oluşturuldu`);
      navigate(`#/n/${id}/fan`);
    } catch (error) {
      toast("PDF eklenemedi: " + error.message);
    }
  }

  function createNotebook() {
    const id = store.createNotebook();
    if (currentFolder) store.mutate(id, (n) => { n.folder = currentFolder; }, true);
    promptDialog("Defter adı", "Örn. Seyahat günlüğü", `Defter ${store.notebooks.length}`, (title) => {
      store.mutate(id, (n) => { n.title = title; }, true);
      navigate(`#/n/${id}/fan`);
    });
  }

  function notebookMenu(notebook) {
    actionSheet(notebook.title, [
      { title: "Aç", onSelect: () => navigate(`#/n/${notebook.id}/fan`) },
      { title: "Yeniden Adlandır", onSelect: () => promptDialog("Defteri Yeniden Adlandır", "Defter adı", notebook.title, (title) => store.mutate(notebook.id, (n) => { n.title = title; })) },
      { title: "Kapağı Değiştir", onSelect: () => coverPicker(notebook) },
      { title: "Klasöre Taşı", onSelect: () => moveToFolderMenu(notebook) },
      { title: notebook.isFavourite ? "Favoriden Çıkar" : "Favorilere Ekle", onSelect: () => store.mutate(notebook.id, (n) => { n.isFavourite = !n.isFavourite; }) },
      { title: "Çöpe At", destructive: true, onSelect: () => { store.mutate(notebook.id, (n) => { n.isTrashed = true; }); toast("Çöp kutusuna taşındı"); } }
    ]);
  }

  function trashMenu(notebook) {
    actionSheet(notebook.title, [
      { title: "Geri Al", onSelect: () => store.mutate(notebook.id, (n) => { n.isTrashed = false; }) },
      { title: "Kalıcı Olarak Sil", destructive: true, onSelect: () => confirmDialog("Bu defter kalıcı olarak silinsin mi?", "Bu işlem geri alınamaz. Saklamak istiyorsan önce yedek al.", "Kalıcı Olarak Sil", () => store.permanentlyDelete(notebook.id)) }
    ]);
  }

  function coverPicker(notebook) {
    const options = [...COVER_PRESETS, ...store.settings.customCovers.map((asset) => ({ pattern: "plain", color: "#DDDDDD", imageAsset: asset }))];
    const grid = h("div", { class: "hscroll", style: { flexWrap: "wrap", gap: "18px" } });
    for (const option of options) {
      const cell = h("div", { class: "mini-cover" + (sameCover(option, notebook.cover) ? " selected" : ""), role: "button", tabindex: "0",
        "aria-label": option.imageAsset ? "Kendi kapağım" : COVER_TITLES[option.pattern],
        onTap: () => { store.mutate(notebook.id, (n) => { n.cover = option; }); closeModal(); } }, coverElement(option));
      grid.append(cell);
    }
    grid.append(h("div", { class: "mini-cover", role: "button", tabindex: "0", "aria-label": "Kendi kapağını ekle",
      style: { display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: "8px", border: "1.5px dashed rgba(93,88,214,0.6)", color: "var(--accent)", fontSize: "14px", fontWeight: "600" },
      onTap: async () => {
        const file = await pickFile("file-image");
        if (!file) return;
        try {
          const { blob } = await shrinkImage(file, 1200);
          const asset = await store.importAsset(blob, file.name);
          store.setSetting("customCovers", [...store.settings.customCovers, asset]);
          store.mutate(notebook.id, (n) => { n.cover = { pattern: "plain", color: "#DDDDDD", imageAsset: asset }; });
          closeModal();
        } catch (error) { toast("Kapak eklenemedi: " + error.message); }
      } }, svgIcon("plus", 26), "Kendi kapağım"));
    openModal(h("div", { class: "dialog", style: { width: "min(760px, 100%)" } },
      h("h3", {}, "Kapak"),
      h("p", {}, "Bir desen seç ya da Fotoğraflar'dan kendi kapağını ekle."),
      grid,
      h("div", { class: "dialog-buttons" }, h("button", { class: "btn", type: "button", onTap: closeModal }, "Kapat"))
    ));
  }

  const onChange = () => render();
  store.addEventListener("change", onChange);
  store.addEventListener("settings", onChange);
  render();

  return {
    destroy() {
      store.removeEventListener("change", onChange);
      store.removeEventListener("settings", onChange);
    }
  };
}

export { importBackup };
