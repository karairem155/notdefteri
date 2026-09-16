import SwiftUI
import UniformTypeIdentifiers

// Sayfalar ekranı (docs/tasarim/12-Sayfalar.png).
// Defterin bütün sayfaları sırayla, her biri kendi şablonuyla.
// Sürükleyip bırakarak sıralama; uzun basınca şablon değiştir, çoğalt, sil; dokununca o sayfaya git.
struct PagesGridView: View {
    @ObservedObject var store: NotebookStore
    @ObservedObject var templates: TemplateLibrary
    let notebookID: UUID
    @Binding var selectedPageID: UUID?

    @Environment(\.dismiss) private var dismiss
    @State private var showingAddPage = false
    @State private var pendingDelete: NotebookPage?
    @State private var draggingPageID: UUID?

    private let accent = Color(red: 0.36, green: 0.35, blue: 0.85)
    private let columns = [GridItem(.adaptive(minimum: 190, maximum: 250), spacing: 28)]

    private var notebook: Notebook? { store.notebook(id: notebookID) }
    private var pages: [NotebookPage] { notebook?.pages ?? [] }

    private var selectedIndex: Int {
        pages.firstIndex(where: { $0.id == selectedPageID }) ?? 0
    }

    private var currentTemplateSelection: TemplateSelection {
        let page = pages.indices.contains(selectedIndex) ? pages[selectedIndex] : nil
        if let page, let id = page.customTemplateID, templates.template(id: id) != nil {
            return .custom(id)
        }
        return .builtin(page?.paper ?? .ruled)
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 26) {
                HStack {
                    Text("\(pages.count) sayfa · sürükleyerek sırayı değiştir")
                    Spacer()
                    Text("Sayfaya uzun bas: şablonu değiştir, çoğalt, sil")
                }
                .font(.subheadline)
                .foregroundStyle(.secondary)

                LazyVGrid(columns: columns, alignment: .leading, spacing: 36) {
                    ForEach(Array(pages.enumerated()), id: \.element.id) { entry in
                        pageCell(entry.element, index: entry.offset)
                    }
                }
            }
            .padding(28)
        }
        .background(Color(uiColor: .systemGroupedBackground))
        .environment(\.colorScheme, .light)
        .navigationTitle("Sayfalar")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(Color(uiColor: .systemBackground), for: .navigationBar)
        .toolbarBackground(.visible, for: .navigationBar)
        .toolbarColorScheme(.light, for: .navigationBar)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    showingAddPage = true
                } label: {
                    Label("Sayfa Ekle", systemImage: "plus")
                        .labelStyle(.titleAndIcon)
                }
                .buttonStyle(.bordered)
                .tint(accent)
            }
        }
        .sheet(isPresented: $showingAddPage) {
            AddPageSheet(
                store: store,
                templates: templates,
                notebookID: notebookID,
                currentIndex: selectedIndex,
                initialSelection: currentTemplateSelection
            ) { newPageID in
                selectedPageID = newPageID
            }
        }
        .confirmationDialog("Bu sayfa silinsin mi?", isPresented: Binding(
            get: { pendingDelete != nil },
            set: { if !$0 { pendingDelete = nil } }
        ), titleVisibility: .visible) {
            Button("Sayfayı Sil", role: .destructive) {
                if let pendingDelete { deletePage(pendingDelete) }
                pendingDelete = nil
            }
            Button("Vazgeç", role: .cancel) { pendingDelete = nil }
        } message: {
            Text("Sayfa ve üzerindeki yazılar silinir. Defterde en az bir sayfa kalmalı.")
        }
    }

    // MARK: - Hücre

    private func pageCell(_ page: NotebookPage, index: Int) -> some View {
        let isSelected = page.id == selectedPageID
        let isDragging = page.id == draggingPageID
        return VStack(spacing: 12) {
            ZStack {
                PageBackgroundView(page: page, useThumbnail: true)
                PageInkPreview(drawingData: page.drawingData, scale: 0.35)
                    .allowsHitTesting(false)
            }
            .aspectRatio(CGFloat(210) / CGFloat(297), contentMode: .fit)
            .clipShape(RoundedRectangle(cornerRadius: 10))
            .overlay(
                RoundedRectangle(cornerRadius: 10)
                    .stroke(isSelected ? accent : Color.gray.opacity(0.3), lineWidth: isSelected ? 3 : 1)
            )
            .shadow(color: .black.opacity(0.08), radius: 6, y: 3)
            .opacity(isDragging ? 0.4 : 1)

            Text("\(index + 1)")
                .font(.subheadline.weight(.semibold).monospacedDigit())
                .foregroundStyle(isSelected ? Color.white : Color.secondary)
                .padding(.horizontal, 12)
                .padding(.vertical, 3)
                .background(isSelected ? accent : Color.clear, in: Capsule())
        }
        .contentShape(Rectangle())
        .onTapGesture {
            selectedPageID = page.id
            dismiss()
        }
        .contextMenu {
            Menu("Şablonu Değiştir", systemImage: "doc.text.image") {
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
                            if page.customTemplateID == nil && style == page.paper {
                                Label(style.title, systemImage: "checkmark")
                            } else {
                                Text(style.title)
                            }
                        }
                    }
                }
            }
            Button("Çoğalt", systemImage: "plus.square.on.square") {
                if let newID = store.duplicatePage(in: notebookID, pageID: page.id) {
                    selectedPageID = newID
                }
            }
            Button("Sil", systemImage: "trash", role: .destructive) {
                pendingDelete = page
            }
            .disabled(pages.count <= 1)
        }
        .draggable(page.id.uuidString) {
            // Sürüklenirken görünen küçük kopya
            ZStack {
                PageBackgroundView(page: page, useThumbnail: true)
                PageInkPreview(drawingData: page.drawingData, scale: 0.2)
            }
            .frame(width: 100, height: 141)
            .clipShape(RoundedRectangle(cornerRadius: 6))
            .onAppear { draggingPageID = page.id }
            .onDisappear { draggingPageID = nil }
        }
        .dropDestination(for: String.self) { items, _ in
            guard let raw = items.first, let movedID = UUID(uuidString: raw) else { return false }
            draggingPageID = nil
            store.movePage(in: notebookID, pageID: movedID, toIndex: index)
            return true
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(index + 1). sayfa\(isSelected ? ", seçili" : "")")
        .accessibilityHint("Açmak için dokun")
    }

    private func deletePage(_ page: NotebookPage) {
        let oldIndex = pages.firstIndex(where: { $0.id == page.id }) ?? 0
        guard store.deletePage(in: notebookID, pageID: page.id) else { return }
        if selectedPageID == page.id {
            let remaining = pages
            if !remaining.isEmpty {
                selectedPageID = remaining[min(oldIndex, remaining.count - 1)].id
            }
        }
    }
}
