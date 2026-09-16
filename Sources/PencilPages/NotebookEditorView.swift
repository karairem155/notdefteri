import PencilKit
import PhotosUI
import SwiftUI
import UIKit
import UniformTypeIdentifiers

// Tek sayfa editörü (docs/tasarim/05-NotEditoru.png).
// Lacivert masa, ortada krem kağıt, arkada alttaki yapraklar, altta koyu araç tezgahı.
//
// Sayfa katmanları (alttan üste): şablon → nesneler (fotoğraf/çıkartma/post-it) → PencilKit → örtüler.
// Kipler:
//   - çizim: tuval dokunuş alır; örtülere dokununca açılır/kapanır
//   - buzlu kalem: örtü katmanı çizgiyi buzlu şerit yapar, tuval kapalı
//   - nesne düzenleme: nesneler ve örtüler taşınır/büyür/döner, tuval kapalı
struct NotebookEditorView: View {
    @ObservedObject var store: NotebookStore
    let notebookID: UUID

    @EnvironmentObject private var pens: PenFavoritesStore
    @EnvironmentObject private var templates: TemplateLibrary
    @EnvironmentObject private var assets: AssetStore
    @State private var selectedPageID: UUID?
    @State private var configuration: DrawingToolConfiguration = .fallback
    @State private var hasAppliedDefaultPen = false
    @State private var showingPenPanel = false
    @State private var showingFrostedPanel = false
    @State private var showingStickerPanel = false
    @State private var showingAddPage = false
    @State private var showingPages = false
    @State private var editingObjects = false
    @State private var selectedObjectID: UUID?
    @State private var importKind: PlacedObject.Kind = .photo
    @State private var pendingStickerSource: StickerPanelSheet.ImportSource?
    @State private var photoItem: PhotosPickerItem?
    @State private var showingPhotoPicker = false
    @State private var showingFileImporter = false
    @State private var photoError: String?
    @State private var exportDocument: ExportedNotebook?
    @State private var showingExportError = false
    @State private var showingDeletePageConfirmation = false
    @StateObject private var leftCanvasActions = CanvasActions()
    @StateObject private var rightCanvasActions = CanvasActions()
    @State private var activeSide: PageSide = .left
    @Environment(\.scenePhase) private var scenePhase

    @AppStorage("notdefteri.frosted.blur") private var frostedBlur: Double = 6
    @AppStorage("notdefteri.frosted.thickness") private var frostedThickness: Double = 28
    @AppStorage("notdefteri.frosted.revealOnTap") private var frostedRevealOnTap = true
    @AppStorage("notdefteri.spreadMode") private var spreadMode = false

    enum PageSide {
        case left, right
    }

    static let deskColor = Color(red: 0.24, green: 0.27, blue: 0.40)
    static let barColor = Color(red: 0.30, green: 0.33, blue: 0.47)
    static let pageWidth: CGFloat = 595
    static let pageHeight: CGFloat = 842

    private let accent = Color(red: 0.55, green: 0.50, blue: 0.95)

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

    /// Son çizim yapılan tarafın tuvali; geri al / ileri al ona uygulanır.
    private var activeCanvasActions: CanvasActions {
        activeSide == .right ? rightCanvasActions : leftCanvasActions
    }

    /// Çift sayfada soldaki sayfanın sırası: (0,1), (2,3), ...
    private var spreadLeftIndex: Int { selectedIndex - selectedIndex % 2 }

    private var spreadPages: (left: NotebookPage?, right: NotebookPage?) {
        guard let pages = notebook?.pages else { return (nil, nil) }
        let left = pages.indices.contains(spreadLeftIndex) ? pages[spreadLeftIndex] : nil
        let right = pages.indices.contains(spreadLeftIndex + 1) ? pages[spreadLeftIndex + 1] : nil
        return (left, right)
    }

    /// "Sayfa Ekle" için varsayılan konum: tek sayfada seçili sayfa, çiftte sağdaki sayfa.
    private var insertAnchorIndex: Int {
        spreadMode ? min(spreadLeftIndex + 1, max(pageCount - 1, 0)) : selectedIndex
    }

