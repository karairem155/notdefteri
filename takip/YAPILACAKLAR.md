# Not Defteri — yapılacaklar ve durum

Tek doğru kaynak bu dosya. `notdefteri-takipci` agent'ı her iş sonunda günceller; kullanıcının
her yeni isteği buraya **önce** yazılır, sonra yapılır.

Durum işaretleri:
- `[ ]` yapılacak
- `[~]` yapılıyor
- `[?]` kullanıcı kararı / bilgisi bekliyor (ne beklendiği yazılı)
- `[i]` canlıda, ama **iPad'de kullanıcı denemesi** bekliyor (bilgisayarda benzetimle doğrulandı)
- `[x]` bitti ve doğrulandı (sürüm numarasıyla)

Her satırın sonunda: istek tarihi, canlı sürüm (`vNNN`), varsa commit.
Canlı adres: https://karairem155.github.io/notdefteri/ — dal `master`.

---

## Kullanıcıdan cevap bekleyenler

- [?] **Blender raf görünümü**: gerçekçi mi, yumuşak mı, arası mı? Klasörde mevcut "pul" deseni kalsın mı? — `tasarim/blender/raf-denemesi.png` gönderildi (8 Kas). Klasör şekli onaylı: uygulamadaki yatay, sağ üstte çapraz dilli şekil (`web/js/folders.js`); dosya klasörü şekli REDDEDİLDİ.
- [?] **Kapak açılış sesi** (sayfa sesinden farklı): ElevenLabs ile üretim için açık izin bekleniyor (~30–40 kredi). İzinsiz üretme.
- [?] **Görsel kaydırırken altta çok sayıda gölge** (8 Kas): Safari gölge izi düzeltmesi v106'da yapıldı ama bilgisayarda üretilemedi. Kullanıcıdan: ekran kaydı + fotoğraf düzenleme modunda mı taşınıyordu, sayfa mı kaydırılıyordu.
- [?] **App Store yolu**: web'i paketleyen kabuk (öneri) mi, native'e taşıma mı? Eski Swift kodu `Sources/PencilPages` ayrıca duruyor. Fiyat önerisi: yıllık ₺499,99 / ömür boyu ₺999,99 / aylık ₺99,99. El yazısı OCR ücreti "app bitince konuşulacak".

## iPad'de denenmesi gerekenler (canlı)

- [i] Yazı hissi: stabilizatör seviyeleri artık farklı mı, yavaş yazarken harfler bozuluyor mu — v107 (8 Kas, "savsak yazıyormuşum gibi") — ea17bb3
- [i] Sayfa çevirme sesi kâğıt kalkarken mi geliyor — v106
- [i] Basılı tutunca Yapıştır — v106
- [i] Dolma, fırça, desen kalemleri; kendi fırçasını PNG'den ekleme — v102/v105
- [i] Sesle yaz (dikte, Türkçe) — v105 (gerçek mikrofonla denenmedi)
- [i] Sesle eşli not: kayıt sırasında yazılan çizgiye parmakla dokun → o an çalar — v101 (gerçek mikrofonla denenmedi)
- [i] Karalayarak silme hassasiyeti — v105 (kullanıcı "çok yoğun karalamada çalışıyor" demişti, gevşetildi)
- [i] Defterden çıkış animasyonu yarıda kalmıyor mu — v104 (önizleme paneli gizliyken akış izlenemedi)
- [i] Dikey iPad'de üst çubuk tek satır, yer işareti düğmesi — v105

## Yapılacaklar

