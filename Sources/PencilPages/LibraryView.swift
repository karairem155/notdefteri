import SwiftUI

// Kütüphane, liste hâli (docs/tasarim/01-Main.png). Açık renkli taraf.
// Kapak rafı ve kenar çubuğu 11. adımda gelecek.
struct LibraryView: View {
    @ObservedObject var store: NotebookStore
    @State private var showingTrash = false
    @State private var searchText = ""
    @State private var pendingDelete: Notebook?
    @State private var renamingNotebookID: UUID?
    @State private var renameTitle = ""
    @State private var showingRenameDialog = false
    @State private var path: [UUID] = []

    private var visibleNotebooks: [Notebook] {
        let source = showingTrash ? store.trashedNotebooks : store.activeNotebooks
        guard !searchText.isEmpty else { return source }
        return source.filter { $0.title.localizedCaseInsensitiveContains(searchText) }
    }

    var body: some View {
        NavigationStack(path: $path) {
            Group {
                if visibleNotebooks.isEmpty {
                    ContentUnavailableView(
                        showingTrash ? "Çöp Kutusu Boş" : "Defter Yok",
                        systemImage: showingTrash ? "trash" : "book.closed",
                        description: Text(showingTrash ? "Silinen defterler burada görünür." : "Başlamak için bir defter oluştur.")
                    )
                } else {
                    List {
                        ForEach(visibleNotebooks) { notebook in
                            NavigationLink(value: notebook.id) {
                                NotebookRow(notebook: notebook, showingTrash: showingTrash)
                            }
                            .contextMenu {
                                if !showingTrash {
                                    Button {
                                        renamingNotebookID = notebook.id
                                        renameTitle = notebook.title
                                        showingRenameDialog = true
                                    } label: {
                                        Label("Yeniden Adlandır", systemImage: "pencil")
                                    }
                                }
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
                }
            }
            .navigationDestination(for: UUID.self) { notebookID in
                NotebookEditorView(store: store, notebookID: notebookID)
            }
            .navigationTitle(showingTrash ? "Çöp Kutusu" : "Not Defteri")
            .searchable(text: $searchText, prompt: "Notlarda ara")
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button {
                        showingTrash.toggle()
                        searchText = ""
                    } label: {
                        Label(showingTrash ? "Kütüphane" : "Çöp Kutusu", systemImage: showingTrash ? "books.vertical" : "trash")
                    }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    if !showingTrash {
                        Button {
                            let id = store.createNotebook()
                            path.append(id)
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
}

private struct NotebookRow: View {
    let notebook: Notebook
    let showingTrash: Bool

    var body: some View {
        HStack(spacing: 14) {
            RoundedRectangle(cornerRadius: 8)
                .fill(Color.white)
                .frame(width: 48, height: 60)
                .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color.gray.opacity(0.35), lineWidth: 1))
                .overlay(alignment: .topLeading) {
                    VStack(alignment: .leading, spacing: 4) {
                        Capsule().fill(Color.gray.opacity(0.5)).frame(width: 30, height: 2)
                        Capsule().fill(Color.gray.opacity(0.5)).frame(width: 26, height: 2)
                        Capsule().fill(Color.gray.opacity(0.5)).frame(width: 30, height: 2)
                    }
                    .padding(8)
                }
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
