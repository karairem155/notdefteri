import SwiftUI
import UIKit

// Çıkartma / post-it paneli (docs/tasarim/08-CikartmaPaneli.png).
// Sekmeler: Çıkartmalar, Post-it, Bant, Çıkartmalarım.
// Hazır çıkartma ve bant görselleri henüz yok; o iki sekme yer tutucu.
struct StickerPanelSheet: View {
    enum ImportSource {
        case photos
        case files
    }

    var onAddPlainPostIt: (String) -> Void
    var onAddFrostedPostIt: (String) -> Void
    var onImportSticker: (ImportSource) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var tab: Tab = .postIt
    @State private var customColor = Color(red: 1.0, green: 0.90, blue: 0.40)

    enum Tab: String, CaseIterable, Identifiable {
        case stickers = "Çıkartmalar"
        case postIt = "Post-it"
        case tape = "Bant"
        case mine = "Çıkartmalarım"
        var id: String { rawValue }
    }

    struct PostItColor: Identifiable {
        let name: String
        let hex: String
        var id: String { hex }
    }

    static let plainColors: [PostItColor] = [
        PostItColor(name: "Sarı", hex: "#FFE566"),
        PostItColor(name: "Pembe", hex: "#FFB8CC"),
        PostItColor(name: "Mavi", hex: "#A9D3F5"),
        PostItColor(name: "Yeşil", hex: "#B4E6A8"),
        PostItColor(name: "Turuncu", hex: "#FFC48F")
    ]

    static let frostedColors: [PostItColor] = [
        PostItColor(name: "Buzlu sarı", hex: "#F6EEC2"),
        PostItColor(name: "Buzlu pembe", hex: "#F6CDD6"),
        PostItColor(name: "Buzlu mavi", hex: "#CBDFF0"),
        PostItColor(name: "Buzlu gri", hex: "#E3E3E7"),
        PostItColor(name: "Buzlu yeşil", hex: "#D2EAD0")
    ]

    private let panelColor = Color(red: 0.11, green: 0.11, blue: 0.14)
    private let accent = Color(red: 0.55, green: 0.50, blue: 0.95)
    private let columns = [GridItem(.adaptive(minimum: 150, maximum: 170), spacing: 20)]

    var body: some View {
        VStack(alignment: .leading, spacing: 22) {
            HStack {
                Picker("Bölüm", selection: $tab) {
                    ForEach(Tab.allCases) { tab in
                        Text(tab.rawValue).tag(tab)
                    }
                }
                .pickerStyle(.segmented)
                .frame(maxWidth: 620)
                Spacer()
                Button("Bitti") { dismiss() }
                    .font(.headline)
                    .foregroundStyle(accent)
            }

            ScrollView {
                switch tab {
                case .postIt:
                    postItSection
                case .mine:
                    mineSection
                case .stickers:
                    placeholder("Hazır çıkartmalar sonraki adımda gelecek. Kendi çıkartmalarını \"Çıkartmalarım\" sekmesinden ekleyebilirsin.")
                case .tape:
                    placeholder("Hazır bantlar sonraki adımda gelecek.")
                }
            }
        }
        .padding(28)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(panelColor)
        .presentationBackground(panelColor)
        .preferredColorScheme(.dark)
    }

    // MARK: - Post-it

