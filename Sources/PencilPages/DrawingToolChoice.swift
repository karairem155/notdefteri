import PencilKit
import SwiftUI
import UIKit

enum InkColor: String, CaseIterable, Identifiable, Equatable {
    case black
    case blue
    case red
    case green
    case purple

    var id: String { rawValue }
    var title: String { rawValue.capitalized }

    var color: Color {
        switch self {
        case .black: .black
        case .blue: .blue
        case .red: .red
        case .green: .green
        case .purple: .purple
        }
    }
}

enum DrawingToolChoice: String, CaseIterable, Identifiable, Equatable {
    case pen
    case pencil
    case highlighter
    case eraser
    case lasso

    var id: String { rawValue }
    var title: String { rawValue.capitalized }

    var symbol: String {
        switch self {
        case .pen: "pencil.tip"
        case .pencil: "pencil"
        case .highlighter: "highlighter"
        case .eraser: "eraser"
        case .lasso: "lasso"
        }
    }

    func makeTool(color: InkColor, width: CGFloat) -> PKTool {
        switch self {
        case .pen:
            PKInkingTool(.pen, color: UIColor(color.color), width: width)
        case .pencil:
            PKInkingTool(.pencil, color: UIColor(color.color), width: width)
        case .highlighter:
            PKInkingTool(.marker, color: UIColor(color.color).withAlphaComponent(0.42), width: width * 2.5)
        case .eraser:
            PKEraserTool(.vector)
        case .lasso:
            PKLassoTool()
        }
    }
}

struct DrawingToolConfiguration: Equatable {
    var choice: DrawingToolChoice
    var color: InkColor
    var width: CGFloat

    func makeTool() -> PKTool {
        choice.makeTool(color: color, width: width)
    }
}
