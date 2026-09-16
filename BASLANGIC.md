# Not Defteri — başlangıç projesi

Bu klasör, uygulamanın çalışan bir iskeleti. Sıfırdan başlamıyorsun.

## Nereden geldi

Temeli [Pencil Pages](https://github.com/FerrariF4O/pencil-pages) projesi — MIT lisanslı,
açık kaynak bir iPad defter uygulaması. Onu seçmemin sebebi tam senin durumuna göre
yazılmış olması: Mac'siz, Windows'tan iPad'e kurulacak şekilde kurgulanmış.
Orijinal lisans dosyası `LICENSE` olarak duruyor, kaldırma.

## En önemli kısım: Mac olmadan gerçek uygulama

Daha önce "ana ekrana ayrı ikon için Mac ya da yıllık ücret lazım" demiştim.
Bu proje üçüncü bir yol gösteriyor ve ücretsiz:

1. Bu klasörü kendi GitHub hesabına yükle (public repo).
2. Her yüklemede GitHub kendi Mac sunucusunda uygulamayı derliyor
   (`.github/workflows/build.yml`). Senin bilgisayarında Mac olması gerekmiyor.
3. Actions sekmesinden `NotDefteri-unsigned.ipa` dosyasını indir.
4. Windows'ta [Sideloadly](https://sideloadly.io/) kurup iPad'i USB ile bağla,
   kendi Apple ID'nle imzalayıp kur.
5. iPad'de **Ayarlar → Gizlilik ve Güvenlik → Geliştirici Modu** açık olmalı.

Sonuç: ana ekranda kendi ikonu olan gerçek bir uygulama. Tek şart, ücretsiz
Apple hesabıyla imza 7 gün geçerli — Sideloadly'nin otomatik yenileme özelliğini
açık bırak, iPad ile bilgisayar aynı ağdayken kendi yeniliyor.

Apple ID şifreni sadece kendi bilgisayarındaki Sideloadly'ye yaz. GitHub'a, bu
klasöre, hiçbir dosyaya yazma.

## Ben ne değiştirdim

**Uygulama kimliği**

- Görünen ad: "Not Defteri"
- Bundle kimliği: `com.notdefteri.app` (`project.yml` ve `build.yml` içinde)

**Yeni dosyalar** (`Sources/PencilPages/`)

| Dosya | Ne işe yarıyor |
|---|---|
| `FavoritePens.swift` | Favori kalemler: araç + renk + kalınlık üçlüsünü kaydeder, varsayılan kalemi tutar. Renkler hex olarak saklanıyor, yani palete istediğin rengi ekleyebilirsin. |
| `CustomTemplate.swift` | Kendi eklediğin sayfa şablonları. Görseli `Documents/templates/` içine kopyalar, sayfa sadece kimliğini tutar. |
| `PageOverlays.swift` | Sayfanın üstündeki katman: fotoğraf, çıkartma, bant ve örtüler (buzlu şerit / post-it). |
| `FrostedCoverView.swift` | Buzlu örtünün kendisi. `.ultraThinMaterial` ile arkasındaki yazıyı bulanıklaştırıyor, dokununca açılıyor. |

**Değişen dosya**

- `NotebookModels.swift` → `NotebookPage`'e iki alan eklendi: `customTemplateID` ve
  `overlay`. İkisi de opsiyonel, yani eski kayıtlar bozulmadan açılır.

## Hazır gelen ve işine yarayan şeyler

- **Her sayfa kendi şablonunu tutuyor.** `NotebookPage.paper` zaten sayfa
  bazında — CollaNote'ta bulamadığın şey burada en baştan doğru kurulmuş.
- **Kendi kalem yönetimi var.** `DrawingToolChoice` + `DrawingToolConfiguration`,
  Apple'ın hazır paletini kullanmıyor, aracı kendisi kuruyor. Favoriler için
  gereken temel bu.
- **Kaydetme çözülmüş.** `PencilCanvasView` çizim değişince 0.25 saniye bekleyip
  kaydediyor, sayfadan çıkarken zorla kaydediyor.
- **Geri al / ileri al** hazır.
- **Sayfa ekleme, çoğaltma, sıra değiştirme** `NotebookStore` içinde hazır.

## Claude Code'a sırayla yaptıracakların

1. `xcodegen` çalıştırıp projeyi bir kere derlet, hatasız açıldığını gör.
2. Arayüz metinlerini Türkçeleştir (`LibraryView`, `NotebookEditorView`).
3. Tasarımdaki koyu araç tezgahını kur, `DrawingToolConfiguration`'a bağla.
4. Kalem panelini ve favorileri `PenFavoritesStore` üzerinden bağla.
5. Kendi şablonlarını `TemplateLibrary` ile sayfa arka planına bağla
   (`PaperBackgroundView`'a görsel desteği ekle).
6. Fotoğraf/çıkartma katmanı: `PlacedObject` listesini tuvalin ALTINA çiz,
   sürükleme ve döndürme jestlerini yaz.
7. Buzlu örtüler: `CoverLayer`'ı tuvalin ÜSTÜNE `.overlay` olarak koy.
8. Çift sayfa görünümü, kapak rafı ve ayarlar ekranı.

## Bilmen gereken iki uyarı

Bu kodu burada derleyemedim — bu ortamda Swift derleyicisi yok. Yazdığım dosyalar
dikkatli yazıldı ama ilk derlemede hata çıkabilir; Claude Code bilgisayarında
derleyip düzeltecek. Beklenen bir şey, korkma.

`.ultraThinMaterial`, PencilKit tuvalinin üstünde beklediğin gibi bulanıklaştırmazsa
yedek yöntem şu: o bölgeyi `canvasView.drawing.image(from:scale:)` ile görsele çevirip
`.blur(radius:)` uygulamak. İkisinden biri mutlaka çalışır.
