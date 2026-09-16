import Foundation
import SwiftUI
import UIKit

// Kalem paneli (docs/tasarim/07-KalemPaneli.png).
// Tezgahta seçili kaleme tekrar dokununca açılır.
// Araç türü, kalınlık, renk, renk çemberi, "Favorilere ekle", favoriler, varsayılan kalem.
struct PenPanelView: View {
    @ObservedObject var pens: PenFavoritesStore
    @Binding var configuration: DrawingToolConfiguration

    @State private var wheelColor: Color = .black
    @State private var newFavoriteName = ""
    @State private var showingNameAlert = false

    private let panelColor = Color(red: 0.13, green: 0.12, blue: 0.17)
    private let accent = Color(red: 0.55, green: 0.50, blue: 0.95)

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            header
            thicknessRow
            colorRow
            Rectangle()
                .fill(Color.white.opacity(0.08))
                .frame(height: 1)
            favoritesSection
            defaultPenRow
        }
        .padding(22)
        .frame(width: 580)
        .background(panelColor)
        .presentationBackground(panelColor)
        .onAppear {
            wheelColor = configuration.color
        }
        .onChange(of: wheelColor) { _, color in
            let hex = UIColor(color).hexString
            if hex.caseInsensitiveCompare(configuration.colorHex) != .orderedSame {
                configuration.colorHex = hex
            }
        }
        .alert("Favori adı", isPresented: $showingNameAlert) {
            TextField("Örn. Kırmızı kalem", text: $newFavoriteName)
            Button("Ekle") { addFavorite() }
            Button("Vazgeç", role: .cancel) { newFavoriteName = "" }
        } message: {
            Text("Seçili araç, renk ve kalınlık birlikte kaydedilir.")
        }
    }

    private var header: some View {
        HStack {
            Picker("Araç", selection: $configuration.choice) {
                ForEach(DrawingToolChoice.inkingChoices) { choice in
                    Text(choice.title).tag(choice)
                }
            }
            .pickerStyle(.segmented)
            .frame(maxWidth: 320)

            Spacer()

            Button {
                newFavoriteName = suggestedName
                showingNameAlert = true
            } label: {
                Label("Favorilere ekle", systemImage: "heart.fill")
                    .font(.subheadline.weight(.semibold))
            }
            .buttonStyle(.borderedProminent)
            .tint(accent)
        }
    }

    private var thicknessRow: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 14) {
                Text("Kalınlık")
                    .frame(width: 70, alignment: .leading)
                Slider(value: $configuration.width, in: 1...24, step: 0.5)
                    .tint(accent)
                Text("\(Self.format(configuration.width)) pt")
                    .monospacedDigit()
                    .frame(width: 52, alignment: .trailing)
            }
            Capsule()
                .fill(configuration.color)
                .frame(height: max(2, min(configuration.width, 24)))
                .padding(.leading, 84)
                .padding(.trailing, 66)
        }
        .foregroundStyle(Color.white.opacity(0.85))
    }

    private var colorRow: some View {
        HStack(spacing: 14) {
            Text("Renk")
                .frame(width: 70, alignment: .leading)
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 14) {
                    ForEach(pens.palette, id: \.self) { hex in
                        let selected = hex.caseInsensitiveCompare(configuration.colorHex) == .orderedSame
                        Button {
                            configuration.colorHex = hex
                            wheelColor = Color(UIColor(hexString: hex) ?? .black)
                        } label: {
                            Circle()
                                .fill(Color(UIColor(hexString: hex) ?? .black))
                                .frame(width: 34, height: 34)
                                .overlay(Circle().stroke(Color.white.opacity(0.2), lineWidth: 1))
                                .padding(3)
                                .overlay(Circle().stroke(selected ? Color.white : Color.clear, lineWidth: 2.5))
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("Renk \(hex)")
                        .accessibilityAddTraits(selected ? .isSelected : [])
                    }
                }
            }
            ColorPicker("Renk çemberi", selection: $wheelColor, supportsOpacity: false)
                .labelsHidden()
        }
        .foregroundStyle(Color.white.opacity(0.85))
    }

    private var favoritesSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Favorilerim")
                    .font(.headline)
                    .foregroundStyle(.white)
                Spacer()
                Text("Basılı tut: varsayılan yap")
                    .font(.footnote)
                    .foregroundStyle(Color.white.opacity(0.5))
            }
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 96), spacing: 12)], spacing: 12) {
                ForEach(pens.favorites) { pen in
                    FavoritePenCell(pen: pen,
                                    isSelected: configuration.matches(pen),
                                    isDefault: pens.defaultPenID == pen.id,
                                    accent: accent)
                        .onTapGesture {
                            configuration = DrawingToolConfiguration(favorite: pen)
                            wheelColor = pen.swiftUIColor
                        }
                        .onLongPressGesture {
                            pens.makeDefault(pen.id)
                        }
                        .contextMenu {
                            Button("Varsayılan yap", systemImage: "star") {
                                pens.makeDefault(pen.id)
                            }
                            Button("Sil", systemImage: "trash", role: .destructive) {
                                pens.remove(pen.id)
                            }
                            .disabled(pens.favorites.count <= 1)
                        }
                }
                Button {
                    newFavoriteName = suggestedName
                    showingNameAlert = true
                } label: {
                    VStack(spacing: 6) {
                        Image(systemName: "plus")
                            .font(.title2)
                        Text("Ekle")
                            .font(.caption)
                    }
                    .frame(maxWidth: .infinity, minHeight: 104)
                    .foregroundStyle(accent)
                    .overlay(
                        RoundedRectangle(cornerRadius: 12)
                            .strokeBorder(style: StrokeStyle(lineWidth: 1, dash: [5, 4]))
                            .foregroundStyle(Color.white.opacity(0.3))
                    )
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Yeni favori ekle")
            }
        }
    }

    private var defaultPenRow: some View {
        HStack {
            VStack(alignment: .leading, spacing: 3) {
                Text("Varsayılan kalemim")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.white)
                Text("Yeni sayfa açınca bu seçili gelir")
                    .font(.caption)
                    .foregroundStyle(Color.white.opacity(0.5))
            }
            Spacer()
            if let pen = pens.defaultPen {
                Circle()
                    .fill(pen.swiftUIColor)
                    .frame(width: 22, height: 22)
                    .overlay(Circle().stroke(Color.white.opacity(0.3), lineWidth: 1))
                Text("\(pen.name) · \(Self.format(CGFloat(pen.width))) pt")
                    .foregroundStyle(Color.white.opacity(0.85))
            }
        }
        .padding(14)
        .background(Color.white.opacity(0.06), in: RoundedRectangle(cornerRadius: 12))
    }

    private var suggestedName: String {
        "\(configuration.choice.title) \(Self.format(configuration.width)) pt"
    }

    private func addFavorite() {
        let name = newFavoriteName.trimmingCharacters(in: .whitespacesAndNewlines)
        pens.add(FavoritePen(configuration: configuration, name: name.isEmpty ? suggestedName : name))
        newFavoriteName = ""
    }

    static func format(_ width: CGFloat) -> String {
        if width.rounded() == width {
            return String(Int(width))
        }
        return String(format: "%.1f", Double(width))
    }
}

private struct FavoritePenCell: View {
    let pen: FavoritePen
    let isSelected: Bool
    let isDefault: Bool
    let accent: Color

    var body: some View {
        VStack(spacing: 8) {
            Circle()
                .fill(pen.swiftUIColor)
                .frame(width: 34, height: 34)
                .overlay(Circle().stroke(Color.white.opacity(0.2), lineWidth: 1))
            Capsule()
                .fill(pen.swiftUIColor)
                .frame(width: 56, height: max(2, min(CGFloat(pen.width), 14)))
            Text(pen.name)
                .font(.caption)
                .lineLimit(1)
                .foregroundStyle(Color.white.opacity(0.85))
        }
        .frame(maxWidth: .infinity, minHeight: 104)
        .background(isSelected ? Color.white.opacity(0.08) : Color.clear, in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(isSelected ? accent : Color.clear, lineWidth: 1.5))
        .overlay(alignment: .topTrailing) {
            if isDefault {
                Image(systemName: "star.fill")
                    .font(.caption2)
                    .foregroundStyle(accent)
                    .padding(6)
            }
        }
        .contentShape(RoundedRectangle(cornerRadius: 12))
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(pen.name), \(pen.choice.title)\(isDefault ? ", varsayılan" : "")")
    }
}
