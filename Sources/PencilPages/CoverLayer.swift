import SwiftUI

// Buzlu kalem ayarları (docs/tasarim/10-BuzluKalem.png). Editörde AppStorage ile saklanır.
struct FrostedPenSettings: Equatable {
    var blurLevel: Double     // 1...12, dört malzeme kademesine çevrilir
    var thickness: Double     // şerit kalınlığı, punto
    var revealOnTap: Bool
}

// Örtü katmanı: PencilKit tuvalinin ÜSTÜNDE durur.
// - Normal kipte: örtüye dokununca açılır/kapanır, boş alan tuvale geçer.
// - Buzlu kalem seçiliyken: sayfada çekilen her çizgi bir buzlu şerit olur.
// - Nesne düzenleme kipinde: örtüler taşınır, büyütülür, döndürülür.
struct CoverLayer: View {
    let covers: [CoverMark]
    var pageWidth: CGFloat = NotebookPage.defaultSize.width
    let isEditing: Bool
    let isFrostedPenActive: Bool
    let frostedSettings: FrostedPenSettings
    @Binding var selectedID: UUID?
    var onTransform: (UUID, CGRect, Double) -> Void
    var onAddCover: (CoverMark) -> Void
    var onRotate90: (UUID) -> Void
    var onDuplicate: (UUID) -> Void
    var onBringToFront: (UUID) -> Void
    var onDelete: (UUID) -> Void

    @State private var revealedIDs: Set<UUID> = []
    @State private var liveBand: CoverMark?

    var body: some View {
        ZStack(alignment: .topLeading) {
            if isFrostedPenActive {
                Color.clear
                    .contentShape(Rectangle())
                    .gesture(bandGesture)
            } else if isEditing {
                Color.clear
                    .contentShape(Rectangle())
                    .onTapGesture { selectedID = nil }
            }
            ForEach(covers) { cover in
                if isEditing {
                    TransformableItemView(
                        rect: cover.rect,
                        rotation: cover.rotation,
                        isSelected: selectedID == cover.id,
                        isEditing: true,
                        onSelect: { selectedID = cover.id },
                        onTransform: { rect, rotation in onTransform(cover.id, rect, rotation) }
                    ) {
                        CoverAppearance(cover: cover)
                    }
                    .accessibilityLabel(cover.style == .frostedBand ? "Buzlu şerit" : "Buzlu post-it")
                } else {
                    FrostedCoverView(cover: cover, revealedIDs: $revealedIDs)
                }
            }
            if let liveBand {
                CoverAppearance(cover: liveBand)
                    .frame(width: liveBand.rect.width, height: liveBand.rect.height)
                    .rotationEffect(.degrees(liveBand.rotation))
                    .position(x: liveBand.rect.midX, y: liveBand.rect.midY)
                    .allowsHitTesting(false)
            }
            if isEditing, let id = selectedID, let cover = covers.first(where: { $0.id == id }) {
                ObjectActionMenu(
                    anchorRect: cover.rect,
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
        .onDisappear { revealedIDs.removeAll() }   // sayfadan çıkınca hepsi kapanır
    }

    private var bandGesture: some Gesture {
        DragGesture(minimumDistance: 4, coordinateSpace: .named(PageSpace.name))
            .onChanged { value in
                liveBand = makeBand(from: value.startLocation, to: value.location)
            }
            .onEnded { value in
                liveBand = nil
                if let band = makeBand(from: value.startLocation, to: value.location) {
                    onAddCover(band)
                }
            }
    }

    /// Başlangıçtan bitişe çekilen çizgiyi, o çizgi boyunca uzanan döndürülmüş bir şerit yapar.
    private func makeBand(from start: CGPoint, to end: CGPoint) -> CoverMark? {
        let dx = end.x - start.x
        let dy = end.y - start.y
        let length = hypot(dx, dy)
        guard length >= 8 else { return nil }
        let thickness = CGFloat(frostedSettings.thickness)
        let mid = CGPoint(x: (start.x + end.x) / 2, y: (start.y + end.y) / 2)
        let rect = CGRect(
            x: mid.x - (length + thickness) / 2,
            y: mid.y - thickness / 2,
            width: length + thickness,
            height: thickness
        )
        let angle = Double(atan2(dy, dx)) * 180 / .pi
        return CoverMark(
            style: .frostedBand,
            rect: rect,
            rotation: angle,
            tintHex: "#E9EDF3",
            tintOpacity: 0.45,
            blurRadius: frostedSettings.blurLevel,
            revealOnTap: frostedSettings.revealOnTap
        )
    }
}