    private var postItSection: some View {
        VStack(alignment: .leading, spacing: 26) {
            VStack(alignment: .leading, spacing: 14) {
                sectionTitle("DÜZ POST-IT", hint: "altına yazı yazılabilir")
                LazyVGrid(columns: columns, alignment: .leading, spacing: 20) {
                    ForEach(Self.plainColors) { entry in
                        Button {
                            onAddPlainPostIt(entry.hex)
                            dismiss()
                        } label: {
                            postItCell(name: entry.name) {
                                PostItPaper(tintHex: entry.hex)
                            }
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("\(entry.name) post-it ekle")
                    }
                    customColorCell
                }
            }

            VStack(alignment: .leading, spacing: 14) {
                sectionTitle("BUZLU POST-IT", hint: "cevabı örter, dokununca açılır")
                LazyVGrid(columns: columns, alignment: .leading, spacing: 20) {
                    ForEach(Self.frostedColors) { entry in
                        Button {
                            onAddFrostedPostIt(entry.hex)
                            dismiss()
                        } label: {
                            postItCell(name: entry.name) {
                                frostedPreview(hex: entry.hex)
                            }
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("\(entry.name) post-it ekle")
                    }
                }
            }

            Label("Buzlu post-it'i cevabın üstüne koy. Altındaki yazı bulanık görünür; parmağınla dokununca açılır, tekrar dokununca kapanır.",
                  systemImage: "info.circle")
                .font(.subheadline)
                .foregroundStyle(Color.white.opacity(0.75))
                .padding(16)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color.white.opacity(0.06), in: RoundedRectangle(cornerRadius: 12))
        }
    }

    private var customColorCell: some View {
        VStack(spacing: 10) {
            ZStack {
                RoundedRectangle(cornerRadius: 4)
                    .strokeBorder(style: StrokeStyle(lineWidth: 1, dash: [5, 4]))
                    .foregroundStyle(Color.white.opacity(0.35))
                VStack(spacing: 10) {
                    ColorPicker("Kendi rengim", selection: $customColor, supportsOpacity: false)
                        .labelsHidden()
                        .scaleEffect(1.4)
                    Button("Ekle") {
                        onAddPlainPostIt(UIColor(customColor).hexString)
                        dismiss()
                    }
                    .font(.subheadline.weight(.semibold))
                    .buttonStyle(.borderedProminent)
                    .tint(accent)
                }
            }
            .aspectRatio(1, contentMode: .fit)
            Text("Kendi rengim")
                .font(.subheadline)
                .foregroundStyle(accent)
        }
    }

    private func postItCell<Preview: View>(name: String, @ViewBuilder preview: () -> Preview) -> some View {
        VStack(spacing: 10) {
            preview()
                .aspectRatio(1, contentMode: .fit)
            Text(name)
                .font(.subheadline)
                .foregroundStyle(Color.white.opacity(0.8))
        }
    }

    // Buzlu post-it önizlemesi: tonlu kağıt, altında bulanık yazı çizgileri.
    private func frostedPreview(hex: String) -> some View {
        ZStack(alignment: .topLeading) {
            Rectangle()
                .fill(Color(UIColor(hexString: hex) ?? .systemYellow))
            VStack(alignment: .leading, spacing: 8) {
                Capsule().frame(width: 90, height: 8)
                Capsule().frame(width: 70, height: 8)
                Capsule().frame(width: 100, height: 8)
                Capsule().frame(width: 60, height: 8)
            }
            .foregroundStyle(Color.black.opacity(0.35))
            .padding(18)
            .blur(radius: 4)
        }
        .clipShape(RoundedRectangle(cornerRadius: 2))
        .shadow(color: .black.opacity(0.25), radius: 5, y: 3)
    }

    // MARK: - Çıkartmalarım

    private var mineSection: some View {
        VStack(alignment: .leading, spacing: 14) {
            sectionTitle("ÇIKARTMALARIM", hint: "kendi görsellerin; PNG'de saydamlık korunur")
            HStack(spacing: 14) {
                importButton("Fotoğraflardan", symbol: "photo.on.rectangle", source: .photos)
                importButton("Dosyalardan", symbol: "folder", source: .files)
            }
            Text("Eklenen çıkartma sayfaya yerleşir; sürükleyip döndürebilirsin.")
                .font(.footnote)
                .foregroundStyle(Color.white.opacity(0.5))
        }
    }

    private func importButton(_ title: String, symbol: String, source: ImportSource) -> some View {
        Button {
            onImportSticker(source)
            dismiss()
        } label: {
            Label(title, systemImage: symbol)
                .font(.subheadline.weight(.semibold))
                .padding(.horizontal, 16)
                .padding(.vertical, 12)
                .background(Color.white.opacity(0.08), in: RoundedRectangle(cornerRadius: 10))
                .foregroundStyle(.white)
        }
        .buttonStyle(.plain)
    }

    // MARK: - Ortak

    private func sectionTitle(_ title: String, hint: String) -> some View {
        HStack(spacing: 10) {
            Text(title)
                .font(.caption.weight(.bold))
                .foregroundStyle(Color.white.opacity(0.7))
            Text(hint)
                .font(.caption)
                .foregroundStyle(Color.white.opacity(0.45))
        }
    }

    private func placeholder(_ text: String) -> some View {
        Text(text)
            .font(.subheadline)
            .foregroundStyle(Color.white.opacity(0.6))
            .padding(.top, 30)
            .frame(maxWidth: .infinity, alignment: .leading)
    }
}
