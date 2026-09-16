import SwiftUI
import UIKit

// Defter kapağı (docs/tasarim/02-DefterGorunumu.png).
// Uygulamayla gelen desenler + kullanıcının eklediği görseller.
// Kapakta isim yazmaz; isim rafta kapağın altındadır.

enum CoverPattern: String, Codable, CaseIterable {
    case hearts, gingham, grid, stars, lines, dots, plain

    var title: String {
        switch self {
        case .hearts: "Kalpli"
        case .gingham: "Pötikare"
        case .grid: "Kareli"
        case .stars: "Yıldızlı"
        case .lines: "Çizgili"
        case .dots: "Puantiyeli"
        case .plain: "Düz"
        }
    }
}

struct NotebookCover: Codable, Equatable {
    var pattern: CoverPattern
    var colorHex: String
    var imageAssetName: String?    // kullanıcının kendi kapak görseli (Documents/assets/)

    init(pattern: CoverPattern, colorHex: String, imageAssetName: String? = nil) {
        self.pattern = pattern
        self.colorHex = colorHex
        self.imageAssetName = imageAssetName
    }

    /// 02-DefterGorunumu.png'deki yedi kapak.
    static let presets: [NotebookCover] = [
        NotebookCover(pattern: .hearts, colorHex: "#F7C6D3"),
        NotebookCover(pattern: .gingham, colorHex: "#F5DE8C"),
        NotebookCover(pattern: .grid, colorHex: "#CFC6F2"),
        NotebookCover(pattern: .stars, colorHex: "#B9E5CB"),
        NotebookCover(pattern: .lines, colorHex: "#E9CFA0"),
        NotebookCover(pattern: .grid, colorHex: "#BFD8F4"),
        NotebookCover(pattern: .dots, colorHex: "#F3BFA9")
    ]

    static let fallback = presets[5]

    var title: String {
        imageAssetName != nil ? "Kendi kapağım" : pattern.title
    }
}

// Kapağın çizimi: desenli ön yüz, sağda cilt şeridi, altında sayfa kenarları.
struct NotebookCoverView: View {
    let cover: NotebookCover
    var image: UIImage? = nil

    private var base: Color {
        Color(UIColor(hexString: cover.colorHex) ?? .systemBlue)
    }

    private var inkOpacity: Double { 0.28 }

    var body: some View {
        ZStack(alignment: .trailing) {
            // Alttaki sayfa kenarları
            RoundedRectangle(cornerRadius: 3)
                .fill(Color(red: 0.93, green: 0.92, blue: 0.88))
                .padding(.leading, 6)
                .offset(x: 3, y: 3)

            // Ön kapak
            ZStack {
                if let image {
                    Image(uiImage: image)
                        .resizable()
                        .scaledToFill()
                } else {
                    base
                    CoverPatternCanvas(pattern: cover.pattern, ink: Color.black.opacity(inkOpacity))
                    LinearGradient(colors: [Color.white.opacity(0.18), .clear, Color.black.opacity(0.08)],
                                   startPoint: .topLeading, endPoint: .bottomTrailing)
                }
            }
            .clipShape(UnevenRoundedRectangle(topLeadingRadius: 10, bottomLeadingRadius: 10, bottomTrailingRadius: 3, topTrailingRadius: 3))
            .overlay(alignment: .trailing) {
                // Cilt şeridi
                Rectangle()
                    .fill(Color(red: 0.94, green: 0.92, blue: 0.86))
                    .frame(width: 7)
                    .overlay(alignment: .leading) {
                        Rectangle().fill(Color.black.opacity(0.12)).frame(width: 1)
                    }
            }
            .clipShape(UnevenRoundedRectangle(topLeadingRadius: 10, bottomLeadingRadius: 10, bottomTrailingRadius: 3, topTrailingRadius: 3))
            .padding(.trailing, 6)
        }
        .shadow(color: .black.opacity(0.18), radius: 8, y: 5)
        .accessibilityHidden(true)
    }
}

// Desenler Canvas ile çizilir; görsel dosyası gerekmez.
private struct CoverPatternCanvas: View {
    let pattern: CoverPattern
    let ink: Color

