import Foundation
import CoreGraphics

// Sayfanın üstündeki katman.
//
// Sıralama (alttan üste):
//   1. şablon (PaperStyle veya kendi görselin)
//   2. yerleştirilen nesneler (fotoğraf, çıkartma, bant)
//   3. PencilKit çizimi
//   4. örtüler (buzlu şerit / post-it)
//
// Örtüler en üstte durur, çünkü işleri yazının üstünü kapatmak.

struct CoverMark: Codable, Identifiable, Equatable {
    enum Style: String, Codable {
        case frostedBand    // buzlu kalemle yazının üstüne çekilen şerit
        case postIt         // düz, altını hiç göstermeyen post-it
        case frostedPostIt  // buzlu post-it
    }

    var id: UUID
    var style: Style
    var rect: CGRect        // sayfa koordinatında (sayfanın sol üstü 0,0)
    var rotation: Double    // derece
    var tintHex: String     // "#FFF0B4"
    var tintOpacity: Double // 0...1
    var blurRadius: Double  // frosted için; postIt'te yok sayılır
    var revealOnTap: Bool   // false ise kalıcı kapalı

    init(id: UUID = UUID(),
         style: Style,
         rect: CGRect,
         rotation: Double = 0,
         tintHex: String = "#FFF0B4",
         tintOpacity: Double = 0.55,
         blurRadius: Double = 6,
         revealOnTap: Bool = true) {
        self.id = id
        self.style = style
        self.rect = rect
        self.rotation = rotation
        self.tintHex = tintHex
        self.tintOpacity = tintOpacity
        self.blurRadius = blurRadius
        self.revealOnTap = revealOnTap
    }
}

struct PlacedObject: Codable, Identifiable, Equatable {
    enum Kind: String, Codable { case photo, sticker, tape }

    var id: UUID
    var kind: Kind
    var assetName: String   // Documents/assets/ içindeki dosya adı
    var rect: CGRect
    var rotation: Double
    var zIndex: Int

    init(id: UUID = UUID(),
         kind: Kind,
         assetName: String,
         rect: CGRect,
         rotation: Double = 0,
         zIndex: Int = 0) {
        self.id = id
        self.kind = kind
        self.assetName = assetName
        self.rect = rect
        self.rotation = rotation
        self.zIndex = zIndex
    }
}

struct PageOverlayData: Codable, Equatable {
    var covers: [CoverMark] = []
    var objects: [PlacedObject] = []

    var isEmpty: Bool { covers.isEmpty && objects.isEmpty }
}
