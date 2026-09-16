import Foundation
import PDFKit
import UIKit

// İçe aktarılan PDF'ler (docs/tasarim/06-PDFNotu.png).
// Dosya Documents/pdfs/ içine kopyalanır; her sayfa NotebookPage.pdf ile o dosyanın bir sayfasını gösterir.
// PDF sayfası arkada görsel olarak çizilir, el yazısı PencilKit katmanında üstünde durur.
@MainActor
final class PDFLibrary: ObservableObject {
    struct ImportedPDF {
        let fileName: String
        let pageSizes: [CGSize]   // punto; her sayfa kendi oranında
    }

    private let fileManager = FileManager.default
    private var documents: [String: PDFDocument] = [:]
    private var imageCache: [String: UIImage] = [:]

    var folderURL: URL {
        let documentsURL = fileManager.urls(for: .documentDirectory, in: .userDomainMask)[0]
        let url = documentsURL.appendingPathComponent("pdfs", isDirectory: true)
        if !fileManager.fileExists(atPath: url.path) {
            try? fileManager.createDirectory(at: url, withIntermediateDirectories: true)
        }
        return url
    }

    func url(for fileName: String) -> URL {
        folderURL.appendingPathComponent(fileName)
    }

    /// PDF verisini kopyalar, sayfa boyutlarını A4 genişliğine ölçekleyerek döndürür.
    func importPDF(_ data: Data) -> ImportedPDF? {
        guard let document = PDFDocument(data: data), document.pageCount > 0 else { return nil }
        let fileName = "\(UUID().uuidString).pdf"
        do {
            try data.write(to: url(for: fileName), options: .atomic)
        } catch {
            return nil
        }
        documents[fileName] = document
        var sizes: [CGSize] = []
        for index in 0..<document.pageCount {
            let bounds = document.page(at: index)?.bounds(for: .mediaBox) ?? CGRect(origin: .zero, size: NotebookPage.defaultSize)
            let width = NotebookPage.defaultSize.width
            let height = bounds.width > 0 ? width * bounds.height / bounds.width : NotebookPage.defaultSize.height
            sizes.append(CGSize(width: width, height: max(height.rounded(), 100)))
        }
        return ImportedPDF(fileName: fileName, pageSizes: sizes)
    }

    private func document(named fileName: String) -> PDFDocument? {
        if let cached = documents[fileName] { return cached }
        guard let document = PDFDocument(url: url(for: fileName)) else { return nil }
        documents[fileName] = document
        return document
    }

    /// Sayfayı verilen genişlikte (piksel) görsele çevirir; sonuç önbelleğe alınır.
    func image(for reference: PDFPageReference, pixelWidth: CGFloat) -> UIImage? {
        let key = "\(reference.fileName)#\(reference.pageIndex)@\(Int(pixelWidth))"
        if let cached = imageCache[key] { return cached }
        guard let page = document(named: reference.fileName)?.page(at: reference.pageIndex) else { return nil }
        let bounds = page.bounds(for: .mediaBox)
        guard bounds.width > 0 else { return nil }
        let size = CGSize(width: pixelWidth, height: pixelWidth * bounds.height / bounds.width)
        let image = page.thumbnail(of: size, for: .mediaBox)
        imageCache[key] = image
        return image
    }

    func remove(named fileName: String) {
        try? fileManager.removeItem(at: url(for: fileName))
        documents[fileName] = nil
        imageCache = imageCache.filter { !$0.key.hasPrefix(fileName) }
    }
}
