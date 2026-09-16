# Not Defteri — kararlar ve ekran rehberi

Bu klasörü projenin içine `docs/tasarim/` olarak koy. Claude Code bir ekranı
yaparken önce buradaki kararı okusun, sonra o ekranın PNG'sine baksın.

---

## Uygulama neden var

CollaNote'ta aynı defterin içinde sayfa sayfa farklı şablon kullanılamıyor.
Bu uygulamanın var oluş sebebi bu: **her sayfa kendi şablonunu tutar.**
Bir sayfa bir tema, sonraki sayfa bambaşka bir tema olabilir ve şablonlar
kullanıcının kendi eklediği görsellerdir.

Kişisel kullanım için. App Store'a çıkmayacak, abonelik yok, sunucu yok,
her şey cihazda duruyor.

## Nasıl kurulacak (Mac yok)

1. Repo GitHub'da public duruyor.
2. Her push'ta GitHub'ın Mac sunucusu imzasız `.ipa` üretiyor
   (`.github/workflows/build.yml`).
3. Actions'tan indirilen dosya Windows'ta Sideloadly ile iPad'e kuruluyor.
4. Ücretsiz Apple hesabıyla imza 7 gün geçerli, Sideloadly otomatik yeniliyor.

Apple ID şifresi sadece kendi bilgisayarındaki Sideloadly'ye girilir. Repoya,
Actions'a, hiçbir dosyaya yazılmaz.

---

## Ekranlar

| Dosya | Ekran | Ne anlatıyor |
|---|---|---|
| `01-Main.png` | Kütüphane — liste | Sol tarafta defterler, sağda notlar ve arama. Klasik liste görünümü. |
| `02-DefterGorunumu.png` | Kütüphane — defter rafı | Aynı kütüphanenin kapaklı hâli. Üstteki iki düğmeyle liste/raf geçişi. Kapaklarda isim **yazmaz**, isim kapağın altındadır. |
| `03-KapakAcilis.png` | Kapak açılışı | Raftaki kapağa dokununca defter yerinde açılıyor, sonra çift sayfaya geçiyor. |
| `04-CiftSayfa.png` | Çift sayfa | Ana editör. Solda bir şablon, sağda başka şablon. Fotoğraf seçili hâlde: köşe tutamakları, döndürme kolu, üstünde döndür/kopyala/öne al/sil menüsü. |
| `05-NotEditoru.png` | Tek sayfa | Aynı editörün tek sayfalı hâli. Üstte Tek/Çift geçişi var. |
| `06-PDFNotu.png` | PDF üzerine not | PDF sayfası arkada, el yazısı ayrı katmanda üstünde. |
| `07-KalemPaneli.png` | Kalem paneli | Kaleme dokununca açılır. Kalınlık, renk, renk çemberi, "Favorilere ekle", favoriler şeridi, varsayılan kalem. |
| `08-CikartmaPaneli.png` | Çıkartma / post-it paneli | Sekmeler: çıkartmalar, post-it, bant, kendi çıkartmalarım. Düz ve buzlu post-it'ler. |
| `09-BuzluPostIt.png` | Buzlu post-it kullanımda | Sınav sayfası. Cevapların üstü buzlu post-it ile kapalı, biri açılmış. |
| `10-BuzluKalem.png` | Buzlu kalem | Post-it'ten farklı: kağıt yok. Yazının üstüne çekiyorsun, çektiğin yer buzlanıyor. |
| `11-SayfaEkle.png` | Sayfa ekle | Şablon kütüphanesi ve "kaçıncı sayfadan sonra" seçimi. |
| `12-Sayfalar.png` | Sayfalar | Defterin bütün sayfaları sırayla. Her biri farklı şablonda. Sürükle-sırala, uzun bas-şablon değiştir. |
| `13-Ayarlar.png` | Ayarlar | Şablonlar, kapak desenleri, renk paleti, varsayılan kalem, sayfa ayarları. |

---

## Özellik kararları

**Şablonlar sayfa bazında.** Defterin tek şablonu yok. `NotebookPage.paper`
uygulamayla gelen çizimler için; `NotebookPage.customTemplateID` kullanıcının
kendi eklediği görsel için. Görseller `Documents/templates/` içinde durur,
sayfa sadece kimliği tutar.

