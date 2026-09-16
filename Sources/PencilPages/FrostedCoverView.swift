import SwiftUI
import UIKit

// Buzlu örtü. Yazının üstünde durur, dokununca açılır, tekrar dokununca kapanır.
//
// .ultraThinMaterial arkasındaki her şeyi bulanıklaştırır — sayfanın şablonunu da,
// PencilKit çizimini de. Yazının şekli seçilir ama okunmaz; istenen tam olarak bu.

struct FrostedCoverView: View {
    let cover: CoverMark
    @Binding var revealedIDs: Set<UUID>

    private var isRevealed: Bool { revealedIDs.contains(cover.id) }

    var body: some View {
        ZStack {
            if cover.style == .postIt {
                Rectangle()
                    .fill(Color(UIColor(hexString: cover.tintHex) ?? .systemYellow))
            } else {
                Rectangle()
                    .fill(.ultraThinMaterial)
                    .overlay(
                        Color(UIColor(hexString: cover.tintHex) ?? .systemYellow)
                            .opacity(cover.tintOpacity)
                    )
            }
        }
        .frame(width: cover.rect.width, height: cover.rect.height)
        .clipShape(RoundedRectangle(cornerRadius: cover.style == .frostedBand ? 10 : 3))
        .shadow(color: .black.opacity(cover.style == .frostedBand ? 0.08 : 0.2),
                radius: cover.style == .frostedBand ? 1 : 4,
                x: 0,
                y: cover.style == .frostedBand ? 0 : 2)
        .opacity(isRevealed ? 0 : 1)
        .animation(.easeInOut(duration: 0.18), value: isRevealed)
        .rotationEffect(.degrees(cover.rotation))
        .position(x: cover.rect.midX, y: cover.rect.midY)
        .contentShape(Rectangle())
        .onTapGesture {
            guard cover.revealOnTap else { return }
            if isRevealed {
                revealedIDs.remove(cover.id)
            } else {
                revealedIDs.insert(cover.id)
            }
        }
        .accessibilityLabel(isRevealed ? "Cevap açık" : "Cevap gizli, açmak için dokun")
    }
}

// Sayfadaki bütün örtüleri çizen katman.
// PencilKit tuvalinin ÜSTÜNE, .overlay olarak koy.
struct CoverLayer: View {
    let covers: [CoverMark]
    @State private var revealedIDs: Set<UUID> = []

    var body: some View {
        ZStack(alignment: .topLeading) {
            ForEach(covers) { cover in
                FrostedCoverView(cover: cover, revealedIDs: $revealedIDs)
            }
        }
        .allowsHitTesting(true)
        .onDisappear { revealedIDs.removeAll() }   // sayfadan çıkınca hepsi kapanır
    }
}
