import PencilKit
import SwiftUI
import UIKit

// Sayfadaki çizimin küçük önizlemesi. Arka planda üretilir, veri değişince yenilenir.
struct PageInkPreview: View {
    let drawingData: Data
    var scale: CGFloat = 0.06
    var pageSize: CGSize = NotebookPage.defaultSize

    @State private var preview: UIImage?

    var body: some View {
        Group {
            if let preview {
                Image(uiImage: preview)
                    .resizable()
                    .interpolation(.high)
                    .scaledToFit()
            }
        }
        .task(id: drawingData) {
            let data = drawingData
            let renderScale = scale
            let bounds = CGRect(origin: .zero, size: pageSize)
            let renderedPreview = await Task.detached(priority: .utility) {
                guard let drawing = try? PKDrawing(data: data) else { return nil as UIImage? }
                return drawing.image(from: bounds, scale: renderScale)
            }.value
            preview = renderedPreview
        }
    }
}
