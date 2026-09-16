import SwiftUI

// Kütüphane. İki görünüm: liste (01-Main.png) ve kapak rafı (02-DefterGorunumu.png).
// Raftaki kapağa dokununca defter yerinde açılır, sonra editöre geçer (03-KapakAcilis.png).
struct LibraryView: View {
    @ObservedObject var store: NotebookStore
    @EnvironmentObject private var settings: AppSettings
    @EnvironmentObject private var assets: AssetStore

    @AppStorage("notdefteri.libraryShelf") private var showingShelf = true
    @State private var showingTrash = false
    @State private var showingSettings = false
    @State private var searchText = ""
    @State private var pendingDelete: Notebook?
    @State private var renamingNotebookID: UUID?
    @State private var renameTitle = ""
    @State private var showingRenameDialog = false
    @State private var openingNotebookID: UUID?
    @State private var path: [UUID] = []

    private let accent = Color(red: 0.36, green: 0.35, blue: 0.85)
    private let shelfColumns = [GridItem(.adaptive(minimum: 170, maximum: 220), spacing: 36)]

    private var visibleNotebooks: [Notebook] {
        let source = showingTrash ? store.trashedNotebooks : store.activeNotebooks
        guard !searchText.isEmpty else { return source }
        return source.filter { $0.title.localizedCaseInsensitiveContains(searchText) }
    }

    private var totalPages: Int {
        store.activeNotebooks.reduce(0) { $0 + $1.pages.count }
    }

