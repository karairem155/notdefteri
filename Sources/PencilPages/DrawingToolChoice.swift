import PencilKit
import SwiftUI
import UIKit

enum DrawingToolChoice: String, CaseIterable, Identifiable, Equatable, Codable {
    case pen
    case pencil
    case highlighter
    case eraser
    case lasso

    var id: String { rawValue }

    var title: String {
        switch self {
        case .pen: "Kalem"
        case .pencil: "Kurşun Kalem"
        case .highlighter: "Fosforlu"
        case .eraser: "Silgi"
        case .lasso: "Kement"
        }
    }

    var symbol: String {
        switch self {
        case .pen: "pencil.tip"
        case .pencil: "pencil"
        case .highlighter: "highlighter"
        case .eraser: "eraser"
        case .lasso: "lasso"
        }
    }

    /// Renk ve kalınlık taşıyan araçlar. Silgi ve kement taşımaz.
    var isInking: Bool {
        self == .pen || self == .pencil || self == .highlighter
    }

    static let inkingChoices: [DrawingToolChoice] = [.pen, .pencil, .highlighter]

    func makeTool(color: UIColor, width: CGFloat) -> PKTool {
        switch self {
        case .pen:
            PKInkingTool(.pen, color: color, width: width)
        case .pencil:
            PKInkingTool(.pencil, color: color, width: width)
        case .highlighter:
            PKInkingTool(.marker, color: color.withAlphaComponent(0.42), width: width * 2.5)
        case .eraser:
            PKEraserTool(.vector)
        case .lasso:
            PKLassoTool()
        }
    }
}

// O an seçili araç: araç + renk (hex) + kalınlık.
// Favori kalemlerle aynı üçlü; FavoritePen bunun kalıcı hâli.
struct DrawingToolConfiguration: Equatable {
    var choice: DrawingToolChoice
    var colorHex: String
    var width: CGFloat

    static let fallback = DrawingToolConfiguration(choice: .pen, colorHex: "#1C1C1E", width: 3)

    init(choice: DrawingToolChoice, colorHex: String, width: CGFloat) {
        self.choice = choice
        self.colorHex = colorHex
        self.width = width
    }

    init(favorite: FavoritePen) {
        self.init(choice: favorite.choice, colorHex: favorite.colorHex, width: CGFloat(favorite.width))
    }

    var uiColor: UIColor {
        UIColor(hexString: colorHex) ?? .black
    }

    var color: Color {
        Color(uiColor)
    }

    func makeTool() -> PKTool {
        choice.makeTool(color: uiColor, width: width)
    }

    /// Bu ayar verilen favoriyle birebir aynı mı?
    func matches(_ pen: FavoritePen) -> Bool {
        choice == pen.choice
            && colorHex.caseInsensitiveCompare(pen.colorHex) == .orderedSame
            && abs(Double(width) - pen.width) < 0.01
    }
}
