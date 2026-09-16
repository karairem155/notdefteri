import SwiftUI

// Sayfa üstündeki nesnelerin ortak koordinat alanı. İki katman (fotoğraf/çıkartma ve örtüler)
// aynı 595×842 çerçeveye oturduğu için jest konumları aynı adla okunur.
enum PageSpace {
    static let name = "notdefteri.page"
}

// Taşınabilir / büyütülebilir / döndürülebilir sayfa nesnesi (docs/tasarim/04-CiftSayfa.png).
// Fotoğraf, çıkartma, bant, post-it ve buzlu örtüler bu bileşeni kullanır.
// Sürükle → taşı, köşe tutamağı → büyüt/küçült (merkez sabit), üstteki yuvarlak → döndür.
struct TransformableItemView<Content: View>: View {
    let rect: CGRect
    let rotation: Double
    let isSelected: Bool
    let isEditing: Bool
    var onSelect: () -> Void
    var onTransform: (CGRect, Double) -> Void
    @ViewBuilder let content: () -> Content

    @State private var dragOffset: CGSize = .zero
    @State private var liveScale: CGFloat = 1
    @State private var liveRotation: Double = 0

    private let accent = Color(red: 0.55, green: 0.50, blue: 0.95)
    private let handleSize: CGFloat = 16
    private let rotationStem: CGFloat = 34
    private let minimumSide: CGFloat = 24

    private var displayRect: CGRect {
        rect.offsetBy(dx: dragOffset.width, dy: dragOffset.height)
    }

    var body: some View {
        let width = max(displayRect.width * liveScale, minimumSide)
        let height = max(displayRect.height * liveScale, minimumSide)
        ZStack {
            content()
                .frame(width: width, height: height)
            if isSelected && isEditing {
                selectionFrame(width: width, height: height)
            }
        }
        .frame(width: width, height: height)
        .rotationEffect(.degrees(rotation + liveRotation))
        .position(x: displayRect.midX, y: displayRect.midY)
        .allowsHitTesting(isEditing)
        .gesture(moveGesture)
        .accessibilityAddTraits(isSelected ? .isSelected : [])
    }

    // MARK: - Seçim çerçevesi ve tutamaklar

    private func selectionFrame(width: CGFloat, height: CGFloat) -> some View {
        ZStack {
            Rectangle()
                .stroke(accent, lineWidth: 2)
                .frame(width: width, height: height)

            // Döndürme kolu: üst kenarın ortasından yukarı çıkan sap ve yuvarlak
            VStack(spacing: 0) {
                Circle()
                    .fill(Color.white)
                    .overlay(Circle().stroke(accent, lineWidth: 2))
                    .frame(width: 22, height: 22)
                    .gesture(rotationGesture)
                Rectangle()
                    .fill(accent)
                    .frame(width: 2, height: rotationStem - 22)
            }
            .offset(y: -(height / 2) - rotationStem / 2)
            .accessibilityLabel("Döndürme kolu")

            // Köşe tutamakları
            ForEach(Corner.allCases, id: \.self) { corner in
                RoundedRectangle(cornerRadius: 3)
                    .fill(Color.white)
                    .overlay(RoundedRectangle(cornerRadius: 3).stroke(accent, lineWidth: 2))
                    .frame(width: handleSize, height: handleSize)
                    .offset(x: corner.x * width / 2, y: corner.y * height / 2)
                    .gesture(resizeGesture)
                    .accessibilityLabel("Boyut tutamağı")
            }
        }
    }

    private enum Corner: CaseIterable {
        case topLeft, topRight, bottomLeft, bottomRight

        var x: CGFloat {
            switch self {
            case .topLeft, .bottomLeft: -1
            case .topRight, .bottomRight: 1
            }
        }

        var y: CGFloat {
            switch self {
            case .topLeft, .topRight: -1
            case .bottomLeft, .bottomRight: 1
            }
        }
    }

    // MARK: - Jestler (hepsi sayfa koordinatında)

