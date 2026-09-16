import PhotosUI
import SwiftUI
import UIKit
import UniformTypeIdentifiers

// Sayfa Ekle ekranı (docs/tasarim/11-SayfaEkle.png).
// Sekmeler: Şablonlarım (kendi görsellerin), Desenler (uygulamayla gelenler).
// "PDF'ten" sekmesi 12. adımda (PDF içe aktarma) gelecek.
// Sağ üstte "Ekleneceği yer": başa ya da N. sayfadan sonra.

enum TemplateSelection: Equatable {
    case builtin(PaperStyle)
    case custom(UUID)
}

struct AddPageSheet: View {
    @ObservedObject var store: NotebookStore
    @ObservedObject var templates: TemplateLibrary
    let notebookID: UUID
    let currentIndex: Int
    let initialSelection: TemplateSelection
    var onAdded: (UUID) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var tab: Tab = .mine
    @State private var selection: TemplateSelection?
    @State private var insertIndex = 0
    @State private var photoItem: PhotosPickerItem?
    @State private var showingPhotoPicker = false
    @State private var showingFileImporter = false
    @State private var importError: String?
    @State private var renamingID: UUID?
    @State private var renameText = ""

    enum Tab: String, CaseIterable, Identifiable {
        case mine = "Şablonlarım"
        case patterns = "Desenler"
        var id: String { rawValue }
    }

    private let accent = Color(red: 0.36, green: 0.35, blue: 0.85)
    private let columns = [GridItem(.adaptive(minimum: 150, maximum: 190), spacing: 18)]