### Rakip listesi — ilk dalgadan kalanlar
Kaynak: https://claude.ai/artifact/4DXNBCSUMUHur7nEssLmfY (150 madde; "eksik değil fazla olmalıyız")
- [ ] Sayfa ve defter arası bağlantılar
- [ ] Dikey sürekli kaydırma modu
- [ ] Defter kilidi (web'de yalnız gizlilik kapağı; gerçek Face ID kilidi native'de)
- [ ] Daire çizerek seçme: kalem aracındayken seçim aracına geçmeden, çevresini çizerek seçmek (Goodnotes'taki gibi). Ayrı kement aracı zaten var (editor.js, ink.js finishLasso); o yeniden yazılmayacak. Kalemi basılı tutmak şekil düzeltmeyi tetikliyor; seçme hareketi bununla çakışmamalı
- [ ] Lazer işaretçi
- [ ] Kesik ve noktalı çizgi
- [ ] Eğimle gölgeleyen kurşun kalem (PointerEvent altitudeAngle)

### Rakip listesi — kalan kolay/orta maddeler (seçme)
- [ ] Hazır şablon kitaplığı (Cornell, planlayıcı, alışkanlık)
- [ ] Nesne kilitleme, gruplama, aynalama
- [ ] Tablolar
- [ ] Yazdırma (sayfa aralığıyla dışa aktarma zaten var: Dışa Aktar > Sayfa Aralığı)
- [ ] Pomodoro / çalışma zamanlayıcısı
- [ ] Ses oynatma hızı (0,5×–2×)
- [ ] İç içe klasör
- [ ] Akıllı karanlık mod

### Yalnız native (App Store) sürümde
- [ ] Apple Pencil çift dokunma ve sıkma
- [ ] El yazısında arama ve el yazısını metne çevirme (Türkçe desteği önce cihazda doğrulanacak)
- [ ] Apple Translation (cihazda, ücretsiz çeviri) — web'de şimdilik MyMemory + Google yedek
- [ ] Gerçek defter kilidi (Face ID)

### Gerçekçilik (Blender) — yön onayından sonra
- [ ] Onaylanan seviyede katmanlı çıktı: beyaz kapak gölgelendirme + kapak UV/maske, uygulama kullanıcının kapak rengini/fotoğrafını birleştirir
- [ ] Klasör aynı yöntemle (onaylı şekil)
- [ ] Rafa entegrasyon ve performans (300 defterde de akıcı)

### App Store hazırlığı (en son)
- [ ] Kabuk/native kararı (kullanıcı)
- [ ] Satın alma (abonelik + ömür boyu), Small Business Program
- [ ] Gizlilik etiketleri (çeviri metni internete gidiyor — beyan edilmeli)
- [ ] Mağaza görselleri ve metni

---

## Bitti (özet)

Takip v86'dan (41ef65b, 29 Eki) başlar; öncesi (raf görünümü, sekmeler, maskot, masa denemeleri) git geçmişinde.

- [x] Marka: nötr gri masa, mat lacivert çubuk, pembe vurgu — v86
- [x] Geri tuşu açık klasöre dönüyor; açılışta beyaz ekran yok — v91 (5725da6)
- [x] 300 sayfalık PDF'te Sayfalar ekranı çökmüyor — v92 (23a265f)
- [x] Basılı tutunca düz çizgi (titreyen el) — v93, v107'de yazıyı bozmayacak şekilde daraltıldı
- [x] Sayfa sıralama (6'yı 7'ye taşıma) — v87 (375c42a)
- [x] Sayfa yelpazesi kaldırıldı — v88 (16dc75e)
- [x] ElevenLabs sayfa sesi (#1) — sayfa-cevir.mp3 — v89 (47fd880)
- [x] Fotoğraftan çıkartma yapma — v90 (e8f51c2)
- [x] İnce üst çubuk, odak modu, çubuk rengi (4 hazır + serbest) — v94
- [x] Kaldığın yerden devam: ince şerit, kapatılabilir; yedek hatırlatması da ince şerit — v95 → v104 (Son açılanlar satırı v95'te eklendi, v104'te kullanıcı "çok çirkin" deyince kaldırıldı)
- [x] PDF'te satıra hizalama aç/kapa, fosforlu kalınlık aralığı — v96
- [x] Anında çeviri (PDF seç / fosforlu), üst çubukta 文A — v97, v105
- [x] Defterde ara (⌘F), PDF içindekiler, klavye kısayolları — v98
- [x] Etiketler, kütüphanede içerik araması, okuma modu, seçici silgi — v99
- [x] Sürüm geçmişi, yedek hatırlatması; arka kapak görseli temizlikte silinmiyor — v100
- [x] Sesle eşli not — v101
- [x] Dolma ve fırça kalem — v102
- [x] Karalayarak silme — v103, v105
- [x] Defterden çıkış animasyonu — v104
- [x] Desen kalemi + fırça içe aktarma, sesle yaz, yer işareti (adsız, renk değişir), bölümlü menü, Tüm sayfalara uygula (şablon/renk), "İki sayfayı kapla", buzlu kalem kalem panelinde — v105
- [x] Sayfa sesi kâğıt kalkarken, basılı tut Yapıştır — v106
- [x] Stabilizatör zamana bağlı, harfler şekle dönmüyor — v107
- [x] Pinterest sayfa tasarımları sorusu cevaplandı (kişisel kullanım: Şablonlarım; dağıtım: kendi/AI tasarımı)
- [x] Pazar araştırması ve rakip açığı listesi (150 madde) — https://claude.ai/artifact/4DXNBCSUMUHur7nEssLmfY
