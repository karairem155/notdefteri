import SwiftUI

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
                        showingTrash ? "Trash is Empty" : "No Notebooks",
                        systemImage: showingTrash ? "trash" : "book.closed",
                        description: Text(showingTrash ? "Deleted notebooks will appear here." : "Create a notebook to get started.")
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
                                        Label("Rename", systemImage: "pencil")
                                    }
                                }
                            }
                            .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                                if showingTrash {
                                    Button("Restore", systemImage: "arrow.uturn.backward") {
                                        store.restore(notebook.id)
                                    }.tint(.blue)
                                    Button("Delete", systemImage: "trash", role: .destructive) {
                                        pendingDelete = notebook
                                    }
                                } else {
                                    Button("Favourite", systemImage: notebook.isFavourite ? "star.slash" : "star") {
                                        store.toggleFavourite(notebook.id)
                                    }.tint(.orange)
                                    Button("Trash", systemImage: "trash", role: .destructive) {
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
            .navigationTitle(showingTrash ? "Trash" : "Pencil Pages")
            .searchable(text: $searchText, prompt: "Search notebooks")
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button {
                        showingTrash.toggle()
                        searchText = ""
                    } label: {
                        Label(showingTrash ? "Library" : "Trash", systemImage: showingTrash ? "books.vertical" : "trash")
                    }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    if !showingTrash {
                        Button {
                            let id = store.createNotebook()
                            path.append(id)
                        } label: {
                            Label("New Notebook", systemImage: "plus")
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
            .confirmationDialog("Delete this notebook permanently?", isPresented: Binding(
                get: { pendingDelete != nil },
                set: { if !$0 { pendingDelete = nil } }
            ), titleVisibility: .visible) {
                Button("Delete Permanently", role: .destructive) {
                    if let pendingDelete { store.permanentlyDelete(pendingDelete.id) }
                    pendingDelete = nil
                }
                Button("Cancel", role: .cancel) { pendingDelete = nil }
            } message: {
                Text("This cannot be undone. Export a copy first if you want to keep it.")
            }
            .alert("Rename Notebook", isPresented: $showingRenameDialog) {
                TextField("Notebook name", text: $renameTitle)
                Button("Save") {
                    if let renamingNotebookID {
                        store.renameNotebook(renamingNotebookID, to: renameTitle)
                    }
                    renamingNotebookID = nil
                }
                .disabled(renameTitle.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                Button("Cancel", role: .cancel) { renamingNotebookID = nil }
            } message: {
                Text("Enter a name for this notebook.")
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
                .fill(Color(red: 0.91, green: 0.94, blue: 0.97))
                .frame(width: 48, height: 60)
                .overlay(alignment: .topLeading) {
                    Image(systemName: "pencil.line")
                        .font(.title3)
                        .foregroundStyle(Color(red: 0.34, green: 0.46, blue: 0.62))
                        .padding(9)
                }
            VStack(alignment: .leading, spacing: 5) {
                HStack {
                    Text(notebook.title).font(.headline)
                    if notebook.isFavourite && !showingTrash {
                        Image(systemName: "star.fill").font(.caption).foregroundStyle(.orange)
                    }
                }
                Text("\(notebook.pages.count) page\(notebook.pages.count == 1 ? "" : "s") · Edited \(notebook.updatedAt.formatted(date: .abbreviated, time: .shortened))")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(.vertical, 4)
    }
}
