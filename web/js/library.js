// Kütüphane: liste (01-Main.png) ve kapak rafı (02-DefterGorunumu.png).
// Kapağa dokununca defter yerinde açılır, sonra editöre geçilir (03-KapakAcilis.png).
import { store, COVER_PRESETS, COVER_TITLES } from "./store.js";
import { h, svgIcon, iconButton, pressable, actionSheet, confirmDialog, promptDialog, openModal, closeModal, toast } from "./ui.js";
import { coverElement, sameCover } from "./covers.js";
import { exportBackup, importBackup } from "./backup.js";
import { navigate } from "./app.js";

export function renderLibrary(root) {
  let showingTrash = false;
  let search = "";
  let opening = null;

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
    const source = showingTrash ? store.trashedNotebooks : store.activeNotebooks;
    if (!search) return source;
    const needle = search.toLocaleLowerCase("tr");
    return source.filter((n) => n.title.toLocaleLowerCase("tr").includes(needle));
  }

  function render() {
    renderTopbar();
    const notebooks = visible();
    const totalPages = store.activeNotebooks.reduce((sum, n) => sum + n.pages.length, 0);
    const searchBox = h("div", { class: "search" }, svgIcon("search", 18),
      h("input", { type: "search", placeholder: showingTrash ? "Çöp kutusunda ara" : "Defterlerde ara", value: search,
        onInput: (e) => { search = e.target.value; renderBody(); } }));
    body.replaceChildren(
      !showingTrash && h("div", { class: "library-head" },
        h("h1", {}, "Defterlerim"),
        h("span", { class: "muted" }, `${store.activeNotebooks.count ?? store.activeNotebooks.length} defter · ${totalPages} sayfa`)
      ),
      searchBox,
      h("div", { class: "library-content" })
    );
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
    navigate(`#/n/${id}`);
  }

  function notebookMenu(notebook) {
    actionSheet(notebook.title, [
      { title: "Yeniden Adlandır", onSelect: () => promptDialog("Defteri Yeniden Adlandır", "Defter adı", notebook.title, (title) => store.mutate(notebook.id, (n) => { n.title = title; })) },
      { title: "Kapağı Değiştir", onSelect: () => coverPicker(notebook) },
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
    openModal(h("div", { class: "dialog", style: { width: "min(760px, 100%)" } },
      h("h3", {}, "Kapak"),
      h("p", {}, "Kendi kapak görselini Ayarlar'dan ekleyebilirsin."),
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
