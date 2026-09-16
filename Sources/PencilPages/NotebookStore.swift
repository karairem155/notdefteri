import Foundation
import Combine
import PencilKit

@MainActor
final class NotebookStore: ObservableObject {
    @Published private(set) var notebooks: [Notebook] = []
    @Published private(set) var storageMessage: String?

    private var pendingSaves: [UUID: DispatchWorkItem] = [:]
    private var pendingSaveTokens: [UUID: UUID] = [:]
    private var dirtyNotebookIDs: Set<UUID> = []
    private var loadWarning: String?
    private var writeWarnings: [UUID: String] = [:]
    private let fileManager = FileManager.default
    private let storageRootURL: URL?

    init(storageRootURL: URL? = nil) {
        self.storageRootURL = storageRootURL
        let hadNotebookFiles = loadNotebooks()
        if notebooks.isEmpty && !hadNotebookFiles && storageMessage == nil {
            let first = Notebook(title: "My First Notebook")
            notebooks = [first]
            dirtyNotebookIDs.insert(first.id)
            persist(first)
        }
    }

    var activeNotebooks: [Notebook] {
        notebooks.filter { !$0.isTrashed }.sorted {
            if $0.isFavourite != $1.isFavourite { return $0.isFavourite }
            return $0.updatedAt > $1.updatedAt
        }
    }

    var trashedNotebooks: [Notebook] {
        notebooks.filter(\.isTrashed).sorted { $0.updatedAt > $1.updatedAt }
    }

    func notebook(id: UUID) -> Notebook? {
        notebooks.first { $0.id == id }
    }

    @discardableResult
    func createNotebook() -> UUID {
        let title = "Notebook \(notebooks.count + 1)"
        let notebook = Notebook(title: title)
        notebooks.append(notebook)
        dirtyNotebookIDs.insert(notebook.id)
        persist(notebook)
        return notebook.id
    }

    func addPage(to notebookID: UUID) {
        mutate(notebookID) { notebook in
            notebook.pages.append(NotebookPage())
        }
    }

    func renameNotebook(_ notebookID: UUID, to title: String) {
        let cleanedTitle = title.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !cleanedTitle.isEmpty else { return }
        mutate(notebookID) { $0.title = cleanedTitle }
    }

    @discardableResult
    func duplicatePage(in notebookID: UUID, pageID: UUID) -> UUID? {
        guard let notebook = notebook(id: notebookID),
              let index = notebook.pages.firstIndex(where: { $0.id == pageID }) else { return nil }
        var duplicate = notebook.pages[index]
        duplicate.id = UUID()
        let duplicateID = duplicate.id
        mutate(notebookID) { notebook in
            notebook.pages.insert(duplicate, at: index + 1)
        }
        return duplicateID
    }

    func movePage(in notebookID: UUID, pageID: UUID, by offset: Int) {
        guard offset != 0,
              let notebook = notebook(id: notebookID),
              let index = notebook.pages.firstIndex(where: { $0.id == pageID }),
              notebook.pages.indices.contains(index + offset) else { return }
        mutate(notebookID) { notebook in
            let destination = index + offset
            let page = notebook.pages.remove(at: index)
            notebook.pages.insert(page, at: destination)
        }
    }

    @discardableResult
    func deletePage(in notebookID: UUID, pageID: UUID) -> Bool {
        guard let notebook = notebook(id: notebookID),
              notebook.pages.count > 1,
              let index = notebook.pages.firstIndex(where: { $0.id == pageID }) else { return false }
        mutate(notebookID) { notebook in
            notebook.pages.remove(at: index)
        }
        return true
    }

    func setPaper(_ paper: PaperStyle, notebookID: UUID, pageID: UUID) {
        mutate(notebookID) { notebook in
            guard let index = notebook.pages.firstIndex(where: { $0.id == pageID }) else { return }
            notebook.pages[index].paper = paper
        }
    }

    func updateDrawing(_ drawing: PKDrawing, notebookID: UUID, pageID: UUID, persistImmediately: Bool = false) {
        mutate(notebookID, persistImmediately: persistImmediately) { notebook in
            guard let index = notebook.pages.firstIndex(where: { $0.id == pageID }) else { return }
            notebook.pages[index].setDrawing(drawing)
        }
    }

    func toggleFavourite(_ notebookID: UUID) {
        mutate(notebookID) { $0.isFavourite.toggle() }
    }

    func moveToTrash(_ notebookID: UUID) {
        mutate(notebookID) { $0.isTrashed = true }
    }

    func restore(_ notebookID: UUID) {
        mutate(notebookID) { $0.isTrashed = false }
    }

