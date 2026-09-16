import PencilKit
import SwiftUI
import UIKit

struct NotebookEditorView: View {
    @ObservedObject var store: NotebookStore
    let notebookID: UUID

    @State private var selectedPageID: UUID?
    @State private var toolChoice: DrawingToolChoice = .pen
    @State private var inkColor: InkColor = .black
    @State private var lineWidth: CGFloat = 3
    @State private var exportDocument: ExportedNotebook?
    @State private var showingExportError = false
    @State private var showingDeletePageConfirmation = false
    @StateObject private var canvasActions = CanvasActions()
    @Environment(\.scenePhase) private var scenePhase

    private let colors = InkColor.allCases

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

    var body: some View {
        VStack(spacing: 0) {
            toolbar
            Divider()
            pageArea
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(Color(red: 0.90, green: 0.91, blue: 0.93))
            pageThumbnails
            Divider()
            pageControls
        }
        .navigationTitle(notebook?.title ?? "Notebook")
        .navigationBarTitleDisplayMode(.inline)
        .background(Color(uiColor: .systemBackground))
        .onAppear {
            if selectedPageID == nil { selectedPageID = notebook?.pages.first?.id }
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
        .alert("Couldn't Export Notebook", isPresented: $showingExportError) {
            Button("OK", role: .cancel) {}
        } message: {
            Text("The latest changes could not be saved. Check available storage and try again.")
        }
        .confirmationDialog("Delete this page?", isPresented: $showingDeletePageConfirmation, titleVisibility: .visible) {
            Button("Delete Page", role: .destructive) { deleteSelectedPage() }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("This removes the page and its handwriting. A notebook must keep at least one page.")
        }
    }

    private var toolbar: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 12) {
                ForEach(DrawingToolChoice.allCases) { choice in
                    Button {
                        toolChoice = choice
                    } label: {
                        Image(systemName: choice.symbol)
                            .font(.system(size: 17, weight: .medium))
                            .foregroundStyle(toolChoice == choice ? Color.accentColor : Color.primary)
                            .frame(width: 38, height: 38)
                            .background(toolChoice == choice ? Color.accentColor.opacity(0.12) : Color.clear, in: RoundedRectangle(cornerRadius: 9))
                    }
                    .accessibilityLabel(choice.title)
                }
                Divider().frame(height: 28)
                ForEach(colors) { color in
                    Button {
                        inkColor = color
                    } label: {
                        Circle()
                            .fill(color.color)
                            .frame(width: 22, height: 22)
                            .padding(4)
                            .overlay(Circle().stroke(inkColor == color ? Color.accentColor : Color.clear, lineWidth: 2))
                    }
                    .accessibilityLabel("\(color.title) ink colour")
                }
                Menu {
                    ForEach([CGFloat(1.5), 3, 5, 8], id: \.self) { width in
                        Button {
                            lineWidth = width
                        } label: {
                            if lineWidth == width {
                                Label("\(Int(width)) pt", systemImage: "checkmark")
                            } else {
                                Text("\(Int(width)) pt")
                            }
                        }
                    }
                } label: {
                    Image(systemName: "lineweight")
                }
                .accessibilityLabel("Pen thickness")
                Divider().frame(height: 28)
                Button { canvasActions.undo() } label: {
                    Image(systemName: "arrow.uturn.backward")
                }
                .disabled(!canvasActions.canUndo)
                .accessibilityLabel("Undo")
                Button { canvasActions.redo() } label: {
                    Image(systemName: "arrow.uturn.forward")
                }
                .disabled(!canvasActions.canRedo)
                .accessibilityLabel("Redo")
                Divider().frame(height: 28)
                Button {
                    canvasActions.commitCurrentDrawing?()
                    if store.saveNow(notebookID), let url = store.exportURL(for: notebookID) {
                        exportDocument = ExportedNotebook(url: url)
                    } else {
                        showingExportError = true
                    }
                } label: {
                    Image(systemName: "square.and.arrow.up")
                }
                .accessibilityLabel("Export notebook")
            }
            .buttonStyle(.plain)
            .padding(.horizontal, 14)
            .padding(.vertical, 7)
        }
    }

    @ViewBuilder
    private var pageArea: some View {
        if let page = selectedPage {
            GeometryReader { geometry in
                let logicalWidth: CGFloat = 595
                let logicalHeight: CGFloat = 842
                let scale = max(0.1, min((geometry.size.width - 28) / logicalWidth, (geometry.size.height - 28) / logicalHeight))
                if let drawing = page.drawing {
                    ZStack {
                        PaperBackgroundView(style: page.paper)
                        PencilCanvasView(
                            drawing: drawing,
                            toolConfiguration: DrawingToolConfiguration(choice: toolChoice, color: inkColor, width: lineWidth),
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
                    .shadow(color: .black.opacity(0.18), radius: 10, y: 3)
                    .scaleEffect(scale)
                    .frame(width: logicalWidth * scale, height: logicalHeight * scale)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else {
                    ContentUnavailableView(
                        "Page Ink Can't Be Read",
                        systemImage: "exclamationmark.triangle",
                        description: Text("This page is protected from editing because its saved ink data is damaged.")
                    )
                }
            }
            .padding(.vertical, 8)
        } else {
            ContentUnavailableView("No Pages", systemImage: "doc", description: Text("Add a page to start writing."))
        }
    }

    private var pageControls: some View {
        HStack {
            Button {
                movePage(by: -1)
            } label: {
                Label("Previous", systemImage: "chevron.left")
            }
            .disabled(selectedIndex <= 0)
            Spacer()
            Text("Page \(selectedIndex + 1) of \(notebook?.pages.count ?? 0)")
                .font(.subheadline.monospacedDigit())
                .foregroundStyle(.secondary)
            Spacer()
            Button {
                store.addPage(to: notebookID)
                selectedPageID = store.notebook(id: notebookID)?.pages.last?.id
            } label: {
                Label("Add page", systemImage: "plus.page")
            }
            Button {
                movePage(by: 1)
            } label: {
                Label("Next", systemImage: "chevron.right")
            }
            .disabled(selectedIndex >= (notebook?.pages.count ?? 1) - 1)
            if let selectedPage {
                Menu {
                    ForEach(PaperStyle.allCases) { style in
                        Button {
                            store.setPaper(style, notebookID: notebookID, pageID: selectedPage.id)
                        } label: {
                            if style == selectedPage.paper {
                                Label(style.title, systemImage: "checkmark")
                            } else {
                                Text(style.title)
                            }
                        }
                    }
                } label: {
                    Image(systemName: "doc.text.image")
                }
                .accessibilityLabel("Paper style")

                Menu {
                    Button("Duplicate Page", systemImage: "plus.square.on.square") {
                        canvasActions.commitCurrentDrawing?()
                        if let newPageID = store.duplicatePage(in: notebookID, pageID: selectedPage.id) {
                            selectedPageID = newPageID
                        }
                    }
                    Button("Move Page Earlier", systemImage: "arrow.up") {
                        store.movePage(in: notebookID, pageID: selectedPage.id, by: -1)
                    }
                    .disabled(selectedIndex == 0)
                    Button("Move Page Later", systemImage: "arrow.down") {
                        store.movePage(in: notebookID, pageID: selectedPage.id, by: 1)
                    }
                    .disabled(selectedIndex >= (notebook?.pages.count ?? 1) - 1)
                    Divider()
                    Button("Delete Page", systemImage: "trash", role: .destructive) {
                        showingDeletePageConfirmation = true
                    }
                    .disabled((notebook?.pages.count ?? 0) <= 1)
                } label: {
                    Image(systemName: "ellipsis.circle")
                }
                .accessibilityLabel("Page actions")
            }
        }
        .buttonStyle(.plain)
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
    }

    private func movePage(by offset: Int) {
        guard let notebook else { return }
        let index = selectedIndex + offset
        guard notebook.pages.indices.contains(index) else { return }
        selectedPageID = notebook.pages[index].id
    }

    @ViewBuilder
    private var pageThumbnails: some View {
        if let pages = notebook?.pages, pages.count > 1 {
            ScrollView(.horizontal, showsIndicators: false) {
                LazyHStack(alignment: .bottom, spacing: 8) {
                    ForEach(Array(pages.enumerated()), id: \.element.id) { entry in
                        let index = entry.offset
                        let page = entry.element
                        Button {
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
                                            .stroke(selectedPageID == page.id ? Color.accentColor : Color.gray.opacity(0.35), lineWidth: selectedPageID == page.id ? 2 : 0.75)
                                    }
                                    .frame(width: 38, height: 52)
                                    .clipShape(RoundedRectangle(cornerRadius: 3))
                                Text("\(index + 1)")
                                    .font(.caption2.monospacedDigit())
                                    .foregroundStyle(selectedPageID == page.id ? Color.accentColor : Color.secondary)
                            }
                            .padding(5)
                            .background(selectedPageID == page.id ? Color.accentColor.opacity(0.08) : Color.clear, in: RoundedRectangle(cornerRadius: 7))
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("Go to page \(index + 1)")
                    }
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 3)
            }
            .frame(height: 72)
            .background(Color(uiColor: .systemBackground))
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
