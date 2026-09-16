import SwiftUI
import UIKit

// Koyu araç tezgahı (docs/tasarim/05-NotEditoru.png).
// Üst sıra: hızlı renk paleti (+ ile seçili rengi ekle, çöp ile paletten çıkar).
// Alt sıra: favori kalemler; seçili kalem yukarı kalkar, tekrar dokununca kalem paneli açılır.
// Sağda silgi, kement, çıkartma/post-it, buzlu kalem ve fotoğraf araçları.
struct ToolBenchView: View {
    @ObservedObject var pens: PenFavoritesStore
    @Binding var configuration: DrawingToolConfiguration
    var isEditingObjects: Bool
    var onOpenPenPanel: () -> Void
    var onOpenFrostedPanel: () -> Void
    var onOpenStickerPanel: () -> Void
    var onAddPhotoFromLibrary: () -> Void
    var onAddPhotoFromFiles: () -> Void
    var onToggleEditObjects: () -> Void

    static let benchColor = Color(red: 0.16, green: 0.16, blue: 0.18)
    static let frostedTeal = Color(red: 0.16, green: 0.72, blue: 0.76)

    var body: some View {
        VStack(spacing: 0) {
            paletteRow
            Rectangle()
                .fill(Color.white.opacity(0.08))
                .frame(height: 1)
            pensRow
        }
        .background(Self.benchColor)
    }

    private func isSelectedColor(_ hex: String) -> Bool {
        configuration.choice.isInking && hex.caseInsensitiveCompare(configuration.colorHex) == .orderedSame
    }

    private var hasSelectedPaletteColor: Bool {
        pens.palette.contains(where: { isSelectedColor($0) })
    }

    private var paletteRow: some View {
        HStack(spacing: 0) {
            Button {
                pens.addPaletteColor(configuration.colorHex)
            } label: {
                Image(systemName: "plus")
                    .frame(width: 36, height: 36)
            }
            .disabled(!configuration.choice.isInking || hasSelectedPaletteColor)
            .accessibilityLabel("Seçili rengi palete ekle")

            Spacer(minLength: 8)

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 18) {
                    ForEach(pens.palette, id: \.self) { hex in
                        Button {
                            if !configuration.choice.isInking { configuration.choice = .pen }
                            configuration.colorHex = hex
                        } label: {
                            Circle()
                                .fill(Color(UIColor(hexString: hex) ?? .black))
                                .frame(width: 26, height: 26)
                                .overlay(Circle().stroke(Color.white.opacity(0.25), lineWidth: 1))
                                .padding(4)
                                .overlay(Circle().stroke(isSelectedColor(hex) ? Color.white : Color.clear, lineWidth: 2.5))
                        }
                        .accessibilityLabel("Renk \(hex)")
                        .accessibilityAddTraits(isSelectedColor(hex) ? .isSelected : [])
                    }
                }
                .padding(.horizontal, 8)
            }
            .frame(maxWidth: 560)

            Spacer(minLength: 8)

