// Kütüphane: liste (01-Main.png) ve kapak rafı (02-DefterGorunumu.png).
// Kapağa dokununca defter yerinde açılır, sonra editöre geçilir (03-KapakAcilis.png).
import { store, COVER_PRESETS, COVER_TITLES } from "./store.js";
import { h, svgIcon, iconButton, pressable, actionSheet, confirmDialog, promptDialog, openModal, closeModal, toast, pickFile } from "./ui.js";
import { coverElement, sameCover } from "./covers.js";
import { exportBackup, importBackup } from "./backup.js";
import { shrinkImage } from "./addpage.js";
import { navigate } from "./app.js";

export function renderLibrary(root) {
  let showingTrash = false;
  let search = "";
  let opening = null;
  let currentFolder = null;   // null = Tüm Notlar

  const screen = h("div", { class: "screen screen-light" });
  const body = h("div", { class: "library-body" });
  const topbar = h("div", { class: "topbar" });
  screen.append(topbar, body);
  root.append(screen);

  function renderTopbar() {
    topbar.replaceChildren(
      h("div", { class: "topbar-side" },
        iconButton(showingTrash ? "books" : "trash", showingTrash ? "Kütüphane" : "Çöp Kutusu", () => { showingTrash = !showingTrash; search = ""; render(); }),
        !showingTrash && iconButton("gear", "Ayarlar", () => navigate("#/settings")),
        !showingTrash && iconButton("share", "Yedekle", () => exportBackup())
      ),
      h("div", { class: "topbar-title" }, showingTrash ? "Çöp Kutusu" : "Defterlerim"),
      h("div", { class: "topbar-side right" },
        !showingTrash && h("div", { class: "segmented", role: "group", "aria-label": "Görünüm" },
          h("button", { type: "button", class: store.settings.libraryShelf ? "" : "active", "aria-label": "Liste", onClick: () => { store.setSetting("libraryShelf", false); render(); } }, svgIcon("list", 18)),
          h("button", { type: "button", class: store.settings.libraryShelf ? "active" : "", "aria-label": "Raf", onClick: () => { store.setSetting("libraryShelf", true); render(); } }, svgIcon("books", 18))
        ),
        !showingTrash && iconButton("plus", "Yeni Defter", createNotebook, "accent")
      )
    );
  }

  function visible() {
    let source = showingTrash ? store.trashedNotebooks : store.activeNotebooks;
    if (currentFolder && !showingTrash) source = source.filter((n) => n.folder === currentFolder);
    if (!search) return source;
    const needle = search.toLocaleLowerCase("tr");
    return source.filter((n) => n.title.toLocaleLowerCase("tr").includes(needle));
  }

  // ---- klasörler (01-Main.png soldaki liste) ----

  function folderList() {
    const all = store.activeNotebooks;
    const list = h("div", { class: "folders" });
    const item = (title, key, count, icon) => {
      const el = h("div", { class: "folder-item" + (currentFolder === key ? " active" : ""), role: "button", tabindex: "0" },
        svgIcon(icon, 18), h("span", {}, title), h("span", { class: "count" }, String(count)));
      pressable(el, {
        onTap: () => { currentFolder = key; render(); },
        onLong: key ? () => folderMenu(key) : null
      });
      return el;
    };
    list.append(item("Tüm Notlar", null, all.length, "books"));
    list.append(h("h3", {}, "DEFTERLER"));
    for (const name of store.settings.folders) list.append(item(name, name, all.filter((n) => n.folder === name).length, "note"));
    list.append(h("div", { class: "folder-item add", role: "button", tabindex: "0", onClick: () => promptDialog("Yeni Klasör", "Klasör adı", "", addFolder) }, svgIcon("plus", 18), "Yeni Klasör"));
    return list;
  }

  function addFolder(name) {
    if (store.settings.folders.includes(name)) { toast("Bu adda bir klasör zaten var."); return; }
    store.setSetting("folders", [...store.settings.folders, name]);
    currentFolder = name;
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
      actions.push({ title: (notebook.folder === name ? "\u2713 " : "") + name, onSelect: () => store.mutate(notebook.id, (n) => { n.folder = name; }) });
    }
    actions.push({ title: "Yeni Klasör...", onSelect: () => promptDialog("Yeni Klasör", "Klasör adı", "", (name) => {
      if (!store.settings.folders.includes(name)) store.setSetting("folders", [...store.settings.folders, name]);
      store.mutate(notebook.id, (n) => { n.folder = name; });
    }) });
    actionSheet("Klasöre Taşı", actions);
  }

  function render() {
    renderTopbar();
    const notebooks = visible();
    const totalPages = notebooks.reduce((sum, n) => sum + n.pages.length, 0);
    const searchBox = h("div", { class: "search" }, svgIcon("search", 18),
      h("input", { type: "search", placeholder: showingTrash ? "Çöp kutusunda ara" : "Defterlerde ara", value: search,
        onInput: (e) => { search = e.target.value; renderBody(); } }));
    const main = h("div", { class: "library-main" },
      !showingTrash && h("div", { class: "library-head" },
        h("h1", {}, currentFolder || "Defterlerim"),
        h("span", { class: "muted" }, `${notebooks.length} defter · ${totalPages} sayfa`)
      ),
      searchBox,
      h("div", { class: "library-content" })
    );
    body.replaceChildren(showingTrash ? main : h("div", { class: "library-layout" }, folderList(), main));
    renderBody();
    function renderBody() {
      const content = body.querySelector(".library-content");
      const list = visible();
      if (list.length === 0 && (showingTrash || search)) {
        content.replaceChildren(h("div", { class: "empty" }, svgIcon(showingTrash ? "trash" : "search", 40),
          h("h2", {}, showingTrash ? "Çöp Kutusu Boş" : "Sonuç Yok"),
          h("p", {}, showingTrash ? "Silinen defterler burada görünür." : "Bu ada uyan defter yok.")));
        return;
      }
      if (store.settings.libraryShelf && !showingTrash) content.replaceChildren(shelf(list));
      else content.replaceChildren(listView(list));
    }
    void notebooks;
  }

  function shelf(notebooks) {
    const grid = h("div", { class: "shelf" });
    for (const notebook of notebooks) grid.append(shelfCell(notebook));
    if (!search) {
      grid.append(h("div", { class: "shelf-cell new", onClick: createNotebook, role: "button", tabindex: "0" },
        h("div", { class: "cover-wrap" }, svgIcon("plus", 30), "Yeni Defter")));
    }
    return grid;
  }

  function shelfCell(notebook) {
    const cover = coverElement(notebook.cover);
    const wrap = h("div", { class: "cover-wrap" }, cover);
    const cell = h("div", { class: "shelf-cell", role: "button", tabindex: "0", "aria-label": `${notebook.title}, ${notebook.pages.length} sayfa` },
      wrap,
      h("div", { class: "title" }, h("span", {}, notebook.title), notebook.isFavourite && h("span", { style: { color: "#e8a020" } }, svgIcon("star", 14))),
      h("div", { class: "sub" }, `${notebook.pages.length} sayfa`)
    );
    pressable(cell, {
      onTap: () => openNotebook(notebook, cover),
      onLong: () => notebookMenu(notebook)
    });
    return cell;
  }

  function listView(notebooks) {
    const list = h("div", { class: "list" });
    for (const notebook of notebooks) {
      const row = h("div", { class: "list-row", role: "button", tabindex: "0" },
        coverElement(notebook.cover),
        h("div", { class: "row-text" },
          h("div", { class: "row-title" }, h("span", {}, notebook.title), notebook.isFavourite && !showingTrash && h("span", { style: { color: "#e8a020" } }, svgIcon("star", 14))),
          h("div", { class: "row-sub" }, `${notebook.pages.length} sayfa · ${new Date(notebook.updatedAt).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" })}`)
        ),
        svgIcon("forward", 18)
      );
      pressable(row, {
        onTap: () => showingTrash ? trashMenu(notebook) : navigate(`#/n/${notebook.id}`),
        onLong: () => showingTrash ? trashMenu(notebook) : notebookMenu(notebook)
      });
      list.append(row);
    }
    return list;
  }

  function openNotebook(notebook, cover) {
    if (opening) return;
    opening = notebook.id;
    cover.append(h("div", { class: "cover-label" }, notebook.title));
    requestAnimationFrame(() => cover.classList.add("opening"));
    setTimeout(() => { opening = null; navigate(`#/n/${notebook.id}`); }, 600);
  }

  function createNotebook() {
    const id = store.createNotebook();
    if (currentFolder) store.mutate(id, (n) => { n.folder = currentFolder; }, true);
    navigate(`#/n/${id}`);
  }

  function notebookMenu(notebook) {
    actionSheet(notebook.title, [
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
        onClick: () => { store.mutate(notebook.id, (n) => { n.cover = option; }); closeModal(); } }, coverElement(option));
      grid.append(cell);
    }
    grid.append(h("div", { class: "mini-cover", role: "button", tabindex: "0", "aria-label": "Kendi kapağını ekle",
      style: { display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: "8px", border: "1.5px dashed rgba(93,88,214,0.6)", color: "var(--accent)", fontSize: "14px", fontWeight: "600" },
      onClick: async () => {
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
      h("div", { class: "dialog-buttons" }, h("button", { class: "btn", type: "button", onClick: closeModal }, "Kapat"))
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