    private var pageCount: Int {
        max(store.notebook(id: notebookID)?.pages.count ?? 1, 1)
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 22) {
                    header
                    LazyVGrid(columns: columns, alignment: .leading, spacing: 22) {
                        if tab == .mine {
                            addTemplateCell
                            ForEach(templates.templates) { template in
                                customTemplateCell(template)
                            }
                        } else {
                            ForEach(PaperStyle.allCases) { style in
                                builtinCell(style)
                            }
                        }
                    }
                    Text("Fotoğraflar veya Dosyalar'dan eklediğin her görsel burada şablon olarak kalır; her sayfaya ayrı şablon seçebilirsin.")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                .padding(24)
            }
            .background(Color(uiColor: .systemGroupedBackground))
            .navigationTitle("Sayfa Ekle")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("İptal") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Ekle") { add() }
                        .fontWeight(.semibold)
                        .disabled(selection == nil)
                }
            }
            .photosPicker(isPresented: $showingPhotoPicker, selection: $photoItem, matching: .images)
            .fileImporter(isPresented: $showingFileImporter, allowedContentTypes: [.image]) { result in
                handleFile(result)
            }
            .onChange(of: photoItem) { _, item in
                guard let item else { return }
                Task { await importPhoto(item) }
            }
            .alert("Şablon eklenemedi", isPresented: Binding(
                get: { importError != nil },
                set: { if !$0 { importError = nil } }
            )) {
                Button("Tamam", role: .cancel) {}
            } message: {
                Text(importError ?? "")
            }
            .alert("Şablonu yeniden adlandır", isPresented: Binding(
                get: { renamingID != nil },
                set: { if !$0 { renamingID = nil } }
            )) {
                TextField("Şablon adı", text: $renameText)
                Button("Kaydet") {
                    if let renamingID { templates.rename(renamingID, to: renameText) }
                    renamingID = nil
                }
                Button("Vazgeç", role: .cancel) { renamingID = nil }
            }
        }
        // Editör koyu; bu ekran tasarımda açık renkli (11-SayfaEkle.png).
        .preferredColorScheme(.light)
        .onAppear {
            insertIndex = min(currentIndex + 1, pageCount)
            if selection == nil {
                selection = initialSelection
                if case .builtin = initialSelection, !templates.templates.isEmpty {
                    tab = .mine
                } else if case .builtin = initialSelection {
                    tab = .patterns
                }
            }
        }
    }

    private var header: some View {
        HStack(spacing: 16) {
            Picker("Kaynak", selection: $tab) {
                ForEach(Tab.allCases) { tab in
                    Text(tab.rawValue).tag(tab)
                }
            }
            .pickerStyle(.segmented)
            .frame(maxWidth: 360)

            Spacer()

            Text("Ekleneceği yer")
                .foregroundStyle(.secondary)
            Picker("Ekleneceği yer", selection: $insertIndex) {
                Text("Başa").tag(0)
                ForEach(Array(1...pageCount), id: \.self) { number in
                    Text("\(number). sayfadan sonra").tag(number)
                }
            }
            .pickerStyle(.menu)
        }
    }

    // MARK: - Hücreler

    private var addTemplateCell: some View {
        Menu {
            Button("Fotoğraflardan", systemImage: "photo.on.rectangle") {
                showingPhotoPicker = true
            }
            Button("Dosyalardan", systemImage: "folder") {
                showingFileImporter = true
            }
        } label: {
            VStack(spacing: 10) {
                RoundedRectangle(cornerRadius: 10)
                    .fill(accent.opacity(0.06))
                    .overlay(
                        RoundedRectangle(cornerRadius: 10)
                            .strokeBorder(style: StrokeStyle(lineWidth: 1, dash: [5, 4]))
                            .foregroundStyle(accent.opacity(0.6))
                    )
                    .overlay(
                        Image(systemName: "plus")
                            .font(.system(size: 28, weight: .medium))
                            .foregroundStyle(accent)
                    )
                    .aspectRatio(CGFloat(210) / CGFloat(297), contentMode: .fit)
                Text("Şablon Ekle")
                    .font(.subheadline)
                    .foregroundStyle(accent)
            }
        }
        .accessibilityLabel("Şablon ekle")
    }

    private func customTemplateCell(_ template: CustomTemplate) -> some View {
        let isSelected = selection == .custom(template.id)
        return TemplateCell(title: template.name, isSelected: isSelected, accent: accent) {
            if let thumbnail = templates.thumbnail(for: template.id) {
                Image(uiImage: thumbnail)
                    .resizable()
                    .scaledToFill()
            } else {
                PaperBackgroundView(style: .blank)
            }
        }
        .onTapGesture { selection = .custom(template.id) }
        .contextMenu {
            Button("Yeniden Adlandır", systemImage: "pencil") {
                renameText = template.name
                renamingID = template.id
            }
            Button("Sil", systemImage: "trash", role: .destructive) {
                if selection == .custom(template.id) { selection = nil }
                templates.remove(template.id)
            }
        }
        .accessibilityAddTraits(isSelected ? .isSelected : [])
    }

    private func builtinCell(_ style: PaperStyle) -> some View {
        let isSelected = selection == .builtin(style)
        return TemplateCell(title: style.title, isSelected: isSelected, accent: accent) {
            PaperBackgroundView(style: style)
        }
        .onTapGesture { selection = .builtin(style) }
        .accessibilityAddTraits(isSelected ? .isSelected : [])
    }

    // MARK: - İşlemler

    private func add() {
        guard let selection else { return }
        let newPageID: UUID?
        switch selection {
        case .builtin(let style):
            newPageID = store.addPage(to: notebookID, at: insertIndex, paper: style, customTemplateID: nil)
        case .custom(let id):
            newPageID = store.addPage(to: notebookID, at: insertIndex, paper: .blank, customTemplateID: id)
        }
        if let newPageID { onAdded(newPageID) }
        dismiss()
    }

    @MainActor
    private func importPhoto(_ item: PhotosPickerItem) async {
        defer { photoItem = nil }
        do {
            guard let data = try await item.loadTransferable(type: Data.self) else {
                importError = "Görsel okunamadı."
                return
            }
            guard let template = templates.importImage(data, suggestedName: nil) else {
                importError = "Görsel kaydedilemedi."
                return
            }
            selection = .custom(template.id)
            tab = .mine
        } catch {
            importError = error.localizedDescription
        }
    }

    private func handleFile(_ result: Result<URL, Error>) {
        switch result {
        case .success(let url):
            let accessing = url.startAccessingSecurityScopedResource()
            defer { if accessing { url.stopAccessingSecurityScopedResource() } }
            guard let data = try? Data(contentsOf: url) else {
                importError = "Dosya okunamadı."
                return
            }
            let name = url.deletingPathExtension().lastPathComponent
            guard let template = templates.importImage(data, suggestedName: name) else {
                importError = "Görsel kaydedilemedi."
                return
            }
            selection = .custom(template.id)
            tab = .mine
        case .failure(let error):
            importError = error.localizedDescription
        }
    }
}

// Şablon seçim hücresi: A4 oranında önizleme, altında ad. Seçiliyse mor çerçeve.
struct TemplateCell<Preview: View>: View {
    let title: String
    let isSelected: Bool
    let accent: Color
    @ViewBuilder let preview: () -> Preview

    var body: some View {
        VStack(spacing: 10) {
            preview()
                .aspectRatio(CGFloat(210) / CGFloat(297), contentMode: .fit)
                .clipShape(RoundedRectangle(cornerRadius: 10))
                .overlay(
                    RoundedRectangle(cornerRadius: 10)
                        .stroke(isSelected ? accent : Color.gray.opacity(0.3), lineWidth: isSelected ? 3 : 1)
                )
                .shadow(color: .black.opacity(0.06), radius: 4, y: 2)
            Text(title)
                .font(.subheadline.weight(isSelected ? .semibold : .regular))
                .foregroundStyle(isSelected ? accent : Color.primary)
                .lineLimit(1)
        }
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
        .accessibilityLabel(title)
    }
}
