import PhotosUI
import SwiftUI
import UIKit
import UniformTypeIdentifiers

// Ayarlar ekranı (docs/tasarim/13-Ayarlar.png).
// Sol: Şablonlarım, Kapak desenleri. Sağ: Renk paleti, Varsayılan kalem, Sayfa ayarları.
// Amaç: günlük kullanımda kodu hiç açmamak; her şey buradan değişir.
struct SettingsView: View {
    @EnvironmentObject private var settings: AppSettings
    @EnvironmentObject private var templates: TemplateLibrary
    @EnvironmentObject private var pens: PenFavoritesStore
    @EnvironmentObject private var assets: AssetStore
    @AppStorage(AppSettings.spreadModeKey) private var spreadMode = false

    private enum ImportTarget {
        case template
        case cover
    }

    @State private var importTarget: ImportTarget = .template
    @State private var photoItem: PhotosPickerItem?
    @State private var showingPhotoPicker = false
    @State private var showingFileImporter = false
    @State private var importError: String?
    @State private var renamingTemplateID: UUID?
    @State private var renameText = ""
    @State private var wheelColor: Color = .black

    private let accent = Color(red: 0.36, green: 0.35, blue: 0.85)

    var body: some View {
        ScrollView {
            HStack(alignment: .top, spacing: 36) {
                VStack(alignment: .leading, spacing: 30) {
                    templatesSection
                    coversSection
                }
                VStack(alignment: .leading, spacing: 30) {
                    paletteSection
                    defaultPenSection
                    pageSection
                }
            }
            .padding(28)
        }
        .background(Color(uiColor: .systemGroupedBackground))
        .environment(\.colorScheme, .light)
        .navigationTitle("Ayarlar")
        .navigationBarTitleDisplayMode(.inline)
        .photosPicker(isPresented: $showingPhotoPicker, selection: $photoItem, matching: .images)
        .fileImporter(isPresented: $showingFileImporter, allowedContentTypes: [.image]) { result in
            handleFile(result)
        }
        .onChange(of: photoItem) { _, item in
            guard let item else { return }
            Task { await importPhoto(item) }
        }
        .alert("Görsel eklenemedi", isPresented: Binding(
            get: { importError != nil },
            set: { if !$0 { importError = nil } }
        )) {
            Button("Tamam", role: .cancel) {}
        } message: {
            Text(importError ?? "")
        }
        .alert("Şablonu yeniden adlandır", isPresented: Binding(
            get: { renamingTemplateID != nil },
            set: { if !$0 { renamingTemplateID = nil } }
        )) {
            TextField("Şablon adı", text: $renameText)
            Button("Kaydet") {
                if let renamingTemplateID { templates.rename(renamingTemplateID, to: renameText) }
                renamingTemplateID = nil
            }
            Button("Vazgeç", role: .cancel) { renamingTemplateID = nil }
        }
    }

    // MARK: - Şablonlarım

