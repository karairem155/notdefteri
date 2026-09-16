import PencilKit
import SwiftUI
import UIKit

// Tek sayfa editörü (docs/tasarim/05-NotEditoru.png).
// Lacivert masa, ortada krem kağıt, arkada alttaki yapraklar, altta koyu araç tezgahı.
struct NotebookEditorView: View {
    @ObservedObject var store: NotebookStore
    let notebookID: UUID

    @EnvironmentObject private var pens: PenFavoritesStore
    @State private var selectedPageID: UUID?
    @State private var configuration: DrawingToolConfiguration = .fallback
    @State private var hasAppliedDefaultPen = false
    @State private var showingPenPanel = false
    @State private var exportDocument: ExportedNotebook?
    @State private var showingExportError = false
    @State private var showingDeletePageConfirmation = false
    @StateObject private var canvasActions = CanvasActions()
    @Environment(\.scenePhase) private var scenePhase

    static let deskColor = Color(red: 0.24, green: 0.27, blue: 0.40)
    static let barColor = Color(red: 0.30, green: 0.33, blue: 0.47)

    private var notebook: Notebook? { store.notebook(id: notebookID) }

    private var selectedPage: NotebookPage? {
        guard let notebook else { return nil }
        if let selectedPageID, let page = notebook.pages.first(where: { $0.id == selectedPageID }) { return page }
        return notebook.pages.first
    }

    private var selectedIndex: Int {
        guard let notebook, let selectedPage else { return 0 }
        return notebook.pages.firstIndex(where: { $0.id == selectedPage.id }) ?? 0
    }

    private var pageCount: Int { notebook?.pages.count ?? 0 }

    var body: some View {
        VStack(spacing: 0) {
            pageArea
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            pageThumbnails
            ToolBenchView(pens: pens, configuration: $configuration) {
                showingPenPanel = true
            }
            .popover(isPresented: $showingPenPanel, arrowEdge: .bottom) {
                PenPanelView(pens: pens, configuration: $configuration)
                    .presentationCompactAdaptation(.popover)
            }
        }
        .background(Self.deskColor.ignoresSafeArea())
        .environment(\.colorScheme, .dark)
        .navigationTitle(notebook?.title ?? "Defter")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(Self.barColor, for: .navigationBar)
        .toolbarBackground(.visible, for: .navigationBar)
        .toolbar {
            ToolbarItemGroup(placement: .topBarTrailing) {
                Button { canvasActions.undo() } label: {
                    Image(systemName: "arrow.uturn.backward")
                }
                .disabled(!canvasActions.canUndo)
                .accessibilityLabel("Geri al")

                Button { canvasActions.redo() } label: {
                    Image(systemName: "arrow.uturn.forward")
                }
                .disabled(!canvasActions.canRedo)
                .accessibilityLabel("İleri al")

                if let selectedPage {
                    paperMenu(for: selectedPage)
                    pageActionsMenu(for: selectedPage)
                }

                Button {
                    canvasActions.commitCurrentDrawing?()
                    store.addPage(to: notebookID)
                    selectedPageID = store.notebook(id: notebookID)?.pages.last?.id
                } label: {
                    Image(systemName: "plus.square")
                }
                .accessibilityLabel("Sayfa ekle")

                pageCounter
            }
        }
        .onAppear {
            if selectedPageID == nil { selectedPageID = notebook?.pages.first?.id }
            if !hasAppliedDefaultPen {
                hasAppliedDefaultPen = true
                if let pen = pens.defaultPen {
                    configuration = DrawingToolConfiguration(favorite: pen)
                }
            }
        }
        .onChange(of: notebook?.pages.map(\.id)) { _, pageIDs in
            if let selectedPageID, pageIDs?.contains(selectedPageID) == true { return }
            selectedPageID = pageIDs?.first
        }
        .onChange(of: scenePhase) { _, phase in
            if phase != .active {
                canvasActions.commitCurrentDrawing?()
                store.flushPendingSaves()
            }
        }
        .sheet(item: $exportDocument) { document in
            NotebookShareSheet(fileURL: document.url)
                .presentationDetents([.medium, .large])
        }
        .alert("Defter Dışa Aktarılamadı", isPresented: $showingExportError) {
            Button("Tamam", role: .cancel) {}
        } message: {
            Text("Son değişiklikler kaydedilemedi. Boş alanı kontrol edip yeniden dene.")
        }
        .confirmationDialog("Bu sayfa silinsin mi?", isPresented: $showingDeletePageConfirmation, titleVisibility: .visible) {
            Button("Sayfayı Sil", role: .destructive) { deleteSelectedPage() }
            Button("Vazgeç", role: .cancel) {}
        } message: {
            Text("Sayfa ve üzerindeki yazılar silinir. Defterde en az bir sayfa kalmalı.")
        }
    }