            Button {
                pens.removePaletteColor(configuration.colorHex)
            } label: {
                Image(systemName: "trash")
                    .frame(width: 36, height: 36)
            }
            .disabled(pens.palette.count <= 1 || !hasSelectedPaletteColor)
            .accessibilityLabel("Seçili rengi paletten çıkar")
        }
        .font(.system(size: 18, weight: .medium))
        .foregroundStyle(Color.white.opacity(0.85))
        .buttonStyle(.plain)
        .padding(.horizontal, 18)
        .padding(.vertical, 8)
    }

    private var pensRow: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(alignment: .bottom, spacing: 24) {
                ForEach(pens.favorites) { pen in
                    let selected = configuration.matches(pen)
                    Button {
                        if selected {
                            onOpenPenPanel()
                        } else {
                            configuration = DrawingToolConfiguration(favorite: pen)
                        }
                    } label: {
                        PenIllustration(pen: pen)
                            .frame(width: 46, height: 104)
                            .offset(y: selected ? -16 : 0)
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(pen.name)
                    .accessibilityHint(selected ? "Kalem panelini açar" : "Bu kalemi seçer")
                    .accessibilityAddTraits(selected ? .isSelected : [])
                }

                Rectangle()
                    .fill(Color.white.opacity(0.12))
                    .frame(width: 1, height: 64)
                    .padding(.bottom, 16)

                utilityButton(.eraser)
                utilityButton(.lasso)
                stickerButton
                frostedButton
                photoButton
            }
            .padding(.horizontal, 28)
            .padding(.top, 22)
        }
        .animation(.spring(duration: 0.25), value: configuration)
        .frame(height: 126)
    }

    // Buzlu kalem (tezgahtaki turkuaz halka). Seçiliyken tekrar dokununca ayar paneli açılır.
    private var frostedButton: some View {
        let selected = configuration.choice == .frosted
        return Button {
            if selected {
                onOpenFrostedPanel()
            } else {
                configuration.choice = .frosted
            }
        } label: {
            Circle()
                .stroke(Self.frostedTeal, lineWidth: 5)
                .background(Circle().fill(Self.frostedTeal.opacity(selected ? 0.35 : 0.15)))
                .frame(width: 34, height: 34)
                .frame(width: 46, height: 64)
                .background(selected ? Color.white.opacity(0.16) : Color.white.opacity(0.06),
                            in: RoundedRectangle(cornerRadius: 10))
                .padding(.bottom, 16)
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Buzlu kalem")
        .accessibilityHint(selected ? "Buzlu kalem ayarlarını açar" : "Yazının üstüne buzlu şerit çeker")
        .accessibilityAddTraits(selected ? .isSelected : [])
    }

    // Çıkartma / post-it paneli.
    private var stickerButton: some View {
        Button(action: onOpenStickerPanel) {
            Image(systemName: "note.text")
                .font(.system(size: 22, weight: .medium))
                .foregroundStyle(Color.white.opacity(0.7))
                .frame(width: 46, height: 64)
                .background(Color.white.opacity(0.06), in: RoundedRectangle(cornerRadius: 10))
                .padding(.bottom, 16)
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Çıkartma ve post-it")
    }

    // Fotoğraf aracı (tezgahın sağındaki resim simgesi): ekleme ve nesne düzenleme kipi.
    private var photoButton: some View {
        Menu {
            Button("Fotoğraflardan Ekle", systemImage: "photo.on.rectangle", action: onAddPhotoFromLibrary)
            Button("Dosyalardan Ekle", systemImage: "folder", action: onAddPhotoFromFiles)
            Divider()
            Button(isEditingObjects ? "Düzenlemeyi Bitir" : "Nesneleri Düzenle",
                   systemImage: isEditingObjects ? "checkmark" : "arrow.up.and.down.and.arrow.left.and.right",
                   action: onToggleEditObjects)
        } label: {
            Image(systemName: "photo")
                .font(.system(size: 22, weight: .medium))
                .foregroundStyle(isEditingObjects ? Color.white : Color.white.opacity(0.7))
                .frame(width: 46, height: 64)
                .background(isEditingObjects ? Color.white.opacity(0.16) : Color.white.opacity(0.06),
                            in: RoundedRectangle(cornerRadius: 10))
                .padding(.bottom, 16)
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Fotoğraf ve nesneler")
    }

    private func utilityButton(_ choice: DrawingToolChoice) -> some View {
        let selected = configuration.choice == choice
        return Button {
            configuration.choice = choice
        } label: {
            Image(systemName: choice.symbol)
                .font(.system(size: 22, weight: .medium))
                .foregroundStyle(selected ? Color.white : Color.white.opacity(0.7))
                .frame(width: 46, height: 64)
                .background(selected ? Color.white.opacity(0.16) : Color.white.opacity(0.06),
                            in: RoundedRectangle(cornerRadius: 10))
                .padding(.bottom, 16)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(choice.title)
        .accessibilityAddTraits(selected ? .isSelected : [])
    }
}

// Tezgahtaki kalem çizimi: üstte uç, altta gövde. Araç türüne göre biçim değişir.
struct PenIllustration: View {
    let pen: FavoritePen

    private var ink: Color { pen.swiftUIColor }

    private var bodyWidth: CGFloat {
        pen.choice == .highlighter ? 40 : 30
    }

    private var tipSize: CGSize {
        switch pen.choice {
        case .pencil: CGSize(width: 22, height: 26)
        case .highlighter: CGSize(width: 28, height: 18)
        default: CGSize(width: 14, height: 26)
        }
    }

    private var tipColor: Color {
        switch pen.choice {
        case .pencil: Color(red: 0.90, green: 0.78, blue: 0.60)
        case .highlighter: ink.opacity(0.65)
        default: Color(red: 0.79, green: 0.80, blue: 0.83)
        }
    }

    private var bodyColor: Color {
        switch pen.choice {
        case .pencil: ink
        case .highlighter: ink.opacity(0.8)
        default: Color(red: 0.23, green: 0.23, blue: 0.26)
        }
    }

    private var bandColor: Color {
        switch pen.choice {
        case .pencil: Color.clear
        case .highlighter: Color.white.opacity(0.35)
        default: ink
        }
    }

    var body: some View {
        VStack(spacing: 0) {
            PenTipShape()
                .fill(tipColor)
                .frame(width: tipSize.width, height: tipSize.height)
            RoundedRectangle(cornerRadius: 5)
                .fill(bodyColor)
                .overlay(alignment: .top) {
                    Rectangle()
                        .fill(bandColor)
                        .frame(height: 9)
                        .padding(.top, 12)
                }
                .overlay(alignment: .leading) {
                    Rectangle()
                        .fill(Color.white.opacity(0.14))
                        .frame(width: 5)
                        .padding(.vertical, 3)
                        .padding(.leading, 3)
                }
                .clipShape(RoundedRectangle(cornerRadius: 5))
                .frame(width: bodyWidth)
        }
        .shadow(color: .black.opacity(0.35), radius: 3, y: 2)
        .accessibilityHidden(true)
    }
}

private struct PenTipShape: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        path.move(to: CGPoint(x: rect.midX, y: rect.minY))
        path.addLine(to: CGPoint(x: rect.maxX, y: rect.maxY))
        path.addLine(to: CGPoint(x: rect.minX, y: rect.maxY))
        path.closeSubpath()
        return path
    }
}
