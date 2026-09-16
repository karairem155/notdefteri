import Foundation
import SwiftUI

// Ayarlar ekranındaki değerler (docs/tasarim/13-Ayarlar.png). Hiçbiri kodda sabit değil.
// Tek/çift görünüm ve buzlu kalem ayarları editörde @AppStorage ile aynı anahtarları kullanır.

enum PageSizeOption: String, CaseIterable, Identifiable {
    case a4, letter, square, ipad

    var id: String { rawValue }

    var title: String {
        switch self {
        case .a4: "A4"
        case .letter: "Letter"
        case .square: "Kare"
        case .ipad: "iPad ekranı"
        }
    }

    var size: CGSize {
        switch self {
        case .a4: CGSize(width: 595, height: 842)
        case .letter: CGSize(width: 612, height: 792)
        case .square: CGSize(width: 700, height: 700)
        case .ipad: CGSize(width: 768, height: 1024)
        }
    }
}

extension TemplateSelection {
    /// UserDefaults'ta saklanan biçim: "builtin:ruled" ya da "custom:<uuid>".
    var rawString: String {
        switch self {
        case .builtin(let style): "builtin:\(style.rawValue)"
        case .custom(let id): "custom:\(id.uuidString)"
        }
    }

    init?(rawString: String) {
        let parts = rawString.split(separator: ":", maxSplits: 1).map(String.init)
        guard parts.count == 2 else { return nil }
        switch parts[0] {
        case "builtin":
            guard let style = PaperStyle(rawValue: parts[1]) else { return nil }
            self = .builtin(style)
        case "custom":
            guard let id = UUID(uuidString: parts[1]) else { return nil }
            self = .custom(id)
        default:
            return nil
        }
    }
}

@MainActor
final class AppSettings: ObservableObject {
    static let spreadModeKey = "notdefteri.spreadMode"
    static let pencilOnlyKey = "notdefteri.pencilOnly"

    private let defaults: UserDefaults

    @Published var defaultPageSize: PageSizeOption {
        didSet { defaults.set(defaultPageSize.rawValue, forKey: "notdefteri.defaultPageSize") }
    }

    /// nil = "Son kullanılan"; dolu ise yeni sayfalar hep bu şablonla açılır.
    @Published var newPageTemplate: TemplateSelection? {
        didSet { defaults.set(newPageTemplate?.rawString, forKey: "notdefteri.newPageTemplate") }
    }

    @Published var lastUsedTemplate: TemplateSelection? {
        didSet { defaults.set(lastUsedTemplate?.rawString, forKey: "notdefteri.lastUsedTemplate") }
    }

    @Published var defaultCover: NotebookCover {
        didSet {
            if let data = try? JSONEncoder().encode(defaultCover) {
                defaults.set(data, forKey: "notdefteri.defaultCover")
            }
        }
    }

    /// Kullanıcının eklediği kapak görselleri (Documents/assets/ dosya adları).
    @Published var customCoverAssets: [String] {
        didSet { defaults.set(customCoverAssets, forKey: "notdefteri.customCovers") }
    }

    @Published var pencilOnly: Bool {
        didSet { defaults.set(pencilOnly, forKey: Self.pencilOnlyKey) }
    }

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        defaultPageSize = PageSizeOption(rawValue: defaults.string(forKey: "notdefteri.defaultPageSize") ?? "") ?? .a4
        newPageTemplate = defaults.string(forKey: "notdefteri.newPageTemplate").flatMap(TemplateSelection.init(rawString:))
        lastUsedTemplate = defaults.string(forKey: "notdefteri.lastUsedTemplate").flatMap(TemplateSelection.init(rawString:))
        if let data = defaults.data(forKey: "notdefteri.defaultCover"),
           let cover = try? JSONDecoder().decode(NotebookCover.self, from: data) {
            defaultCover = cover
        } else {
            defaultCover = .fallback
        }
        customCoverAssets = defaults.stringArray(forKey: "notdefteri.customCovers") ?? []
        pencilOnly = defaults.object(forKey: Self.pencilOnlyKey) == nil ? true : defaults.bool(forKey: Self.pencilOnlyKey)
    }

    /// Yeni sayfa için başlangıç şablonu: ayardaki sabit şablon ya da son kullanılan.
    func initialTemplate(fallback: TemplateSelection) -> TemplateSelection {
        newPageTemplate ?? lastUsedTemplate ?? fallback
    }
}