**Favori kalem = araç + renk + kalınlık.** Üçü birlikte kaydedilir, tek başına
renk değil. Varsayılan kalem de favorilerden biridir; yeni sayfada o seçili gelir.
Renkler hex olarak saklanır, yani palete istenen renk eklenebilir.

**İki ayrı gizleme aracı var, karıştırma:**
- *Buzlu post-it*: kağıdı olan, üstüne yazı yazılabilen bir nesne. Cevabın
  üstüne konur, altındaki yazı bulanık görünür.
- *Buzlu kalem*: kağıt yok. Yazının üstüne çekilir, çekilen bölge buzlanır.
  Şeridin kalınlığı ve bulanıklık miktarı ayarlanabilir.

İkisinde de dokununca açılır, tekrar dokununca kapanır. "Dokununca açılsın"
kapatılırsa kalıcı bulanık kalır. Sayfadan çıkıp dönünce hepsi tekrar kapanır.

**Fotoğraf ve çıkartmalar ayrı bir katman.** Çizimin parçası değiller; taşınır,
döndürülür, ölçeklenir, silinir. Çıkartma ve bant da aynı mekanizma — tek fark
hangi görsel olduğu.

**Katman sırası (alttan üste):** şablon → fotoğraf/çıkartma/bant →
PencilKit çizimi → örtüler (buzlu şerit / post-it).

**Ayarlardan değişecekler:** yeni şablon ekleme, kapak deseni, renk paleti,
varsayılan kalem, varsayılan sayfa boyutu, tek/çift görünüm, sadece Apple Pencil
ile yazma. Bunların hiçbiri kodda sabit olmayacak — amaç, günlük kullanımda
kodu hiç açmamak.

---

## Teknik kararlar

**Apple'ın hazır kalem paleti (PKToolPicker) kullanılmıyor.** Sebebi: Apple
ona kendi favorilerini eklemene izin vermiyor. Bu yüzden palet sıfırdan yazıldı —
tasarımdaki koyu araç tezgahı bu. Çizim motoru yine PencilKit, sadece hangi
aracın seçili olduğunu uygulama yönetiyor
(`canvas.tool = PKInkingTool(...)`).

**Görsel dil:** editör ekranları lacivert zeminde, defter masada duran gerçek
bir defter gibi; kağıtta ince doku, kenarda alttaki yapraklar, ortada cilt
gölgesi. Kütüphane tarafı açık renkli. Referans: Paper by WeTransfer.

**Kaydetme** `PencilCanvasView` içinde çözülmüş: çizim değişince 0.25 saniye
bekleyip kaydediyor, sayfadan çıkarken zorla kaydediyor. Dokunma.

**Buzlu efekt** için `.ultraThinMaterial` deneniyor. Tuvalin üstünde
beklendiği gibi bulanıklaştırmazsa yedek yöntem: o bölgeyi
`canvasView.drawing.image(from:scale:)` ile görsele çevirip `.blur(radius:)`
uygulamak.

**Temel proje** [Pencil Pages](https://github.com/FerrariF4O/pencil-pages),
MIT lisanslı. `LICENSE` dosyası repoda kalmalı.

---

## Yapılacaklar sırası

1. Proje hatasız derlensin.
2. Arayüz metinleri Türkçe.
3. Koyu araç tezgahı — `DrawingToolConfiguration`'a bağlı.
4. Kalem paneli + favoriler (`PenFavoritesStore`).
5. Kendi şablonların (`TemplateLibrary`) sayfa arka planına bağlansın.
6. Fotoğraf/çıkartma katmanı — sürükleme ve döndürme jestleri.
7. Buzlu örtüler (`CoverLayer`, tuvalin üstüne `.overlay`).
8. Çift sayfa görünümü.
9. Sayfalar ekranı — sürükle-sırala, şablon değiştir.
10. Ayarlar ekranı.
11. Kapak rafı ve açılış animasyonu.
12. PDF içe aktarma.

## Şimdilik yapılmayacaklar

El yazısı arama/OCR, cihazlar arası senkron, paylaşım, App Store.
Bunlar kişisel kullanım için gerekmiyor ve en çok zaman alan kısımlar.
