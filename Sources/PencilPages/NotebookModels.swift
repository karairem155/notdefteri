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

/// İçe aktarılan bir PDF'in tek sayfası. Dosya Documents/pdfs/ içinde durur.
struct PDFPageReference: Codable, Equatable {
    var fileName: String
    var pageIndex: Int
}

struct NotebookPage: Codable, Identifiable, Equatable {
    static let defaultSize = CGSize(width: 595, height: 842)   // A4, punto

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
    // Sayfa boyutu (punto). nil ise A4. Eski kayıtlar A4 olarak açılır.
    var size: CGSize?
    // PDF'ten gelen sayfa: PDF arkada, el yazısı ayrı katmanda üstünde.
    var pdf: PDFPageReference?

    init(id: UUID = UUID(),
         drawing: PKDrawing = PKDrawing(),
         paper: PaperStyle = .ruled,
         customTemplateID: UUID? = nil,
         overlay: PageOverlayData? = nil,
         size: CGSize? = nil,
         pdf: PDFPageReference? = nil) {
        self.id = id
        self.drawingData = drawing.dataRepresentation()
        self.paper = paper
        self.customTemplateID = customTemplateID
        self.overlay = overlay
        self.size = size
        self.pdf = pdf
    }

    var drawing: PKDrawing? {
        try? PKDrawing(data: drawingData)
    }

    var pageSize: CGSize {
        size ?? Self.defaultSize
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
    // Raftaki kapak. nil ise varsayılan desen kullanılır.
    var cover: NotebookCover?

    init(id: UUID = UUID(), title: String, pages: [NotebookPage] = [NotebookPage()], cover: NotebookCover? = nil) {
        self.id = id
        self.title = title
        self.createdAt = .now
        self.updatedAt = .now
        self.isFavourite = false
        self.isTrashed = false
        self.pages = pages
        self.formatVersion = 1
        self.cover = cover
    }
}
