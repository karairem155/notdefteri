import Foundation
import SwiftUI
import PencilKit
import UIKit

// Favori kalemler.
// Bir favori = araç + renk + kalınlık üçlüsü. Kalem panelindeki "Favorilere ekle"
// düğmesi o anki üçlüyü buraya kaydeder. Varsayılan kalem de burada tutulur.

struct FavoritePen: Codable, Identifiable, Equatable {
    var id: UUID
    var tool: String        // "pen" | "pencil" | "highlighter" | "blur"
    var colorHex: String    // "#1C1C1E"
    var width: Double       // punto
    var name: String        // kullanıcıya görünen ad

    init(id: UUID = UUID(), tool: String, colorHex: String, width: Double, name: String) {
        self.id = id
        self.tool = tool
        self.colorHex = colorHex
        self.width = width
        self.name = name
    }
}

@MainActor
final class PenFavoritesStore: ObservableObject {
    @Published private(set) var favorites: [FavoritePen] = []
    @Published private(set) var defaultPenID: UUID?

    private let favoritesKey = "notdefteri.favoritePens"
    private let defaultKey = "notdefteri.defaultPenID"
    private let defaults: UserDefaults

    static let starterSet: [FavoritePen] = [
        FavoritePen(tool: "pen", colorHex: "#1C1C1E", width: 3, name: "Kalem"),
        FavoritePen(tool: "pen", colorHex: "#C8352B", width: 5, name: "Kırmızı"),
        FavoritePen(tool: "highlighter", colorHex: "#E0A81E", width: 14, name: "Fosforlu"),
        FavoritePen(tool: "pencil", colorHex: "#3E6BB8", width: 4, name: "Kurşun")
    ]

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        load()
        if favorites.isEmpty {
            favorites = Self.starterSet
            defaultPenID = favorites.first?.id
            save()
        }
    }

    var defaultPen: FavoritePen? {
        guard let defaultPenID else { return favorites.first }
        return favorites.first { $0.id == defaultPenID } ?? favorites.first
    }

    func add(_ pen: FavoritePen) {
        guard !favorites.contains(where: {
            $0.tool == pen.tool && $0.colorHex == pen.colorHex && $0.width == pen.width
        }) else { return }
        favorites.append(pen)
        save()
    }

    func remove(_ id: UUID) {
        favorites.removeAll { $0.id == id }
        if defaultPenID == id { defaultPenID = favorites.first?.id }
        save()
    }

    func makeDefault(_ id: UUID) {
        guard favorites.contains(where: { $0.id == id }) else { return }
        defaultPenID = id
        save()
    }

    private func load() {
        if let data = defaults.data(forKey: favoritesKey),
           let decoded = try? JSONDecoder().decode([FavoritePen].self, from: data) {
            favorites = decoded
        }
        if let raw = defaults.string(forKey: defaultKey) {
            defaultPenID = UUID(uuidString: raw)
        }
    }

    private func save() {
        if let data = try? JSONEncoder().encode(favorites) {
            defaults.set(data, forKey: favoritesKey)
        }
        defaults.set(defaultPenID?.uuidString, forKey: defaultKey)
    }
}

// Favoriyi PencilKit aracına çevirir.
extension FavoritePen {
    func makeTool() -> PKTool {
        let uiColor = UIColor(hexString: colorHex) ?? .black
        switch tool {
        case "pencil":
            return PKInkingTool(.pencil, color: uiColor, width: CGFloat(width))
        case "highlighter":
            return PKInkingTool(.marker, color: uiColor.withAlphaComponent(0.42), width: CGFloat(width))
        default:
            return PKInkingTool(.pen, color: uiColor, width: CGFloat(width))
        }
    }

    var swiftUIColor: Color {
        Color(UIColor(hexString: colorHex) ?? .black)
    }
}

extension UIColor {
    convenience init?(hexString: String) {
        var hex = hexString.trimmingCharacters(in: .whitespacesAndNewlines)
        if hex.hasPrefix("#") { hex.removeFirst() }
        guard hex.count == 6, let value = UInt32(hex, radix: 16) else { return nil }
        self.init(
            red: CGFloat((value >> 16) & 0xFF) / 255,
            green: CGFloat((value >> 8) & 0xFF) / 255,
            blue: CGFloat(value & 0xFF) / 255,
            alpha: 1
        )
    }

    var hexString: String {
        var r: CGFloat = 0, g: CGFloat = 0, b: CGFloat = 0, a: CGFloat = 0
        getRed(&r, green: &g, blue: &b, alpha: &a)
        return String(format: "#%02X%02X%02X",
                      Int(round(r * 255)), Int(round(g * 255)), Int(round(b * 255)))
    }
}