    private var pageCounterText: String {
        guard spreadMode else { return "\(selectedIndex + 1) / \(pageCount)" }
        if spreadPages.right != nil {
            return "\(spreadLeftIndex + 1)-\(spreadLeftIndex + 2) / \(pageCount)"
        }
        return "\(spreadLeftIndex + 1) / \(pageCount)"
    }

    private var canGoBack: Bool {
        spreadMode ? spreadLeftIndex > 0 : selectedIndex > 0
    }

    private var canGoForward: Bool {
        spreadMode ? spreadLeftIndex + 2 < pageCount : selectedIndex < pageCount - 1
    }

    private func commitAllDrawings() {
        leftCanvasActions.commitCurrentDrawing?()
        rightCanvasActions.commitCurrentDrawing?()
    }

    private var isFrostedPenActive: Bool { configuration.choice == .frosted }

    private var currentTemplateSelection: TemplateSelection {
        if let page = selectedPage, let id = page.customTemplateID, templates.template(id: id) != nil {
            return .custom(id)
        }
        return .builtin(selectedPage?.paper ?? .ruled)
    }

    private var frostedSettings: FrostedPenSettings {
        FrostedPenSettings(blurLevel: frostedBlur, thickness: frostedThickness, revealOnTap: frostedRevealOnTap)
    }

    private var frostedSettingsBinding: Binding<FrostedPenSettings> {
        Binding(
            get: { frostedSettings },
            set: { newValue in
                frostedBlur = newValue.blurLevel
                frostedThickness = newValue.thickness
                frostedRevealOnTap = newValue.revealOnTap
            }
        )
    }