    private var templatesSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            sectionHeader("ŞABLONLARIM")
            card {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(alignment: .top, spacing: 18) {
                        ForEach(templates.templates) { template in
                            let isDefault = settings.newPageTemplate == .custom(template.id)
                            VStack(spacing: 8) {
                                Group {
                                    if let thumbnail = templates.thumbnail(for: template.id) {
                                        Image(uiImage: thumbnail).resizable().scaledToFill()
                                    } else {
                                        PaperBackgroundView(style: .blank)
                                    }
                                }
                                .frame(width: 128, height: 181)
                                .clipShape(RoundedRectangle(cornerRadius: 8))
                                .overlay(RoundedRectangle(cornerRadius: 8).stroke(isDefault ? accent : Color.gray.opacity(0.3), lineWidth: isDefault ? 3 : 1))
                                Text(template.name)
                                    .font(.subheadline.weight(isDefault ? .semibold : .regular))
                                    .foregroundStyle(isDefault ? accent : Color.secondary)
                                    .lineLimit(1)
                                    .frame(width: 128)
                            }
                            .contentShape(Rectangle())
                            .onTapGesture {
                                settings.newPageTemplate = isDefault ? nil : .custom(template.id)
                            }
                            .contextMenu {
                                Button("Yeniden Adlandır", systemImage: "pencil") {
                                    renameText = template.name
                                    renamingTemplateID = template.id
                                }
                                Button("Sil", systemImage: "trash", role: .destructive) {
                                    if settings.newPageTemplate == .custom(template.id) { settings.newPageTemplate = nil }
                                    templates.remove(template.id)
                                }
                            }
                            .accessibilityLabel("\(template.name)\(isDefault ? ", yeni sayfa şablonu" : "")")
                        }
                        addCell(width: 128, height: 181, title: "Ekle") { source in
                            importTarget = .template
                            start(source)
                        }
                    }
                    .padding(.vertical, 4)
                }
                Text("Fotoğraflar veya Dosyalar'dan eklediğin her görsel buraya şablon olarak düşer. Birine dokununca yeni sayfalar hep onunla açılır; tekrar dokununca \"son kullanılan\" kuralına dönülür.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
        }
    }

    // MARK: - Kapak desenleri

    private var coversSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            sectionHeader("KAPAK DESENLERİ")
            card {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(alignment: .top, spacing: 18) {
                        ForEach(Array(NotebookCover.presets.enumerated()), id: \.offset) { entry in
                            coverCell(entry.element, image: nil)
                        }
                        ForEach(settings.customCoverAssets, id: \.self) { assetName in
                            coverCell(NotebookCover(pattern: .plain, colorHex: "#DDDDDD", imageAssetName: assetName),
                                      image: assets.image(named: assetName))
                                .contextMenu {
                                    Button("Sil", systemImage: "trash", role: .destructive) {
                                        removeCustomCover(assetName)
                                    }
                                }
                        }
                        addCell(width: 112, height: 150, title: "Ekle") { source in
                            importTarget = .cover
                            start(source)
                        }
                    }
                    .padding(.vertical, 4)
                }
                Text("Yeni defter açarken bu desenlerden seçersin. Seçili olan yeni defterlerin kapağıdır.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
        }
    }

    private func coverCell(_ cover: NotebookCover, image: UIImage?) -> some View {
        let isDefault = settings.defaultCover == cover
        return NotebookCoverView(cover: cover, image: image)
            .frame(width: 112, height: 150)
            .overlay(RoundedRectangle(cornerRadius: 10).stroke(isDefault ? accent : Color.clear, lineWidth: 3).padding(-4))
            .contentShape(Rectangle())
            .onTapGesture { settings.defaultCover = cover }
            .accessibilityLabel("\(cover.title) kapak\(isDefault ? ", varsayılan" : "")")
    }

    // MARK: - Renk paleti

    private var paletteSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            sectionHeader("RENK PALETİ")
            card {
                HStack(spacing: 18) {
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 18) {
                            ForEach(pens.palette, id: \.self) { hex in
                                Circle()
                                    .fill(Color(UIColor(hexString: hex) ?? .black))
                                    .frame(width: 44, height: 44)
                                    .overlay(Circle().stroke(Color.black.opacity(0.12), lineWidth: 1))
                                    .contextMenu {
                                        Button("Paletten Çıkar", systemImage: "trash", role: .destructive) {
                                            pens.removePaletteColor(hex)
                                        }
                                        .disabled(pens.palette.count <= 1)
                                    }
                                    .accessibilityLabel("Renk \(hex)")
                            }
                        }
                    }
                    ZStack {
                        Circle()
                            .strokeBorder(style: StrokeStyle(lineWidth: 1, dash: [4, 3]))
                            .foregroundStyle(accent)
                            .frame(width: 44, height: 44)
                        ColorPicker("Renk ekle", selection: $wheelColor, supportsOpacity: false)
                            .labelsHidden()
                            .opacity(0.02)
                        Image(systemName: "plus")
                            .foregroundStyle(accent)
                            .allowsHitTesting(false)
                    }
                    .frame(width: 44, height: 44)
                    .onChange(of: wheelColor) { _, color in
                        pens.addPaletteColor(UIColor(color).hexString)
                    }
                    .accessibilityLabel("Palete renk ekle")
                }
                Text("Tezgahtaki hızlı renkler. Bir renge uzun basınca paletten çıkar.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
        }
    }

    // MARK: - Varsayılan kalem

    private var defaultPenSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            sectionHeader("VARSAYILAN KALEM")
            card {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(alignment: .bottom, spacing: 22) {
                        ForEach(pens.favorites) { pen in
                            let isDefault = pens.defaultPenID == pen.id
                            VStack(spacing: 8) {
                                PenIllustration(pen: pen)
                                    .frame(width: 46, height: 104)
                                Text(pen.name)
                                    .font(.subheadline.weight(isDefault ? .semibold : .regular))
                                    .foregroundStyle(isDefault ? accent : Color.secondary)
                                    .lineLimit(1)
                            }
                            .padding(.horizontal, 12)
                            .padding(.vertical, 10)
                            .background(isDefault ? accent.opacity(0.12) : Color.clear, in: RoundedRectangle(cornerRadius: 12))
                            .contentShape(Rectangle())
                            .onTapGesture { pens.makeDefault(pen.id) }
                            .accessibilityLabel("\(pen.name)\(isDefault ? ", varsayılan" : "")")
                        }
                    }
                    .padding(.vertical, 4)
                }
                if let pen = pens.defaultPen {
                    HStack(spacing: 14) {
                        Text("Kalınlık")
                            .foregroundStyle(.secondary)
                        Slider(value: Binding(
                            get: { pen.width },
                            set: { pens.updateWidth(pen.id, width: $0) }
                        ), in: 1...24, step: 0.5)
                        .tint(accent)
                        Text("\(PenPanelView.format(CGFloat(pen.width))) pt")
                            .monospacedDigit()
                            .frame(width: 52, alignment: .trailing)
                    }
                }
                Text("Yeni sayfa açınca bu kalem seçili gelir. Kalınlık, seçili varsayılan kalemin kalınlığını değiştirir.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
        }
    }

    // MARK: - Sayfa

    private var pageSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            sectionHeader("SAYFA")
            VStack(spacing: 0) {
                settingsRow("Varsayılan sayfa boyutu") {
                    Picker("Varsayılan sayfa boyutu", selection: $settings.defaultPageSize) {
                        ForEach(PageSizeOption.allCases) { option in
                            Text(option.title).tag(option)
                        }
                    }
                    .pickerStyle(.menu)
                    .tint(.secondary)
                }
                Divider().padding(.leading, 20)
                settingsRow("Varsayılan görünüm") {
                    Picker("Varsayılan görünüm", selection: $spreadMode) {
                        Text("Tek sayfa").tag(false)
                        Text("Çift sayfa").tag(true)
                    }
                    .pickerStyle(.menu)
                    .tint(.secondary)
                }
                Divider().padding(.leading, 20)
                settingsRow("Yeni sayfa şablonu") {
                    Menu {
                        Button {
                            settings.newPageTemplate = nil
                        } label: {
                            if settings.newPageTemplate == nil {
                                Label("Son kullanılan", systemImage: "checkmark")
                            } else {
                                Text("Son kullanılan")
                            }
                        }
                        if !templates.templates.isEmpty {
                            Section("Şablonlarım") {
                                ForEach(templates.templates) { template in
                                    Button {
                                        settings.newPageTemplate = .custom(template.id)
                                    } label: {
                                        if settings.newPageTemplate == .custom(template.id) {
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
                                    settings.newPageTemplate = .builtin(style)
                                } label: {
                                    if settings.newPageTemplate == .builtin(style) {
                                        Label(style.title, systemImage: "checkmark")
                                    } else {
                                        Text(style.title)
                                    }
                                }
                            }
                        }
                    } label: {
                        HStack(spacing: 6) {
                            Text(newPageTemplateTitle)
                            Image(systemName: "chevron.up.chevron.down")
                                .font(.caption)
                        }
                        .foregroundStyle(.secondary)
                    }
                }
                Divider().padding(.leading, 20)
                settingsRow("Sadece Apple Pencil ile yaz") {
                    Toggle("Sadece Apple Pencil ile yaz", isOn: $settings.pencilOnly)
                        .labelsHidden()
                        .tint(.green)
                }
            }
            .background(Color(uiColor: .secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 14))
        }
    }

    private var newPageTemplateTitle: String {
        switch settings.newPageTemplate {
        case .none:
            return "Son kullanılan"
        case .some(.builtin(let style)):
            return style.title
        case .some(.custom(let id)):
            return templates.template(id: id)?.name ?? "Son kullanılan"
        }
    }

    // MARK: - Ortak parçalar

    private func sectionHeader(_ title: String) -> some View {
        Text(title)
            .font(.subheadline.weight(.bold))
            .foregroundStyle(.secondary)
            .padding(.leading, 4)
    }

    private func card<Content: View>(@ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            content()
        }
        .padding(20)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(uiColor: .secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 14))
    }

    private func settingsRow<Trailing: View>(_ title: String, @ViewBuilder trailing: () -> Trailing) -> some View {
        HStack {
            Text(title)
                .font(.body)
            Spacer()
            trailing()
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 14)
    }

    private func addCell(width: CGFloat, height: CGFloat, title: String, action: @escaping (StickerPanelSheet.ImportSource) -> Void) -> some View {
        Menu {
            Button("Fotoğraflardan", systemImage: "photo.on.rectangle") { action(.photos) }
            Button("Dosyalardan", systemImage: "folder") { action(.files) }
        } label: {
            VStack(spacing: 8) {
                RoundedRectangle(cornerRadius: 8)
                    .fill(accent.opacity(0.06))
                    .overlay(
                        RoundedRectangle(cornerRadius: 8)
                            .strokeBorder(style: StrokeStyle(lineWidth: 1, dash: [5, 4]))
                            .foregroundStyle(accent.opacity(0.6))
                    )
                    .overlay(Image(systemName: "plus").font(.title2).foregroundStyle(accent))
                    .frame(width: width, height: height)
                Text(title)
                    .font(.subheadline)
                    .foregroundStyle(accent)
            }
        }
        .accessibilityLabel("\(title): görsel ekle")
    }

    // MARK: - İçe aktarma

    private func start(_ source: StickerPanelSheet.ImportSource) {
        switch source {
        case .photos: showingPhotoPicker = true
        case .files: showingFileImporter = true
        }
    }

    private func handleImported(data: Data, suggestedName: String?) {
        switch importTarget {
        case .template:
            guard let template = templates.importImage(data, suggestedName: suggestedName) else {
                importError = "Görsel kaydedilemedi."
                return
            }
            settings.newPageTemplate = .custom(template.id)
        case .cover:
            guard let imported = assets.importImage(data) else {
                importError = "Görsel kaydedilemedi."
                return
            }
            settings.customCoverAssets.append(imported.assetName)
            settings.defaultCover = NotebookCover(pattern: .plain, colorHex: "#DDDDDD", imageAssetName: imported.assetName)
        }
    }

    private func removeCustomCover(_ assetName: String) {
        settings.customCoverAssets.removeAll { $0 == assetName }
        if settings.defaultCover.imageAssetName == assetName {
            settings.defaultCover = .fallback
        }
        assets.remove(named: assetName)
    }

    @MainActor
    private func importPhoto(_ item: PhotosPickerItem) async {
        defer { photoItem = nil }
        do {
            guard let data = try await item.loadTransferable(type: Data.self) else {
                importError = "Görsel okunamadı."
                return
            }
            handleImported(data: data, suggestedName: nil)
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
            handleImported(data: data, suggestedName: url.deletingPathExtension().lastPathComponent)
        case .failure(let error):
            importError = error.localizedDescription
        }
    }
}
