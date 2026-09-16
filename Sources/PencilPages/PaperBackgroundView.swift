import SwiftUI

// Uygulamayla gelen kağıt çizimleri. Kağıt krem rengi (05-NotEditoru.png).
struct PaperBackgroundView: View {
    let style: PaperStyle

    static let paperColor = Color(red: 0.95, green: 0.94, blue: 0.90)
    private let ink = Color(red: 0.74, green: 0.76, blue: 0.80)

    var body: some View {
        Canvas { context, size in
            switch style {
            case .blank:
                break
            case .ruled:
                var lines = Path()
                stride(from: 32.0, through: size.height, by: 32.0).forEach { y in
                    lines.move(to: CGPoint(x: 0, y: y))
                    lines.addLine(to: CGPoint(x: size.width, y: y))
                }
                context.stroke(lines, with: .color(ink), lineWidth: 0.6)
            case .grid:
                var grid = Path()
                stride(from: 24.0, through: size.width, by: 24.0).forEach { x in
                    grid.move(to: CGPoint(x: x, y: 0))
                    grid.addLine(to: CGPoint(x: x, y: size.height))
                }
                stride(from: 24.0, through: size.height, by: 24.0).forEach { y in
                    grid.move(to: CGPoint(x: 0, y: y))
                    grid.addLine(to: CGPoint(x: size.width, y: y))
                }
                context.stroke(grid, with: .color(ink), lineWidth: 0.55)
            case .dotted:
                for x in stride(from: 16.0, through: size.width, by: 24.0) {
                    for y in stride(from: 16.0, through: size.height, by: 24.0) {
                        let dot = CGRect(x: x, y: y, width: 1.5, height: 1.5)
                        context.fill(Path(ellipseIn: dot), with: .color(ink))
                    }
                }
            }
        }
        .background(Self.paperColor)
        .accessibilityHidden(true)
    }
}
