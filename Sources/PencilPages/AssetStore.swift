import Foundation
import UIKit

// Sayfaya yerleştirilen fotoğraf, çıkartma ve bant görselleri.
// Dosyalar Documents/assets/ içinde durur; PlacedObject sadece dosya adını tutar.
// Aynı görsel birden çok sayfada kullanılabilir; dosya ancak hiçbir sayfa kullanmıyorsa silinir.
@MainActor
final class AssetStore: ObservableObject {
    private let fileManager = FileManager.default
    private var imageCache: [String: UIImage] = [:]

    static let maxImageDimension: CGFloat = 1600

    var folderURL: URL {
        let documents = fileManager.urls(for: .documentDirectory, in: .userDomainMask)[0]
        let url = documents.appendingPathComponent("assets", isDirectory: true)
        if !fileManager.fileExists(atPath: url.path) {
            try? fileManager.createDirectory(at: url, withIntermediateDirectories: true)
        }
        return url
    }

    func url(for assetName: String) -> URL {
        folderURL.appendingPathComponent(assetName)
    }

    func image(named assetName: String) -> UIImage? {
        if let cached = imageCache[assetName] { return cached }
        guard let image = UIImage(contentsOfFile: url(for: assetName).path) else { return nil }
        imageCache[assetName] = image
        return image
    }

    /// Ham görsel verisini küçültüp kaydeder; dosya adını ve piksel boyutunu döndürür.
    func importImage(_ data: Data) -> (assetName: String, size: CGSize)? {
        guard let image = UIImage(data: data) else { return nil }
        let resized = image.resizedToFit(maxDimension: Self.maxImageDimension)
        // Saydamlık (çıkartmalar için) PNG'de korunur; fotoğraflar JPEG'e sığar.
        let hasAlpha = resized.cgImage.map { $0.alphaInfo != .none && $0.alphaInfo != .noneSkipFirst && $0.alphaInfo != .noneSkipLast } ?? false
        let assetName: String
        let encoded: Data?
        if hasAlpha {
            assetName = "\(UUID().uuidString).png"
            encoded = resized.pngData()
        } else {
            assetName = "\(UUID().uuidString).jpg"
            encoded = resized.jpegData(compressionQuality: 0.9)
        }
        guard let encoded else { return nil }
        do {
            try encoded.write(to: url(for: assetName), options: .atomic)
        } catch {
            return nil
        }
        imageCache[assetName] = resized
        return (assetName, CGSize(width: resized.size.width * resized.scale, height: resized.size.height * resized.scale))
    }

    func remove(named assetName: String) {
        try? fileManager.removeItem(at: url(for: assetName))
        imageCache[assetName] = nil
    }
}

extension UIImage {
    /// En uzun kenarı `maxDimension` pikseli geçmeyecek şekilde küçültür; küçükse olduğu gibi döner.
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