    var body: some View {
        Canvas { context, size in
            switch pattern {
            case .plain:
                break
            case .lines:
                var path = Path()
                for y in stride(from: 22.0, through: size.height, by: 18.0) {
                    path.move(to: CGPoint(x: 8, y: y))
                    path.addLine(to: CGPoint(x: size.width - 8, y: y))
                }
                context.stroke(path, with: .color(ink), lineWidth: 1)
            case .grid:
                var path = Path()
                for x in stride(from: 14.0, through: size.width, by: 16.0) {
                    path.move(to: CGPoint(x: x, y: 0))
                    path.addLine(to: CGPoint(x: x, y: size.height))
                }
                for y in stride(from: 14.0, through: size.height, by: 16.0) {
                    path.move(to: CGPoint(x: 0, y: y))
                    path.addLine(to: CGPoint(x: size.width, y: y))
                }
                context.stroke(path, with: .color(ink), lineWidth: 0.8)
            case .gingham:
                for x in stride(from: 0.0, through: size.width, by: 28.0) {
                    context.fill(Path(CGRect(x: x, y: 0, width: 14, height: size.height)), with: .color(ink.opacity(0.55)))
                }
                for y in stride(from: 0.0, through: size.height, by: 28.0) {
                    context.fill(Path(CGRect(x: 0, y: y, width: size.width, height: 14)), with: .color(ink.opacity(0.55)))
                }
            case .dots:
                for (row, y) in stride(from: 16.0, through: size.height, by: 22.0).enumerated() {
                    let offset = row % 2 == 0 ? 0.0 : 11.0
                    for x in stride(from: 12.0 + offset, through: size.width, by: 22.0) {
                        context.fill(Path(ellipseIn: CGRect(x: x - 3, y: y - 3, width: 6, height: 6)), with: .color(Color.white.opacity(0.85)))
                    }
                }
            case .hearts:
                let spots: [(CGFloat, CGFloat)] = [(0.2, 0.12), (0.62, 0.1), (0.4, 0.2), (0.82, 0.2), (0.2, 0.72), (0.86, 0.78), (0.3, 0.84), (0.65, 0.86)]
                for spot in spots {
                    let center = CGPoint(x: spot.0 * size.width, y: spot.1 * size.height)
                    context.fill(heartPath(center: center, size: 12), with: .color(ink))
                }
            case .stars:
                let spots: [(CGFloat, CGFloat)] = [(0.22, 0.14), (0.7, 0.1), (0.45, 0.24), (0.86, 0.24), (0.24, 0.78), (0.8, 0.74), (0.52, 0.88)]
                for spot in spots {
                    let center = CGPoint(x: spot.0 * size.width, y: spot.1 * size.height)
                    context.fill(starPath(center: center, radius: 8), with: .color(ink))
                }
            }
        }
    }

    private func heartPath(center: CGPoint, size s: CGFloat) -> Path {
        var path = Path()
        let top = CGPoint(x: center.x, y: center.y - s * 0.25)
        path.move(to: CGPoint(x: center.x, y: center.y + s * 0.5))
        path.addCurve(to: top,
                      control1: CGPoint(x: center.x - s * 0.9, y: center.y - s * 0.1),
                      control2: CGPoint(x: center.x - s * 0.5, y: center.y - s * 0.8))
        path.addCurve(to: CGPoint(x: center.x, y: center.y + s * 0.5),
                      control1: CGPoint(x: center.x + s * 0.5, y: center.y - s * 0.8),
                      control2: CGPoint(x: center.x + s * 0.9, y: center.y - s * 0.1))
        path.closeSubpath()
        return path
    }

    private func starPath(center: CGPoint, radius: CGFloat) -> Path {
        var path = Path()
        let inner = radius * 0.45
        for i in 0..<10 {
            let angle = (Double(i) * 36 - 90) * Double.pi / 180
            let r = i % 2 == 0 ? radius : inner
            let point = CGPoint(x: center.x + CGFloat(cos(angle)) * r, y: center.y + CGFloat(sin(angle)) * r)
            if i == 0 { path.move(to: point) } else { path.addLine(to: point) }
        }
        path.closeSubpath()
        return path
    }
}