    func permanentlyDelete(_ notebookID: UUID) {
        pendingSaves[notebookID]?.cancel()
        pendingSaves[notebookID] = nil
        pendingSaveTokens[notebookID] = nil
        do {
            try fileManager.removeItem(at: url(for: notebookID))
            notebooks.removeAll { $0.id == notebookID }
            dirtyNotebookIDs.remove(notebookID)
            writeWarnings[notebookID] = nil
            refreshStorageMessage()
        } catch {
            writeWarnings[notebookID] = "Could not delete that notebook: \(error.localizedDescription)"
            refreshStorageMessage()
        }
    }

    @discardableResult
    func flushPendingSaves() -> Bool {
        var allSavesSucceeded = true
        for workItem in pendingSaves.values {
            workItem.cancel()
        }
        pendingSaves.removeAll()
        pendingSaveTokens.removeAll()
        for id in Array(dirtyNotebookIDs) {
            guard let notebook = notebook(id: id) else {
                dirtyNotebookIDs.remove(id)
                continue
            }
            if !persist(notebook) { allSavesSucceeded = false }
        }
        return allSavesSucceeded
    }

    func exportURL(for notebookID: UUID) -> URL? {
        return fileManager.fileExists(atPath: url(for: notebookID).path) ? url(for: notebookID) : nil
    }

    private func mutate(_ id: UUID, persistImmediately: Bool = false, change: (inout Notebook) -> Void) {
        guard let index = notebooks.firstIndex(where: { $0.id == id }) else { return }
        change(&notebooks[index])
        notebooks[index].updatedAt = .now
        dirtyNotebookIDs.insert(id)
        if persistImmediately {
            _ = saveNow(id)
        } else {
            scheduleSave(for: id)
        }
    }

    @discardableResult
    func saveNow(_ notebookID: UUID) -> Bool {
        pendingSaves[notebookID]?.cancel()
        pendingSaves[notebookID] = nil
        pendingSaveTokens[notebookID] = nil
        guard let notebook = notebook(id: notebookID) else { return false }
        return persist(notebook)
    }

    private func scheduleSave(for id: UUID) {
        pendingSaves[id]?.cancel()
        let token = UUID()
        pendingSaveTokens[id] = token
        let work = DispatchWorkItem { [weak self] in
            guard let self,
                  self.pendingSaveTokens[id] == token,
                  let notebook = self.notebook(id: id) else { return }
            self.pendingSaveTokens[id] = nil
            self.pendingSaves[id] = nil
            self.persist(notebook)
        }
        pendingSaves[id] = work
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.6, execute: work)
    }

    @discardableResult
    private func loadNotebooks() -> Bool {
        do {
            try fileManager.createDirectory(at: documentsURL, withIntermediateDirectories: true)
            let files = try fileManager.contentsOfDirectory(at: documentsURL, includingPropertiesForKeys: nil)
                .filter { $0.pathExtension == "pencilpages" }
            var loaded: [Notebook] = []
            var failedCount = 0
            for file in files {
                do {
                    let data = try Data(contentsOf: file)
                    let notebook = try JSONDecoder().decode(Notebook.self, from: data)
                    let drawingsAreReadable = notebook.pages.allSatisfy { $0.drawing != nil }
                    let filenameID = UUID(uuidString: file.deletingPathExtension().lastPathComponent)
                    guard filenameID == notebook.id, notebook.formatVersion == 1, drawingsAreReadable else {
                        failedCount += 1
                        continue
                    }
                    loaded.append(notebook)
                } catch {
                    failedCount += 1
                }
            }
            notebooks = loaded
            if failedCount > 0 {
                loadWarning = "\(failedCount) notebook file(s) could not be opened. The original files were not overwritten."
            }
            refreshStorageMessage()
            return !files.isEmpty
        } catch {
            loadWarning = "Some notebooks could not be loaded: \(error.localizedDescription)"
            refreshStorageMessage()
            return true
        }
    }

    @discardableResult
    private func persist(_ notebook: Notebook) -> Bool {
        do {
            try fileManager.createDirectory(at: documentsURL, withIntermediateDirectories: true)
            let encoder = JSONEncoder()
            encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
            let data = try encoder.encode(notebook)
            try data.write(to: url(for: notebook.id), options: .atomic)
            dirtyNotebookIDs.remove(notebook.id)
            writeWarnings[notebook.id] = nil
            refreshStorageMessage()
            return true
        } catch {
            dirtyNotebookIDs.insert(notebook.id)
            writeWarnings[notebook.id] = "Could not save a notebook: \(error.localizedDescription)"
            refreshStorageMessage()
            return false
        }
    }

    private func refreshStorageMessage() {
        storageMessage = writeWarnings.values.first ?? loadWarning
    }

    private func url(for id: UUID) -> URL {
        documentsURL.appendingPathComponent("\(id.uuidString).pencilpages")
    }

    private var documentsURL: URL {
        storageRootURL ?? fileManager.urls(for: .documentDirectory, in: .userDomainMask)[0]
    }
}
