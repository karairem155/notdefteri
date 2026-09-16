import XCTest
import PencilKit
@testable import PencilPages

final class NotebookModelsTests: XCTestCase {
    func testNotebookRoundTripsThroughVersionedJSON() throws {
        let original = Notebook(title: "Lecture Notes", pages: [NotebookPage(paper: .grid), NotebookPage(paper: .blank)])
        let data = try JSONEncoder().encode(original)
        let decoded = try JSONDecoder().decode(Notebook.self, from: data)

        XCTAssertEqual(decoded.id, original.id)
        XCTAssertEqual(decoded.title, "Lecture Notes")
        XCTAssertEqual(decoded.pages.map(\.id), original.pages.map(\.id))
        XCTAssertEqual(decoded.pages.map(\.paper), [.grid, .blank])
        XCTAssertEqual(decoded.formatVersion, 1)
        XCTAssertTrue(decoded.pages.allSatisfy { $0.drawing?.strokes.isEmpty == true })
    }

    func testUnreadableInkIsNotReplacedByAnEmptyDrawing() {
        var page = NotebookPage()
        page.drawingData = Data([0x00, 0x01, 0x02])

        XCTAssertNil(page.drawing)
    }
}