    // MARK: - Üst çubuk parçaları

    private var pageCounter: some View {
        HStack(spacing: 6) {
            Button { movePage(by: -1) } label: {
                Image(systemName: "chevron.left")
            }
            .disabled(selectedIndex <= 0)
            .accessibilityLabel("Önceki sayfa")

            Text("\(selectedIndex + 1) / \(pageCount)")
                .font(.subheadline.weight(.semibold).monospacedDigit())

            Button { movePage(by: 1) } label: {
                Image(systemName: "chevron.right")
            }
            .disabled(selectedIndex >= pageCount - 1)
            .accessibilityLabel("Sonraki sayfa")
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 5)
        .background(Color.white.opacity(0.12), in: Capsule())
    }

    private func paperMenu(for page: NotebookPage) -> some View {
        Menu {
            ForEach(PaperStyle.allCases) { style in
                Button {
                    store.setPaper(style, notebookID: notebookID, pageID: page.id)
                } label: {
                    if style == page.paper {
                        Label(style.title, systemImage: "checkmark")
                    } else {
                        Text(style.title)
                    }
                }
            }
        } label: {
            Image(systemName: "doc.text.image")
        }
        .accessibilityLabel("Kağıt türü")
    }

    private func pageActionsMenu(for page: NotebookPage) -> some View {
        Menu {
            Button("Sayfayı Çoğalt", systemImage: "plus.square.on.square") {
                canvasActions.commitCurrentDrawing?()
                if let newPageID = store.duplicatePage(in: notebookID, pageID: page.id) {
                    selectedPageID = newPageID
                }
            }
            Button("Sayfayı Öne Taşı", systemImage: "arrow.up") {
                store.movePage(in: notebookID, pageID: page.id, by: -1)
            }
            .disabled(selectedIndex == 0)
            Button("Sayfayı Arkaya Taşı", systemImage: "arrow.down") {
                store.movePage(in: notebookID, pageID: page.id, by: 1)
            }
            .disabled(selectedIndex >= pageCount - 1)
            Divider()
            Button("Defteri Dışa Aktar", systemImage: "square.and.arrow.up") {
                canvasActions.commitCurrentDrawing?()
                if store.saveNow(notebookID), let url = store.exportURL(for: notebookID) {
                    exportDocument = ExportedNotebook(url: url)
                } else {
                    showingExportError = true
                }
            }
            Divider()
            Button("Sayfayı Sil", systemImage: "trash", role: .destructive) {
                showingDeletePageConfirmation = true
            }
            .disabled(pageCount <= 1)
        } label: {
            Image(systemName: "ellipsis.circle")
        }
        .accessibilityLabel("Sayfa işlemleri")
    }

    // MARK: - Sayfa alanı

