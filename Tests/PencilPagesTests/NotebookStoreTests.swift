import Foundation
import XCTest
@testable import PencilPages

final class NotebookStoreTests: XCTestCase {
    @MainActor
    func testNotebookChangesSurviveStoreReopen() throws {
        let storageRoot = FileManager.default.temporaryDirectory
            .appendingPathComponent("PencilPagesTests-\(UUID().uuidString)", isDirectory: true)
        defer { try? FileManager.default.removeItem(at: storageRoot) }

        let notebookID: UUID
        let pageID: UUID
        do {
            let store = NotebookStore(storageRootURL: storageRoot)
            guard let firstNotebook = store.notebooks.first, let firstPage = store.notebooks.first?.pages.first else {
                return XCTFail("The starter notebook and page should be available")
            }
            notebookID = firstNotebook.id
            pageID = firstPage.id
            store.setPaper(.grid, notebookID: notebookID, pageID: pageID)
            store.flushPendingSaves()
        }

        let reopenedStore = NotebookStore(storageRootURL: storageRoot)
        let reopenedNotebook = try XCTUnwrap(reopenedStore.notebook(id: notebookID))
        XCTAssertEqual(reopenedNotebook.pages.first?.id, pageID)
        XCTAssertEqual(reopenedNotebook.pages.first?.paper, .grid)
        XCTAssertNil(reopenedStore.storageMessage)
    }

    @MainActor
    func testUnreadableNotebookFileIsPreserved() throws {
        let storageRoot = FileManager.default.temporaryDirectory
            .appendingPathComponent("PencilPagesTests-\(UUID().uuidString)", isDirectory: true)
        try FileManager.default.createDirectory(at: storageRoot, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: storageRoot) }

        let originalBytes = Data([0x00, 0x01, 0x02])
        let fileURL = storageRoot.appendingPathComponent("\(UUID().uuidString).pencilpages")
        try originalBytes.write(to: fileURL)

        let store = NotebookStore(storageRootURL: storageRoot)

        XCTAssertTrue(store.notebooks.isEmpty)
        XCTAssertNotNil(store.storageMessage)
        XCTAssertEqual(try Data(contentsOf: fileURL), originalBytes)
    }

    @MainActor
    func testNotebookRenameAndPageManagementPersistAndKeepOnePage() throws {
        let storageRoot = FileManager.default.temporaryDirectory
            .appendingPathComponent("PencilPagesTests-\(UUID().uuidString)", isDirectory: true)
        defer { try? FileManager.default.removeItem(at: storageRoot) }

        let store = NotebookStore(storageRootURL: storageRoot)
        let notebook = try XCTUnwrap(store.notebooks.first)
        let originalPageID = try XCTUnwrap(notebook.pages.first?.id)
        store.renameNotebook(notebook.id, to: "  Biology Notes  ")
        let duplicatePageID = try XCTUnwrap(store.duplicatePage(in: notebook.id, pageID: originalPageID))

        store.movePage(in: notebook.id, pageID: duplicatePageID, by: -1)
        XCTAssertTrue(store.deletePage(in: notebook.id, pageID: originalPageID))
        XCTAssertFalse(store.deletePage(in: notebook.id, pageID: duplicatePageID))
        XCTAssertTrue(store.flushPendingSaves())

        let reopenedStore = NotebookStore(storageRootURL: storageRoot)
        let reopenedNotebook = try XCTUnwrap(reopenedStore.notebook(id: notebook.id))
        XCTAssertEqual(reopenedNotebook.title, "Biology Notes")
        XCTAssertEqual(reopenedNotebook.pages.map(\.id), [duplicatePageID])
        XCTAssertNil(reopenedStore.storageMessage)
    }

    @MainActor
    func testFlushRetriesNotebookAfterStorageBecomesAvailable() async throws {
        let storageRoot = FileManager.default.temporaryDirectory
            .appendingPathComponent("PencilPagesBlockedStorage-\(UUID().uuidString)")
        try Data([0x01]).write(to: storageRoot)
        defer { try? FileManager.default.removeItem(at: storageRoot) }

        let store = NotebookStore(storageRootURL: storageRoot)
        let notebookID = store.createNotebook()
        store.renameNotebook(notebookID, to: "Saved After Recovery")
        XCTAssertNotNil(store.storageMessage)
        try await Task.sleep(nanoseconds: 800_000_000)

        try FileManager.default.removeItem(at: storageRoot)
        try FileManager.default.createDirectory(at: storageRoot, withIntermediateDirectories: true)
        XCTAssertTrue(store.flushPendingSaves())

        let reopenedStore = NotebookStore(storageRootURL: storageRoot)
        XCTAssertEqual(reopenedStore.notebook(id: notebookID)?.title, "Saved After Recovery")
        XCTAssertNil(reopenedStore.storageMessage)
    }
}