    var body: some View {
        NavigationStack(path: $path) {
            Group {
                if visibleNotebooks.isEmpty && (showingTrash || !searchText.isEmpty) {
                    ContentUnavailableView(
                        showingTrash ? "Çöp Kutusu Boş" : "Sonuç Yok",
                        systemImage: showingTrash ? "trash" : "magnifyingglass",
                        description: Text(showingTrash ? "Silinen defterler burada görünür." : "Bu ada uyan defter yok.")
                    )
                } else if showingShelf && !showingTrash {
                    shelf
                } else {
                    list
                }
            }
            .background(Color(red: 0.95, green: 0.94, blue: 0.98))
            .navigationDestination(for: UUID.self) { notebookID in
                NotebookEditorView(store: store, notebookID: notebookID)
            }
            .navigationDestination(isPresented: $showingSettings) {
                SettingsView()
            }
            .navigationTitle(showingTrash ? "Çöp Kutusu" : "Defterlerim")
            .searchable(text: $searchText, prompt: "Defterlerde ara")
            .toolbar {
                ToolbarItemGroup(placement: .topBarLeading) {
                    Button {
                        showingTrash.toggle()
                        searchText = ""
                    } label: {
                        Label(showingTrash ? "Kütüphane" : "Çöp Kutusu", systemImage: showingTrash ? "books.vertical" : "trash")
                    }
                    if !showingTrash {
                        Button {
                            showingSettings = true
                        } label: {
                            Label("Ayarlar", systemImage: "gearshape")
                        }
                    }
                }
                ToolbarItemGroup(placement: .topBarTrailing) {
                    if !showingTrash {
                        Picker("Görünüm", selection: $showingShelf) {
                            Image(systemName: "list.bullet").tag(false)
                            Image(systemName: "books.vertical").tag(true)
                        }
                        .pickerStyle(.segmented)
                        .frame(width: 110)
                        .accessibilityLabel("Liste ya da raf görünümü")

                        Button {
                            createNotebook()
                        } label: {
                            Label("Yeni Defter", systemImage: "plus")
                        }
                    }
                }
            }
            .safeAreaInset(edge: .bottom) {
                if let message = store.storageMessage {
                    Text(message)
                        .font(.footnote)
                        .foregroundStyle(.red)
                        .padding(10)
                        .frame(maxWidth: .infinity)
                        .background(.regularMaterial)
                }
            }
            .confirmationDialog("Bu defter kalıcı olarak silinsin mi?", isPresented: Binding(
                get: { pendingDelete != nil },
                set: { if !$0 { pendingDelete = nil } }
            ), titleVisibility: .visible) {
                Button("Kalıcı Olarak Sil", role: .destructive) {
                    if let pendingDelete { store.permanentlyDelete(pendingDelete.id) }
                    pendingDelete = nil
                }
                Button("Vazgeç", role: .cancel) { pendingDelete = nil }
            } message: {
                Text("Bu işlem geri alınamaz. Saklamak istiyorsan önce bir kopyasını dışa aktar.")
            }
            .alert("Defteri Yeniden Adlandır", isPresented: $showingRenameDialog) {
                TextField("Defter adı", text: $renameTitle)
                Button("Kaydet") {
                    if let renamingNotebookID {
                        store.renameNotebook(renamingNotebookID, to: renameTitle)
                    }
                    renamingNotebookID = nil
                }
                .disabled(renameTitle.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                Button("Vazgeç", role: .cancel) { renamingNotebookID = nil }
            } message: {
                Text("Bu defter için bir ad gir.")
            }
        }
    }

    // MARK: - Raf

    private var shelf: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 26) {
                HStack(alignment: .firstTextBaseline) {
                    Text("Defterlerim")
                        .font(.system(size: 34, weight: .bold))
                    Spacer()
                    Text("\(store.activeNotebooks.count) defter · \(totalPages) sayfa")
                        .foregroundStyle(.secondary)
                }
                LazyVGrid(columns: shelfColumns, alignment: .leading, spacing: 40) {
                    ForEach(visibleNotebooks) { notebook in
                        shelfCell(notebook)
                    }
                    if searchText.isEmpty {
                        Button {
                            createNotebook()
                        } label: {
                            VStack(spacing: 12) {
                                Image(systemName: "plus")
                                    .font(.system(size: 30, weight: .medium))
                                Text("Yeni Defter")
                                    .font(.headline)
                            }
                            .foregroundStyle(accent)
                            .frame(maxWidth: .infinity)
                            .aspectRatio(0.74, contentMode: .fit)
                            .background(Color.white.opacity(0.6), in: RoundedRectangle(cornerRadius: 10))
                            .overlay(
                                RoundedRectangle(cornerRadius: 10)
                                    .strokeBorder(style: StrokeStyle(lineWidth: 1.5, dash: [7, 5]))
                                    .foregroundStyle(accent.opacity(0.5))
                            )
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("Yeni defter")
                    }
                }
            }
            .padding(.horizontal, 40)
            .padding(.vertical, 24)
        }
    }

    private func shelfCell(_ notebook: Notebook) -> some View {
        let cover = notebook.cover ?? .fallback
        let isOpening = openingNotebookID == notebook.id
        return VStack(spacing: 12) {
            ZStack {
                // Açılırken kapağın altından görünen ilk sayfa
                if isOpening {
                    RoundedRectangle(cornerRadius: 6)
                        .fill(PaperBackgroundView.paperColor)
                        .overlay(
                            PaperBackgroundView(style: notebook.pages.first?.paper ?? .ruled)
                                .clipShape(RoundedRectangle(cornerRadius: 6))
                        )
                        .padding(.trailing, 6)
                }
                NotebookCoverView(cover: cover, image: cover.imageAssetName.flatMap { assets.image(named: $0) })
                    .overlay {
                        if isOpening {
                            Text(notebook.title)
                                .font(.system(.title3, design: .serif))
                                .foregroundStyle(Color(red: 0.2, green: 0.2, blue: 0.35))
                                .padding(.horizontal, 16)
                                .padding(.vertical, 8)
                                .background(Color.white, in: RoundedRectangle(cornerRadius: 6))
                                .shadow(color: .black.opacity(0.15), radius: 4, y: 2)
                        }
                    }
                    .rotation3DEffect(.degrees(isOpening ? -105 : 0), axis: (x: 0, y: 1, z: 0), anchor: .trailing, perspective: 0.6)
                    .animation(.easeInOut(duration: 0.55), value: isOpening)
            }
            .aspectRatio(0.74, contentMode: .fit)
            .zIndex(isOpening ? 1 : 0)

            VStack(spacing: 3) {
                HStack(spacing: 6) {
                    Text(notebook.title)
                        .font(.headline)
                        .lineLimit(1)
                    if notebook.isFavourite {
                        Image(systemName: "star.fill").font(.caption).foregroundStyle(.orange)
                    }
                }
                Text("\(notebook.pages.count) sayfa")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
        }
        .contentShape(Rectangle())
        .onTapGesture { open(notebook) }
        .contextMenu { notebookMenu(notebook) }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(notebook.title), \(notebook.pages.count) sayfa")
        .accessibilityHint("Açmak için dokun")
    }

    // MARK: - Liste

    private var list: some View {
        List {
            ForEach(visibleNotebooks) { notebook in
                NavigationLink(value: notebook.id) {
                    NotebookRow(notebook: notebook, showingTrash: showingTrash, coverImage: notebook.cover?.imageAssetName.flatMap { assets.image(named: $0) })
                }
                .contextMenu {
                    if !showingTrash { notebookMenu(notebook) }
                }
                .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                    if showingTrash {
                        Button("Geri Al", systemImage: "arrow.uturn.backward") {
                            store.restore(notebook.id)
                        }.tint(.blue)
                        Button("Sil", systemImage: "trash", role: .destructive) {
                            pendingDelete = notebook
                        }
                    } else {
                        Button(notebook.isFavourite ? "Favoriden Çıkar" : "Favori",
                               systemImage: notebook.isFavourite ? "star.slash" : "star") {
                            store.toggleFavourite(notebook.id)
                        }.tint(.orange)
                        Button("Çöpe At", systemImage: "trash", role: .destructive) {
                            store.moveToTrash(notebook.id)
                        }
                    }
                }
            }
        }
        .listStyle(.insetGrouped)
        .scrollContentBackground(.hidden)
    }

    // MARK: - Ortak menü ve işlemler

    @ViewBuilder
    private func notebookMenu(_ notebook: Notebook) -> some View {
        Button("Yeniden Adlandır", systemImage: "pencil") {
            renamingNotebookID = notebook.id
            renameTitle = notebook.title
            showingRenameDialog = true
        }
        Menu("Kapak", systemImage: "book.closed") {
            ForEach(Array(NotebookCover.presets.enumerated()), id: \.offset) { entry in
                Button {
                    store.setCover(entry.element, notebookID: notebook.id)
                } label: {
                    if notebook.cover == entry.element {
                        Label(entry.element.title, systemImage: "checkmark")
                    } else {
                        Text(entry.element.title)
                    }
                }
            }
            if !settings.customCoverAssets.isEmpty {
                Section("Kendi kapaklarım") {
                    ForEach(Array(settings.customCoverAssets.enumerated()), id: \.offset) { entry in
                        Button("Kapak \(entry.offset + 1)") {
                            store.setCover(NotebookCover(pattern: .plain, colorHex: "#DDDDDD", imageAssetName: entry.element), notebookID: notebook.id)
                        }
                    }
                }
            }
        }
        Button(notebook.isFavourite ? "Favoriden Çıkar" : "Favorilere Ekle",
               systemImage: notebook.isFavourite ? "star.slash" : "star") {
            store.toggleFavourite(notebook.id)
        }
        Divider()
        Button("Çöpe At", systemImage: "trash", role: .destructive) {
            store.moveToTrash(notebook.id)
        }
    }

    private func createNotebook() {
        let id = store.createNotebook(cover: settings.defaultCover)
        path.append(id)
    }

    /// Kapak açılış animasyonu, sonra editöre geçiş.
    private func open(_ notebook: Notebook) {
        guard openingNotebookID == nil else { return }
        openingNotebookID = notebook.id
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.6) {
            path.append(notebook.id)
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) {
                openingNotebookID = nil
            }
        }
    }
}

private struct NotebookRow: View {
    let notebook: Notebook
    let showingTrash: Bool
    let coverImage: UIImage?

    var body: some View {
        HStack(spacing: 14) {
            NotebookCoverView(cover: notebook.cover ?? .fallback, image: coverImage)
                .frame(width: 48, height: 62)
            VStack(alignment: .leading, spacing: 5) {
                HStack {
                    Text(notebook.title).font(.headline)
                    if notebook.isFavourite && !showingTrash {
                        Image(systemName: "star.fill").font(.caption).foregroundStyle(.orange)
                    }
                }
                Text("\(notebook.pages.count) sayfa · \(notebook.updatedAt.formatted(date: .long, time: .omitted))")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(.vertical, 4)
    }
}
