import Foundation
import PencilKit

enum PaperStyle: String, Codable, CaseIterable, Identifiable {
    case blank
    case ruled
    case grid
    case dotted

    var id: String { rawValue }
    var title: String {
        switch self {
        case .blank: "Boş"
        case .ruled: "Çizgili"
        case .grid: "Kareli"
        case .dotted: "Noktalı"
        }
    }
}

struct NotebookPage: Codable, Identifiable, Equatable {
    var id: UUID
    var drawingData: Data
    var paper: PaperStyle

    // --- eklenenler ---
    // Kendi eklediğin şablonu kullanıyorsa TemplateLibrary'deki kaydın kimliği.
    // nil ise yukarıdaki `paper` geçerli. Her sayfa kendi şablonunu tuttuğu için
    // aynı defterde sayfa sayfa farklı tasarım kullanılabiliyor.
    var customTemplateID: UUID?
    // Fotoğraflar, çıkartmalar, bantlar ve buzlu örtüler.
    var overlay: PageOverlayData?

    init(id: UUID = UUID(),
         drawing: PKDrawing = PKDrawing(),
         paper: PaperStyle = .ruled,
         customTemplateID: UUID? = nil,
         overlay: PageOverlayData? = nil) {
        self.id = id
        self.drawingData = drawing.dataRepresentation()
        self.paper = paper
        self.customTemplateID = customTemplateID
        self.overlay = overlay
    }

    var drawing: PKDrawing? {
        try? PKDrawing(data: drawingData)
    }

    mutating func setDrawing(_ drawing: PKDrawing) {
        drawingData = drawing.dataRepresentation()
    }
}

struct Notebook: Codable, Identifiable, Equatable {
    var id: UUID
    var title: String
    var createdAt: Date
    var updatedAt: Date
    var isFavourite: Bool
    var isTrashed: Bool
    var pages: [NotebookPage]
    var formatVersion: Int

    init(id: UUID = UUID(), title: String, pages: [NotebookPage] = [NotebookPage()]) {
        self.id = id
        self.title = title
        self.createdAt = .now
        self.updatedAt = .now
        self.isFavourite = false
        self.isTrashed = false
        self.pages = pages
        self.formatVersion = 1
    }
}
