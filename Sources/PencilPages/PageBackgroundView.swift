import SwiftUI

// Sayfanın arka planı. Kendi şablonu varsa görseli, yoksa uygulamayla gelen deseni çizer.
// Şablon silinmişse sayfa `paper` desenine geri düşer; hiçbir şey kaybolmaz.
struct PageBackgroundView: View {
    let page: NotebookPage
    var useThumbnail = false

    @EnvironmentObject private var templates: TemplateLibrary
    @EnvironmentObject private var pdfs: PDFLibrary

    var body: some View {
        if let reference = page.pdf,
           let image = pdfs.image(for: reference, pixelWidth: useThumbnail ? 300 : 1400) {
            Image(uiImage: image)
                .resizable()
                .scaledToFill()
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .clipped()
                .background(Color.white)
                .accessibilityHidden(true)
        } else if let id = page.customTemplateID,
           let image = useThumbnail ? templates.thumbnail(for: id) : templates.image(for: id) {
            Image(uiImage: image)
                .resizable()
                .scaledToFill()
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .clipped()
                .background(PaperBackgroundView.paperColor)
                .accessibilityHidden(true)
        } else {
            PaperBackgroundView(style: page.paper)
        }
    }
}
