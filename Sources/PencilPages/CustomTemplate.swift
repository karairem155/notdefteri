import Foundation

// Kendi eklediğin sayfa şablonları.
//
// PaperStyle (blank/ruled/grid/dotted) uygulamayla gelen çizimlerdir.
// Bu ise senin Fotoğraflar veya Dosyalar'dan eklediğin görsellerdir:
// görsel Documents/templates/ içine kopyalanır, sayfa sadece adını tutar.
// Böylece aynı defterde sayfa sayfa farklı şablon kullanabilirsin.

struct CustomTemplate: Codable, Identifiable, Equatable {
    var id: UUID
    var name: String
    var assetName: String   // Documents/templates/ içindeki dosya adı
    var addedAt: Date

    init(id: UUID = UUID(), name: String, assetName: String, addedAt: Date = .now) {
        self.id = id
        self.name = name
        self.assetName = assetName
        self.addedAt = addedAt
    }
}

@MainActor
final class TemplateLibrary: ObservableObject {
    @Published private(set) var templates: [CustomTemplate] = []

    private let fileManager = FileManager.default
    private let indexName = "templates.json"

    var folderURL: URL {
        let documents = fileManager.urls(for: .documentDirectory, in: .userDomainMask)[0]
        let url = documents.appendingPathComponent("templates", isDirectory: true)
        if !fileManager.fileExists(atPath: url.path) {
            try? fileManager.createDirectory(at: url, withIntermediateDirectories: true)
        }
        return url
    }

    private var indexURL: URL { folderURL.appendingPathComponent(indexName) }

    init() { load() }

    func imageURL(for template: CustomTemplate) -> URL {
        folderURL.appendingPathComponent(template.assetName)
    }

    func template(id: UUID?) -> CustomTemplate? {
        guard let id else { return nil }
        return templates.first { $0.id == id }
    }

    /// Fotoğraf/Dosyalar'dan seçilen görseli kütüphaneye kopyalar.
    @discardableResult
    func importTemplate(named name: String, imageData: Data, fileExtension: String = "png") -> CustomTemplate? {
        let assetName = "\(UUID().uuidString).\(fileExtension)"
        let destination = folderURL.appendingPathComponent(assetName)
        do {
            try imageData.write(to: destination, options: .atomic)
        } catch {
            return nil
        }
        let template = CustomTemplate(name: name, assetName: assetName)
        templates.append(template)
        save()
        return template
    }

    func remove(_ id: UUID) {
        guard let index = templates.firstIndex(where: { $0.id == id }) else { return }
        let template = templates[index]
        try? fileManager.removeItem(at: imageURL(for: template))
        templates.remove(at: index)
        save()
    }

    private func load() {
        guard let data = try? Data(contentsOf: indexURL),
              let decoded = try? JSONDecoder().decode([CustomTemplate].self, from: data) else { return }
        templates = decoded
    }

    private func save() {
        guard let data = try? JSONEncoder().encode(templates) else { return }
        try? data.write(to: indexURL, options: .atomic)
    }
}