    var body: some View {
        VStack(spacing: 0) {
            pageArea
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            pageThumbnails
            ToolBenchView(
                pens: pens,
                configuration: $configuration,
                isEditingObjects: editingObjects,
                onOpenPenPanel: { showingPenPanel = true },
                onOpenFrostedPanel: { showingFrostedPanel = true },
                onOpenStickerPanel: { showingStickerPanel = true },
                onAddPhotoFromLibrary: { startImport(kind: .photo, source: .photos) },
                onAddPhotoFromFiles: { startImport(kind: .photo, source: .files) },
                onToggleEditObjects: { setEditingObjects(!editingObjects) }
            )
            .popover(isPresented: $showingPenPanel, arrowEdge: .bottom) {
                PenPanelView(pens: pens, configuration: $configuration)
                    .presentationCompactAdaptation(.popover)
            }
            .popover(isPresented: $showingFrostedPanel, arrowEdge: .bottom) {
                FrostedPenPanel(settings: frostedSettingsBinding)
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
                Button {
                    commitAllDrawings()
                    showingPages = true
                } label: {
                    Image(systemName: "square.grid.2x2")
                }
                .accessibilityLabel("Sayfalar")

                Button { activeCanvasActions.undo() } label: {
                    Image(systemName: "arrow.uturn.backward")
                }
                .disabled(!activeCanvasActions.canUndo)
                .accessibilityLabel("Geri al")

                Button { activeCanvasActions.redo() } label: {
                    Image(systemName: "arrow.uturn.forward")
                }
                .disabled(!activeCanvasActions.canRedo)
                .accessibilityLabel("İleri al")

                if let selectedPage {
                    paperMenu(for: selectedPage)
                    pageActionsMenu(for: selectedPage)
                }

                Button {
                    commitAllDrawings()
                    showingAddPage = true
                } label: {
                    Image(systemName: "plus.square")
                }
                .accessibilityLabel("Sayfa ekle")

                Picker("Görünüm", selection: $spreadMode) {
                    Text("Tek").tag(false)
                    Text("Çift").tag(true)
                }
                .pickerStyle(.segmented)
                .frame(width: 120)
                .accessibilityLabel("Tek ya da çift sayfa görünümü")

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
        .onChange(of: selectedPageID) { _, _ in
            selectedObjectID = nil
        }
        .onChange(of: scenePhase) { _, phase in
            if phase != .active {
                commitAllDrawings()
                store.flushPendingSaves()
            }
        }
        .navigationDestination(isPresented: $showingPages) {
            PagesGridView(store: store, templates: templates, notebookID: notebookID, selectedPageID: $selectedPageID)
        }
        .sheet(isPresented: $showingAddPage) {
            AddPageSheet(
                store: store,
                templates: templates,
                notebookID: notebookID,
                currentIndex: insertAnchorIndex,
                initialSelection: currentTemplateSelection
            ) { newPageID in
                selectedPageID = newPageID
            }
        }
        .sheet(isPresented: $showingStickerPanel, onDismiss: {
            if let source = pendingStickerSource {
                pendingStickerSource = nil
                startImport(kind: .sticker, source: source)
            }
        }) {
            StickerPanelSheet(
                onAddPlainPostIt: { hex in addPlainPostIt(tintHex: hex) },
                onAddFrostedPostIt: { hex in addFrostedPostIt(tintHex: hex) },
                onImportSticker: { source in pendingStickerSource = source }
            )
        }
        .photosPicker(isPresented: $showingPhotoPicker, selection: $photoItem, matching: .images)
        .fileImporter(isPresented: $showingFileImporter, allowedContentTypes: [.image]) { result in
            handlePhotoFile(result)
        }
        .onChange(of: photoItem) { _, item in
            guard let item else { return }
            Task { await importPhoto(item) }
        }
        .alert("Görsel eklenemedi", isPresented: Binding(
            get: { photoError != nil },
            set: { if !$0 { photoError = nil } }
        )) {
            Button("Tamam", role: .cancel) {}
        } message: {
            Text(photoError ?? "")
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
            .disabled(!canGoBack)
            .accessibilityLabel("Önceki sayfa")

            Text(pageCounterText)
                .font(.subheadline.weight(.semibold).monospacedDigit())

            Button { movePage(by: 1) } label: {
                Image(systemName: "chevron.right")
            }
            .disabled(!canGoForward)
            .accessibilityLabel("Sonraki sayfa")
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 5)
        .background(Color.white.opacity(0.12), in: Capsule())
    }

    // Seçili sayfanın şablonunu değiştirir: kendi şablonların ya da uygulamayla gelen desenler.
    private func paperMenu(for page: NotebookPage) -> some View {
        let usesCustom = page.customTemplateID != nil && templates.template(id: page.customTemplateID) != nil
        return Menu {
            if !templates.templates.isEmpty {
                Section("Şablonlarım") {
                    ForEach(templates.templates) { template in
                        Button {
                            store.setCustomTemplate(template.id, notebookID: notebookID, pageID: page.id)
                        } label: {
                            if page.customTemplateID == template.id {
                                Label(template.name, systemImage: "checkmark")
                            } else {
                                Text(template.name)
                            }
                        }
                    }
                }
            }
            Section("Desenler") {
                ForEach(PaperStyle.allCases) { style in
                    Button {
                        store.setPaper(style, notebookID: notebookID, pageID: page.id)
                    } label: {
                        if !usesCustom && style == page.paper {
                            Label(style.title, systemImage: "checkmark")
                        } else {
                            Text(style.title)
                        }
                    }
                }
            }
        } label: {
            Image(systemName: "doc.text.image")
        }
        .accessibilityLabel("Sayfa şablonu")
    }

    private func pageActionsMenu(for page: NotebookPage) -> some View {
        Menu {
            Button("Sayfayı Çoğalt", systemImage: "plus.square.on.square") {
                commitAllDrawings()
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
                commitAllDrawings()
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
        if selectedPage != nil {
            GeometryReader { geometry in
                let logicalWidth = spreadMode ? Self.pageWidth * 2 : Self.pageWidth
                let logicalHeight = Self.pageHeight
                let scale = max(0.1, min((geometry.size.width - 40) / logicalWidth, (geometry.size.height - 40) / logicalHeight))
                ZStack {
                    // Alttaki yapraklar
                    RoundedRectangle(cornerRadius: 2)
                        .fill(Color(red: 0.84, green: 0.83, blue: 0.79))
                        .offset(x: 10, y: 6)
                    RoundedRectangle(cornerRadius: 2)
                        .fill(Color(red: 0.90, green: 0.89, blue: 0.85))
                        .offset(x: 5, y: 3)
                    if spreadMode {
                        spreadContent
                    } else if let page = selectedPage {
                        pageStack(for: page, side: .left)
                    }
                }
                .frame(width: logicalWidth, height: logicalHeight)
                .shadow(color: .black.opacity(0.35), radius: 18, y: 8)
                .scaleEffect(scale)
                .frame(width: logicalWidth * scale, height: logicalHeight * scale)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
            .padding(.vertical, 12)
            .overlay(alignment: .top) {
                modeBanner
            }
        } else {
            ContentUnavailableView("Sayfa Yok", systemImage: "doc", description: Text("Yazmaya başlamak için bir sayfa ekle."))
        }
    }

    // Çift sayfa (docs/tasarim/04-CiftSayfa.png): iki sayfa yan yana, ortada cilt gölgesi.
    private var spreadContent: some View {
        HStack(spacing: 0) {
            if let left = spreadPages.left {
                pageStack(for: left, side: .left)
            } else {
                emptyPagePlaceholder
            }
            if let right = spreadPages.right {
                pageStack(for: right, side: .right)
            } else {
                emptyPagePlaceholder
            }
        }
        .overlay {
            LinearGradient(
                colors: [.clear, .black.opacity(0.16), .black.opacity(0.28), .black.opacity(0.16), .clear],
                startPoint: .leading,
                endPoint: .trailing
            )
            .frame(width: 48)
            .allowsHitTesting(false)
        }
    }

    // Çiftin boş kalan yarısı: dokununca Sayfa Ekle açılır.
    private var emptyPagePlaceholder: some View {
        Button {
            commitAllDrawings()
            showingAddPage = true
        } label: {
            RoundedRectangle(cornerRadius: 2)
                .fill(Color.white.opacity(0.06))
                .overlay(
                    RoundedRectangle(cornerRadius: 2)
                        .strokeBorder(style: StrokeStyle(lineWidth: 2, dash: [12, 10]))
                        .foregroundStyle(Color.white.opacity(0.3))
                )
                .overlay(
                    VStack(spacing: 12) {
                        Image(systemName: "plus")
                            .font(.system(size: 44, weight: .light))
                        Text("Sayfa ekle")
                            .font(.title3)
                    }
                    .foregroundStyle(Color.white.opacity(0.6))
                )
        }
        .buttonStyle(.plain)
        .frame(width: Self.pageWidth, height: Self.pageHeight)
        .accessibilityLabel("Sayfa ekle")
    }

    // Tek bir sayfanın katmanları: şablon → nesneler → PencilKit → örtüler.
    private func pageStack(for page: NotebookPage, side: PageSide) -> some View {
        let actions = side == .right ? rightCanvasActions : leftCanvasActions
        return Group {
            if let drawing = page.drawing {
                ZStack {
                    PageBackgroundView(page: page)
                    PageObjectsLayer(
                        objects: page.overlay?.objects ?? [],
                        selectedID: $selectedObjectID,
                        isEditing: editingObjects,
                        assets: assets,
                        onChange: { updated in updateObject(updated, pageID: page.id) },
                        onRotate90: { id in rotateObject(id, pageID: page.id) },
                        onDuplicate: { id in duplicateObject(id, pageID: page.id) },
                        onBringToFront: { id in bringObjectToFront(id, pageID: page.id) },
                        onDelete: { id in deleteObject(id, pageID: page.id) }
                    )
                    .allowsHitTesting(editingObjects)
                    PencilCanvasView(
                        drawing: drawing,
                        toolConfiguration: configuration,
                        actions: actions
                    ) { drawing, persistImmediately in
                        activeSide = side
                        store.updateDrawing(
                            drawing,
                            notebookID: notebookID,
                            pageID: page.id,
                            persistImmediately: persistImmediately
                        )
                    }
                    .id(page.id)
                    .allowsHitTesting(!editingObjects && !isFrostedPenActive)
                    CoverLayer(
                        covers: page.overlay?.covers ?? [],
                        isEditing: editingObjects,
                        isFrostedPenActive: isFrostedPenActive && !editingObjects,
                        frostedSettings: frostedSettings,
                        selectedID: $selectedObjectID,
                        onTransform: { id, rect, rotation in updateCover(id, rect: rect, rotation: rotation, pageID: page.id) },
                        onAddCover: { cover in addCover(cover, pageID: page.id) },
                        onRotate90: { id in rotateCover(id, pageID: page.id) },
                        onDuplicate: { id in duplicateCover(id, pageID: page.id) },
                        onBringToFront: { id in bringCoverToFront(id, pageID: page.id) },
                        onDelete: { id in deleteCover(id, pageID: page.id) }
                    )
                }
            } else {
                ContentUnavailableView(
                    "Sayfa Yazısı Okunamıyor",
                    systemImage: "exclamationmark.triangle",
                    description: Text("Kayıtlı çizim verisi bozuk olduğu için bu sayfa düzenlemeye kapatıldı.")
                )
                .background(PaperBackgroundView.paperColor)
                .environment(\.colorScheme, .light)
            }
        }
        .frame(width: Self.pageWidth, height: Self.pageHeight)
        .clipShape(RoundedRectangle(cornerRadius: 2))
    }

    // Kip bildirimi: nesne düzenleme veya buzlu kalem açıkken sayfanın üstünde durur.
    @ViewBuilder
    private var modeBanner: some View {
        if editingObjects {
            HStack(spacing: 12) {
                Text(selectedObjectID == nil ? "Nesne düzenleme: bir nesneye dokun" : "Sürükle, köşeden büyüt, üstten döndür")
                    .font(.footnote)
                    .foregroundStyle(Color.white.opacity(0.75))
                Button("Bitti") { setEditingObjects(false) }
                    .font(.subheadline.weight(.semibold))
                    .buttonStyle(.borderedProminent)
                    .tint(accent)
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 8)
            .background(Color.black.opacity(0.35), in: Capsule())
            .padding(.top, 16)
        } else if isFrostedPenActive {
            Label("Buzlu kalem: yazının üstüne çek", systemImage: "hand.draw")
                .font(.footnote)
                .foregroundStyle(Color.white.opacity(0.75))
                .padding(.horizontal, 14)
                .padding(.vertical, 8)
                .background(Color.black.opacity(0.35), in: Capsule())
                .padding(.top, 16)
        }
    }

    private func movePage(by offset: Int) {
        guard let notebook, !notebook.pages.isEmpty else { return }
        let index: Int
        if spreadMode {
            index = min(max(spreadLeftIndex + offset * 2, 0), notebook.pages.count - 1)
            guard index != spreadLeftIndex else { return }
        } else {
            index = selectedIndex + offset
            guard notebook.pages.indices.contains(index) else { return }
        }
        commitAllDrawings()
        selectedPageID = notebook.pages[index].id
    }

    // MARK: - Nesne düzenleme kipi

    private func setEditingObjects(_ editing: Bool) {
        if editing { commitAllDrawings() }
        editingObjects = editing
        if !editing { selectedObjectID = nil }
    }

    private func maxZIndex(on pageID: UUID) -> Int {
        store.notebook(id: notebookID)?.pages.first(where: { $0.id == pageID })?.overlay?.objects.map(\.zIndex).max() ?? 0
    }

    /// Yeni nesneyi sayfanın ortasına yakın koyar; üst üste binmesin diye her seferinde biraz kaydırır.
    private func centeredRect(width: CGFloat, height: CGFloat, pageID: UUID) -> CGRect {
        let page = store.notebook(id: notebookID)?.pages.first(where: { $0.id == pageID })
        let existingCount = (page?.overlay?.objects.count ?? 0) + (page?.overlay?.covers.count ?? 0)
        let shift = CGFloat(existingCount % 5) * 18
        return CGRect(x: (Self.pageWidth - width) / 2 + shift, y: (Self.pageHeight - height) / 2 + shift, width: width, height: height)
    }

    // MARK: Fotoğraf / çıkartma / post-it nesneleri

    private func updateObject(_ updated: PlacedObject, pageID: UUID) {
        store.updateOverlay(notebookID: notebookID, pageID: pageID) { overlay in
            guard let index = overlay.objects.firstIndex(where: { $0.id == updated.id }) else { return }
            overlay.objects[index] = updated
        }
    }

    private func rotateObject(_ id: UUID, pageID: UUID) {
        store.updateOverlay(notebookID: notebookID, pageID: pageID) { overlay in
            guard let index = overlay.objects.firstIndex(where: { $0.id == id }) else { return }
            overlay.objects[index].rotation = (overlay.objects[index].rotation + 90).truncatingRemainder(dividingBy: 360)
        }
    }

    private func duplicateObject(_ id: UUID, pageID: UUID) {
        var newID: UUID?
        store.updateOverlay(notebookID: notebookID, pageID: pageID) { overlay in
            guard let original = overlay.objects.first(where: { $0.id == id }) else { return }
            var copy = original
            copy.id = UUID()
            copy.rect = original.rect.offsetBy(dx: 24, dy: 24)
            copy.zIndex = (overlay.objects.map(\.zIndex).max() ?? 0) + 1
            overlay.objects.append(copy)
            newID = copy.id
        }
        if let newID { selectedObjectID = newID }
    }

    private func bringObjectToFront(_ id: UUID, pageID: UUID) {
        store.updateOverlay(notebookID: notebookID, pageID: pageID) { overlay in
            guard let index = overlay.objects.firstIndex(where: { $0.id == id }) else { return }
            overlay.objects[index].zIndex = (overlay.objects.map(\.zIndex).max() ?? 0) + 1
        }
    }

    private func deleteObject(_ id: UUID, pageID: UUID) {
        var assetName: String?
        store.updateOverlay(notebookID: notebookID, pageID: pageID) { overlay in
            assetName = overlay.objects.first(where: { $0.id == id })?.assetName
            overlay.objects.removeAll { $0.id == id }
        }
        if let assetName, !assetName.isEmpty, !store.isAssetReferenced(assetName) {
            assets.remove(named: assetName)
        }
    }

    private func addPlainPostIt(tintHex: String) {
        guard let pageID = selectedPage?.id else { return }
        let object = PlacedObject(
            kind: .postIt,
            assetName: "",
            rect: centeredRect(width: 200, height: 170, pageID: pageID),
            zIndex: maxZIndex(on: pageID) + 1,
            tintHex: tintHex
        )
        store.updateOverlay(notebookID: notebookID, pageID: pageID) { overlay in
            overlay.objects.append(object)
        }
        selectedObjectID = object.id
        setEditingObjects(true)
    }

    /// İçe aktarılan görseli sayfanın ortasına, genişliği sayfanın yarısı kadar yerleştirir.
    private func placeImportedImage(assetName: String, pixelSize: CGSize, pageID: UUID) {
        let maxWidth: CGFloat = importKind == .sticker ? 180 : 300
        let maxHeight: CGFloat = importKind == .sticker ? 180 : 380
        var width = maxWidth
        var height = pixelSize.width > 0 ? maxWidth * pixelSize.height / pixelSize.width : maxWidth
        if height > maxHeight {
            width = maxHeight * width / height
            height = maxHeight
        }
        let object = PlacedObject(
            kind: importKind,
            assetName: assetName,
            rect: centeredRect(width: width, height: height, pageID: pageID),
            zIndex: maxZIndex(on: pageID) + 1
        )
        store.updateOverlay(notebookID: notebookID, pageID: pageID) { overlay in
            overlay.objects.append(object)
        }
        selectedObjectID = object.id
        setEditingObjects(true)
    }

    private func startImport(kind: PlacedObject.Kind, source: StickerPanelSheet.ImportSource) {
        importKind = kind
        switch source {
        case .photos: showingPhotoPicker = true
        case .files: showingFileImporter = true
        }
    }

    @MainActor
    private func importPhoto(_ item: PhotosPickerItem) async {
        defer { photoItem = nil }
        guard let pageID = selectedPage?.id else { return }
        do {
            guard let data = try await item.loadTransferable(type: Data.self) else {
                photoError = "Görsel okunamadı."
                return
            }
            guard let imported = assets.importImage(data) else {
                photoError = "Görsel kaydedilemedi."
                return
            }
            placeImportedImage(assetName: imported.assetName, pixelSize: imported.size, pageID: pageID)
        } catch {
            photoError = error.localizedDescription
        }
    }

    private func handlePhotoFile(_ result: Result<URL, Error>) {
        guard let pageID = selectedPage?.id else { return }
        switch result {
        case .success(let url):
            let accessing = url.startAccessingSecurityScopedResource()
            defer { if accessing { url.stopAccessingSecurityScopedResource() } }
            guard let data = try? Data(contentsOf: url) else {
                photoError = "Dosya okunamadı."
                return
            }
            guard let imported = assets.importImage(data) else {
                photoError = "Görsel kaydedilemedi."
                return
            }
            placeImportedImage(assetName: imported.assetName, pixelSize: imported.size, pageID: pageID)
        case .failure(let error):
            photoError = error.localizedDescription
        }
    }

    // MARK: Örtüler (buzlu şerit / buzlu post-it)

    private func addCover(_ cover: CoverMark, pageID: UUID) {
        store.updateOverlay(notebookID: notebookID, pageID: pageID) { overlay in
            overlay.covers.append(cover)
        }
    }

    private func addFrostedPostIt(tintHex: String) {
        guard let pageID = selectedPage?.id else { return }
        let cover = CoverMark(
            style: .frostedPostIt,
            rect: centeredRect(width: 220, height: 150, pageID: pageID),
            tintHex: tintHex,
            tintOpacity: 0.55,
            blurRadius: frostedBlur,
            revealOnTap: true
        )
        addCover(cover, pageID: pageID)
        selectedObjectID = cover.id
        setEditingObjects(true)
    }

    private func updateCover(_ id: UUID, rect: CGRect, rotation: Double, pageID: UUID) {
        store.updateOverlay(notebookID: notebookID, pageID: pageID) { overlay in
            guard let index = overlay.covers.firstIndex(where: { $0.id == id }) else { return }
            overlay.covers[index].rect = rect
            overlay.covers[index].rotation = rotation
        }
    }

    private func rotateCover(_ id: UUID, pageID: UUID) {
        store.updateOverlay(notebookID: notebookID, pageID: pageID) { overlay in
            guard let index = overlay.covers.firstIndex(where: { $0.id == id }) else { return }
            overlay.covers[index].rotation = (overlay.covers[index].rotation + 90).truncatingRemainder(dividingBy: 360)
        }
    }

    private func duplicateCover(_ id: UUID, pageID: UUID) {
        var newID: UUID?
        store.updateOverlay(notebookID: notebookID, pageID: pageID) { overlay in
            guard let original = overlay.covers.first(where: { $0.id == id }) else { return }
            var copy = original
            copy.id = UUID()
            copy.rect = original.rect.offsetBy(dx: 24, dy: 24)
            overlay.covers.append(copy)
            newID = copy.id
        }
        if let newID { selectedObjectID = newID }
    }

    private func bringCoverToFront(_ id: UUID, pageID: UUID) {
        store.updateOverlay(notebookID: notebookID, pageID: pageID) { overlay in
            guard let index = overlay.covers.firstIndex(where: { $0.id == id }) else { return }
            let cover = overlay.covers.remove(at: index)
            overlay.covers.append(cover)
        }
    }

    private func deleteCover(_ id: UUID, pageID: UUID) {
        store.updateOverlay(notebookID: notebookID, pageID: pageID) { overlay in
            overlay.covers.removeAll { $0.id == id }
        }
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
                        let isSelected = spreadMode
                            ? (index == spreadLeftIndex || index == spreadLeftIndex + 1)
                            : selectedPageID == page.id
                        Button {
                            commitAllDrawings()
                            selectedPageID = page.id
                        } label: {
                            VStack(spacing: 3) {
                                ZStack {
                                    PageBackgroundView(page: page, useThumbnail: true)
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

private struct NotebookShareSheet: UIViewControllerRepresentable {
    let fileURL: URL

    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: [fileURL], applicationActivities: nil)
    }

    func updateUIViewController(_ controller: UIActivityViewController, context: Context) {}
}