    @ViewBuilder
    private var pageArea: some View {
        if let page = selectedPage {
            GeometryReader { geometry in
                let logicalWidth: CGFloat = 595
                let logicalHeight: CGFloat = 842
                let scale = max(0.1, min((geometry.size.width - 40) / logicalWidth, (geometry.size.height - 40) / logicalHeight))
                if let drawing = page.drawing {
                    ZStack {
                        // Alttaki yapraklar
                        RoundedRectangle(cornerRadius: 2)
                            .fill(Color(red: 0.84, green: 0.83, blue: 0.79))
                            .offset(x: 10, y: 6)
                        RoundedRectangle(cornerRadius: 2)
                            .fill(Color(red: 0.90, green: 0.89, blue: 0.85))
                            .offset(x: 5, y: 3)
                        ZStack {
                            PaperBackgroundView(style: page.paper)
                            PencilCanvasView(
                                drawing: drawing,
                                toolConfiguration: configuration,
                                actions: canvasActions
                            ) { drawing, persistImmediately in
                                store.updateDrawing(
                                    drawing,
                                    notebookID: notebookID,
                                    pageID: page.id,
                                    persistImmediately: persistImmediately
                                )
                            }
                            .id(page.id)
                        }
                        .frame(width: logicalWidth, height: logicalHeight)
                        .clipShape(RoundedRectangle(cornerRadius: 2))
                    }
                    .frame(width: logicalWidth, height: logicalHeight)
                    .shadow(color: .black.opacity(0.35), radius: 18, y: 8)
                    .scaleEffect(scale)
                    .frame(width: logicalWidth * scale, height: logicalHeight * scale)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else {
                    ContentUnavailableView(
                        "Sayfa Yazısı Okunamıyor",
                        systemImage: "exclamationmark.triangle",
                        description: Text("Kayıtlı çizim verisi bozuk olduğu için bu sayfa düzenlemeye kapatıldı.")
                    )
                }
            }
            .padding(.vertical, 12)
        } else {
            ContentUnavailableView("Sayfa Yok", systemImage: "doc", description: Text("Yazmaya başlamak için bir sayfa ekle."))
        }
    }

    private func movePage(by offset: Int) {
        guard let notebook else { return }
        let index = selectedIndex + offset
        guard notebook.pages.indices.contains(index) else { return }
        canvasActions.commitCurrentDrawing?()
        selectedPageID = notebook.pages[index].id
    }

    // MARK: - Sayfa şeridi (Sayfalar ekranı 9. adımda gelecek)

    @ViewBuilder
    private var pageThumbnails: some View {
        if let pages = notebook?.pages, pages.count > 1 {
            ScrollView(.horizontal, showsIndicators: false) {
                LazyHStack(alignment: .bottom, spacing: 8) {
                    ForEach(Array(pages.enumerated()), id: \.element.id) { entry in
                        let index = entry.offset
                        let page = entry.element
                        let isSelected = selectedPageID == page.id
                        Button {
                            canvasActions.commitCurrentDrawing?()
                            selectedPageID = page.id
                        } label: {
                            VStack(spacing: 3) {
                                ZStack {
                                    PaperBackgroundView(style: page.paper)
                                    PageInkPreview(drawingData: page.drawingData)
                                        .allowsHitTesting(false)
                                }
                                .overlay {
                                    RoundedRectangle(cornerRadius: 3)
                                        .stroke(isSelected ? Color.white : Color.white.opacity(0.25), lineWidth: isSelected ? 2 : 0.75)
                                }
                                .frame(width: 38, height: 52)
                                .clipShape(RoundedRectangle(cornerRadius: 3))
                                Text("\(index + 1)")
                                    .font(.caption2.monospacedDigit())
                                    .foregroundStyle(isSelected ? Color.white : Color.white.opacity(0.6))
                            }
                            .padding(5)
                            .background(isSelected ? Color.white.opacity(0.12) : Color.clear, in: RoundedRectangle(cornerRadius: 7))
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("\(index + 1). sayfaya git")
                    }
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 3)
            }
            .frame(height: 72)
            .background(Color.black.opacity(0.18))
        }
    }

    private func deleteSelectedPage() {
        guard let selectedPage else { return }
        let oldIndex = selectedIndex
        guard store.deletePage(in: notebookID, pageID: selectedPage.id),
              let remainingPages = store.notebook(id: notebookID)?.pages,
              !remainingPages.isEmpty else { return }
        selectedPageID = remainingPages[min(oldIndex, remainingPages.count - 1)].id
    }
}

private struct ExportedNotebook: Identifiable {
    let id = UUID()
    let url: URL
}

private struct PageInkPreview: View {
    let drawingData: Data
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
            let renderedPreview = await Task.detached(priority: .utility) {
                guard let drawing = try? PKDrawing(data: data) else { return nil as UIImage? }
                return drawing.image(from: CGRect(x: 0, y: 0, width: 595, height: 842), scale: 0.06)
            }.value
            preview = renderedPreview
        }
    }
}

private struct NotebookShareSheet: UIViewControllerRepresentable {
    let fileURL: URL

    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: [fileURL], applicationActivities: nil)
    }

    func updateUIViewController(_ controller: UIActivityViewController, context: Context) {}
}
