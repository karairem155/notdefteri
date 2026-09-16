import Foundation
import UIKit

// Kendi eklediğin sayfa şablonları.
//
// PaperStyle (blank/ruled/grid/dotted) uygulamayla gelen çizimlerdir.
// Bu ise senin Fotoğraflar veya Dosyalar'dan eklediğin görsellerdir:
// görsel Documents/templates/ içine kopyalanır, sayfa sadece kimliğini tutar.
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
    private var imageCache: [UUID: UIImage] = [:]
    private var thumbnailCache: [UUID: UIImage] = [:]

    /// Kaydedilen görsellerin en uzun kenarı bu piksel sayısını geçmez.
    static let maxImageDimension: CGFloat = 2000

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

    /// Tam boy şablon görseli (sayfa arka planı için).
    func image(for id: UUID) -> UIImage? {
        if let cached = imageCache[id] { return cached }
        guard let template = template(id: id),
              let image = UIImage(contentsOfFile: imageURL(for: template).path) else { return nil }
        imageCache[id] = image
        return image
    }

    /// Küçük önizleme (seçim ızgaraları ve sayfa şeridi için).
    func thumbnail(for id: UUID) -> UIImage? {
        if let cached = thumbnailCache[id] { return cached }
        guard let image = image(for: id) else { return nil }
        let thumbnail = image.preparingThumbnail(of: CGSize(width: 300, height: 424)) ?? image
        thumbnailCache[id] = thumbnail
        return thumbnail
    }

    /// Fotoğraf/Dosyalar'dan gelen ham görsel verisini küçültüp JPEG olarak kütüphaneye alır.
    @discardableResult
    func importImage(_ data: Data, suggestedName: String?) -> CustomTemplate? {
        guard let image = UIImage(data: data) else { return nil }
        let resized = image.resizedToFit(maxDimension: Self.maxImageDimension)
        guard let jpeg = resized.jpegData(compressionQuality: 0.9) else { return nil }
        let cleaned = suggestedName?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        let name = cleaned.isEmpty ? "Şablon \(templates.count + 1)" : cleaned
        return importTemplate(named: name, imageData: jpeg, fileExtension: "jpg")
    }

    /// Hazır görsel verisini olduğu gibi kütüphaneye kopyalar.
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

    func rename(_ id: UUID, to name: String) {
        let cleaned = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !cleaned.isEmpty, let index = templates.firstIndex(where: { $0.id == id }) else { return }
        templates[index].name = cleaned
        save()
    }

    func remove(_ id: UUID) {
        guard let index = templates.firstIndex(where: { $0.id == id }) else { return }
        let template = templates[index]
        try? fileManager.removeItem(at: imageURL(for: template))
        templates.remove(at: index)
        imageCache[id] = nil
        thumbnailCache[id] = nil
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

private extension UIImage {
    func resizedToFit(maxDimension: CGFloat) -> UIImage {
        let pixelSize = CGSize(width: size.width * scale, height: size.height * scale)
        let longest = max(pixelSize.width, pixelSize.height)
        guard longest > maxDimension else { return self }
        let factor = maxDimension / longest
        let target = CGSize(width: pixelSize.width * factor, height: pixelSize.height * factor)
        let format = UIGraphicsImageRendererFormat.default()
        format.scale = 1
        return UIGraphicsImageRenderer(size: target, format: format).image { _ in
            draw(in: CGRect(origin: .zero, size: target))
        }
    }
}