    private var moveGesture: some Gesture {
        DragGesture(minimumDistance: 0, coordinateSpace: .named(PageSpace.name))
            .onChanged { value in
                if !isSelected { onSelect() }
                dragOffset = value.translation
            }
            .onEnded { value in
                dragOffset = .zero
                guard value.translation != .zero else { return }
                onTransform(rect.offsetBy(dx: value.translation.width, dy: value.translation.height), rotation)
            }
    }

    private var resizeGesture: some Gesture {
        DragGesture(minimumDistance: 1, coordinateSpace: .named(PageSpace.name))
            .onChanged { value in
                liveScale = scaleFactor(from: value.startLocation, to: value.location)
            }
            .onEnded { value in
                let factor = scaleFactor(from: value.startLocation, to: value.location)
                liveScale = 1
                let newWidth = max(rect.width * factor, minimumSide)
                let newHeight = max(rect.height * factor, minimumSide)
                let resized = CGRect(
                    x: rect.midX - newWidth / 2,
                    y: rect.midY - newHeight / 2,
                    width: newWidth,
                    height: newHeight
                )
                onTransform(resized, rotation)
            }
    }

    private var rotationGesture: some Gesture {
        DragGesture(minimumDistance: 1, coordinateSpace: .named(PageSpace.name))
            .onChanged { value in
                liveRotation = angleDelta(from: value.startLocation, to: value.location)
            }
            .onEnded { value in
                let delta = angleDelta(from: value.startLocation, to: value.location)
                liveRotation = 0
                onTransform(rect, rotation + delta)
            }
    }

    /// Nesnenin merkezine olan uzaklığın oranı; merkez sabit kalır, boyut oranla değişir.
    private func scaleFactor(from start: CGPoint, to end: CGPoint) -> CGFloat {
        let c = CGPoint(x: rect.midX, y: rect.midY)
        let startDistance = max(hypot(start.x - c.x, start.y - c.y), 1)
        let endDistance = max(hypot(end.x - c.x, end.y - c.y), 1)
        return max(endDistance / startDistance, 0.1)
    }

    /// Merkeze göre parmağın açısındaki değişim, derece olarak.
    private func angleDelta(from start: CGPoint, to end: CGPoint) -> Double {
        let c = CGPoint(x: rect.midX, y: rect.midY)
        let startAngle = atan2(start.y - c.y, start.x - c.x)
        let endAngle = atan2(end.y - c.y, end.x - c.x)
        return Double(endAngle - startAngle) * 180 / .pi
    }
}

// Seçili nesnenin üstünde çıkan menü: Döndür / Kopyala / Öne al / Sil.
struct ObjectActionMenu: View {
    let anchorRect: CGRect
    var onRotate90: () -> Void
    var onDuplicate: () -> Void
    var onBringToFront: () -> Void
    var onDelete: () -> Void

    var body: some View {
        HStack(spacing: 0) {
            menuButton("Döndür", symbol: "rotate.right", action: onRotate90)
            divider
            menuButton("Kopyala", symbol: "doc.on.doc", action: onDuplicate)
            divider
            menuButton("Öne al", symbol: "square.2.layers.3d.top.filled", action: onBringToFront)
            divider
            menuButton("Sil", symbol: "trash", tint: Color(red: 0.95, green: 0.45, blue: 0.40), action: onDelete)
        }
        .padding(.horizontal, 6)
        .padding(.vertical, 4)
        .background(Color(red: 0.12, green: 0.12, blue: 0.14).opacity(0.94), in: RoundedRectangle(cornerRadius: 12))
        .shadow(color: .black.opacity(0.3), radius: 8, y: 3)
        .position(x: min(max(anchorRect.midX, 150), 445), y: max(anchorRect.minY - 46, 26))
        .transition(.opacity)
    }

    private var divider: some View {
        Rectangle()
            .fill(Color.white.opacity(0.15))
            .frame(width: 1, height: 20)
    }

    private func menuButton(_ title: String, symbol: String, tint: Color = .white, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Label(title, systemImage: symbol)
                .font(.system(size: 14, weight: .medium))
                .foregroundStyle(tint)
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
        }
        .buttonStyle(.plain)
    }
}
