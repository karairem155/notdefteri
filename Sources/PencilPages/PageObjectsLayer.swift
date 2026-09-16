import SwiftUI
import UIKit

// Fotoğraf / çıkartma / bant / düz post-it katmanı (docs/tasarim/04-CiftSayfa.png).
// PencilKit tuvalinin ALTINDA durur; çizim bunların üstüne yapılır (post-it'in üstüne yazılabilir).
// Nesne düzenleme kipinde tuval dokunuşları bırakır, bu katman alır.
struct PageObjectsLayer: View {
    let objects: [PlacedObject]
    var pageWidth: CGFloat = NotebookPage.defaultSize.width
    @Binding var selectedID: UUID?
    let isEditing: Bool
    @ObservedObject var assets: AssetStore
    var onChange: (PlacedObject) -> Void
    var onRotate90: (UUID) -> Void
    var onDuplicate: (UUID) -> Void
    var onBringToFront: (UUID) -> Void
    var onDelete: (UUID) -> Void

    private var orderedObjects: [PlacedObject] {
        objects.sorted { $0.zIndex < $1.zIndex }
    }

    var body: some View {
        ZStack(alignment: .topLeading) {
            if isEditing {
                Color.clear
                    .contentShape(Rectangle())
                    .onTapGesture { selectedID = nil }
            }
            ForEach(orderedObjects) { object in
                TransformableItemView(
                    rect: object.rect,
                    rotation: object.rotation,
                    isSelected: selectedID == object.id,
                    isEditing: isEditing,
                    onSelect: { selectedID = object.id },
                    onTransform: { rect, rotation in
                        var updated = object
                        updated.rect = rect
                        updated.rotation = rotation
                        onChange(updated)
                    }
                ) {
                    PlacedObjectContent(
                        object: object,
                        image: object.kind == .postIt ? nil : assets.image(named: object.assetName)
                    )
                }
                .accessibilityLabel(object.kind.title)
            }
            if isEditing, let id = selectedID, let object = objects.first(where: { $0.id == id }) {
                ObjectActionMenu(
                    anchorRect: object.rect,
                    pageWidth: pageWidth,
                    onRotate90: { onRotate90(id) },
                    onDuplicate: { onDuplicate(id) },
                    onBringToFront: { onBringToFront(id) },
                    onDelete: {
                        selectedID = nil
                        onDelete(id)
                    }
                )
            }
        }
        .coordinateSpace(name: PageSpace.name)
    }
}

// Nesnenin görünüşü. Fotoğraf beyaz çerçeveli, çıkartma çıplak, bant yarı saydam, post-it renkli kağıt.
struct PlacedObjectContent: View {
    let object: PlacedObject
    let image: UIImage?

    var body: some View {
        switch object.kind {
        case .postIt:
            PostItPaper(tintHex: object.tintHex ?? "#FFE566")
        case .photo:
            picture
                .padding(6)
                .background(Color.white)
                .shadow(color: .black.opacity(0.25), radius: 6, y: 3)
        case .sticker:
            picture
                .shadow(color: .black.opacity(0.15), radius: 3, y: 1)
        case .tape:
            picture
                .opacity(0.9)
        }
    }

    @ViewBuilder
    private var picture: some View {
        if let image {
            Image(uiImage: image)
                .resizable()
                .scaledToFill()
                .clipped()
        } else {
            RoundedRectangle(cornerRadius: 6)
                .fill(Color.gray.opacity(0.25))
                .overlay(
                    Image(systemName: "photo")
                        .font(.title)
                        .foregroundStyle(.secondary)
                )
        }
    }
}

// Düz post-it kağıdı: hafif gradyan, altta kıvrık köşe gölgesi.
struct PostItPaper: View {
    let tintHex: String

    private var tint: Color {
        Color(UIColor(hexString: tintHex) ?? .systemYellow)
    }

    var body: some View {
        ZStack(alignment: .bottomTrailing) {
            Rectangle()
                .fill(LinearGradient(colors: [tint, tint.opacity(0.82)], startPoint: .topLeading, endPoint: .bottomTrailing))
            PostItCornerShape()
                .fill(Color.black.opacity(0.12))
                .frame(width: 26, height: 26)
        }
        .clipShape(RoundedRectangle(cornerRadius: 2))
        .shadow(color: .black.opacity(0.18), radius: 5, y: 3)
        .accessibilityHidden(true)
    }
}

private struct PostItCornerShape: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        path.move(to: CGPoint(x: rect.maxX, y: rect.minY))
        path.addLine(to: CGPoint(x: rect.maxX, y: rect.maxY))
        path.addLine(to: CGPoint(x: rect.minX, y: rect.maxY))
        path.closeSubpath()
        return path
    }
}
