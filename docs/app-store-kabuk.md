# Not Defteri: App Store kabuğu

`web/` klasöründeki uygulama, Capacitor ile gerçek bir iPad uygulamasının **içine** paketleniyor.
Dosyalar uygulamayla birlikte gelir; internetten açılan bir site değildir (Apple kuralı 4.2).
Eski SwiftUI projesi (`Sources/`, `project.yml`, `build.yml`) ayrı duruyor, bununla ilgisi yok.

| Ne | Nerede |
| --- | --- |
| Kabuk ayarları (paket kimliği, ad) | `capacitor.config.json` |
| Sürüm numarası (App Store'da görünen) | `package.json` → `version` |
| Xcode projesi | `ios/App/App.xcodeproj` |
| Derleme ve TestFlight | `.github/workflows/ios-kabuk.yml` |

## Senin yapacakların

### 1. Paket kimliğini seç

Şu an yer tutucu: `com.example.notdefteri`. Kalıcı kimliği seçip bana söyle
(ör. `com.seninadin.notdefteri`). Uygulama App Store'a çıktıktan sonra **değiştirilemez**.
Değiştirmek için yalnız `capacitor.config.json` içindeki `appId` değişir, sonra `npm run cap:sync`.

### 2. Apple tarafında uygulamayı kaydet

1. [developer.apple.com](https://developer.apple.com/account) → **Certificates, Identifiers & Profiles** → **Identifiers** → **+**
   → **App IDs** → **App** → Açıklama: `Not Defteri`, Bundle ID: **Explicit**, seçtiğin kimlik → **Register**.
2. Aynı sayfada **Membership details** bölümündeki **Team ID**'yi not al (10 karakter, ör. `AB12CD34EF`).
3. [App Store Connect](https://appstoreconnect.apple.com) → **Uygulamalar** → **+** → **Yeni Uygulama**:
   platform iOS, ad `Not Defteri`, birincil dil Türkçe, paket kimliği az önce kaydettiğin, SKU `notdefteri`.

### 3. App Store Connect API anahtarı oluştur

1. App Store Connect → **Kullanıcılar ve Erişim** → **Entegrasyonlar** → **App Store Connect API** → **Ekip Anahtarları** → **+**.
2. Ad: `GitHub`, erişim: **Admin** (otomatik imzalama sertifikayı bulutta oluşturabilsin diye gerekli).
3. **İndir** → `AuthKey_XXXXXXXXXX.p8` dosyası. **Yalnız bir kez indirilebilir**, kaybetme.
4. Sayfadaki **Key ID** ve en üstteki **Issuer ID** değerlerini kopyala.

### 4. GitHub'a dört secret ekle

GitHub → `notdefteri` deposu → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**:

| Ad | Değer |
| --- | --- |
| `ASC_KEY_ID` | Key ID |
| `ASC_ISSUER_ID` | Issuer ID |
| `ASC_KEY_P8` | `.p8` dosyasını Not Defteri (Notepad) ile aç, `-----BEGIN PRIVATE KEY-----` ve `-----END PRIVATE KEY-----` satırları dahil **hepsini** yapıştır |
| `APPLE_TEAM_ID` | Team ID |

Apple ID şifren hiçbir yere girilmez; ne dosyaya, ne secret'a. Anahtar yeterli.
`.p8` dosyasını depoya koyma (`.gitignore` zaten engelliyor), secret'a ekledikten sonra güvenli bir yerde sakla.

### 5. TestFlight'a gönder

GitHub → **Actions** → **App Store kabuğu (Capacitor iOS)** → **Run workflow** → “TestFlight'a yükle” işaretli → **Run**.
Yaklaşık 15–25 dakika sonra derleme App Store Connect → **TestFlight** sekmesinde görünür (Apple önce işler).
iPad'e **TestFlight** uygulamasını kur, oradan Not Defteri'ni yükle.

Secret'lar yoksa iş akışı yalnız derlemeyi dener, yükleme adımını atlar.

## Notlarını web'den uygulamaya taşıma

Ana ekrandaki web uygulaması ile App Store uygulaması **ayrı depolama** kullanır; notlar kendiliğinden geçmez.

1. **Web uygulamasında**: Ayarlar → **Yedekle** → dosyayı Dosyalar'a (ya da iCloud Drive'a) kaydet.
2. **Yeni uygulamada**: Ayarlar → **Yedekten Geri Yükle** → o dosyayı seç.
3. Yeni uygulamada defterlerin hepsinin geldiğini, birkaç sayfayı açarak kontrol et.

> **Ana ekrandaki web uygulamasını SİLME.** Silersen içindeki notlar da gider.
> Taşıma bitip yeni uygulamada her şeyi gördükten sonra bile bir süre dursun; yedek dosyası da saklı kalsın.

## Geliştirme notları

- Web dosyaları değişince App Store uygulaması **kendiliğinden güncellenmez**: yeni derleme TestFlight'a gönderilip incelemeye yollanmalı. `web/sw.js` sürümü yalnız web'i etkiler.
- Uygulamada servis çalışanı kurulmaz (`web/js/app.js` → `webde()`); web davranışı aynı.
- Windows'ta: `npm ci` ve `npm run cap:sync` çalışır (web dosyalarını `ios/App/App/public` içine kopyalar; bu klasör depoya girmez). Derleme ve imzalama yalnız macOS'ta, yani CI'da.
- Derleme numarası GitHub çalıştırma numarasından gelir (`42.1` gibi); sürüm numarası `package.json` → `version`.
- Uygulama yalnız iPad (`TARGETED_DEVICE_FAMILY = 2`).
- İkon şimdilik 512 px'lik web ikonundan büyütüldü; mağazaya çıkmadan önce 1024×1024, saydamlıksız gerçek bir ikon konmalı (`ios/App/App/Assets.xcassets/AppIcon.appiconset`).
- Cihazda denenecekler: PDF şablonu açılıyor mu (`.mjs` modülü), Yedekle paylaşım sayfası açılıyor mu, çeviri çalışıyor mu (`capacitor://localhost` kaynağından Google çeviri isteği).
