import SwiftUI
import UIKit

// Buzlu örtünün görünüşü (docs/tasarim/09-BuzluPostIt.png, 10-BuzluKalem.png).
//
// Bulanıklık, sistem malzemesiyle sağlanır: arkasındaki her şeyi (şablonu da, çizimi de)
// bulanıklaştırır. Yazının şekli seçilir ama okunmaz; istenen tam olarak bu.
// `blurRadius` dört kademeye çevrilir: ultra ince → ince → normal → kalın malzeme.
struct CoverAppearance: View {
    let cover: CoverMark

    private var tint: Color {
        Color(UIColor(hexString: cover.tintHex) ?? .systemYellow)
    }

    private var cornerRadius: CGFloat {
        cover.style == .frostedBand ? min(12, cover.rect.height / 2) : 3
    }

    private var material: Material {
        switch cover.blurRadius {
        case ..<3: .ultraThinMaterial
        case ..<6: .thinMaterial
        case ..<9: .regularMaterial
        default: .thickMaterial
        }
    }

    var body: some View {
        ZStack {
            if cover.style == .postIt {
                Rectangle()
                    .fill(tint)
            } else {
                Rectangle()
                    .fill(material)
                    .overlay(tint.opacity(cover.tintOpacity))
            }
        }
        .clipShape(RoundedRectangle(cornerRadius: cornerRadius))
        .shadow(color: .black.opacity(cover.style == .frostedBand ? 0.08 : 0.2),
                radius: cover.style == .frostedBand ? 1 : 4,
                x: 0,
                y: cover.style == .frostedBand ? 0 : 2)
        .accessibilityHidden(true)
    }
}

// Normal kipte örtü: dokununca açılır, tekrar dokununca kapanır.
// Dokunma alanı örtünün kendi çerçevesi kadardır (position'dan ÖNCE verilir).
struct FrostedCoverView: View {
    let cover: CoverMark
    @Binding var revealedIDs: Set<UUID>

    private var isRevealed: Bool { revealedIDs.contains(cover.id) }

    var body: some View {
        CoverAppearance(cover: cover)
            .frame(width: cover.rect.width, height: cover.rect.height)
            .contentShape(Rectangle())
            .onTapGesture {
                guard cover.revealOnTap else { return }
                if isRevealed {
                    revealedIDs.remove(cover.id)
                } else {
                    revealedIDs.insert(cover.id)
                }
            }
            .opacity(isRevealed ? 0 : 1)
            .animation(.easeInOut(duration: 0.18), value: isRevealed)
            .rotationEffect(.degrees(cover.rotation))
            .position(x: cover.rect.midX, y: cover.rect.midY)
            .accessibilityLabel(isRevealed ? "Cevap açık" : "Cevap gizli, açmak için dokun")
            .accessibilityAddTraits(.isButton)
    }
}
