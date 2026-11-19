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

- [?] **Blender defter görünümü**: gerçekçi mi, yumuşak mı, arası mı? — `tasarim/blender/raf-denemesi.png` gönderildi (8 Kas). 13 Kas'ta kullanıcı yalnız klasör için yeni referans verdi (aşağıda "Yapılıyor"); defter kararı hâlâ açık. 18 Kas: B ile uyumlu defter için **cam kapak** seçildi (aşağıda) → bu soru **askıda**; cam kapak "şimdilik" olduğu için kapatılmadı.
- [?] **Görsel kaydırırken altta çok sayıda gölge** (8 Kas): Safari gölge izi düzeltmesi v106'da yapıldı ama bilgisayarda üretilemedi. 13 Kas: kullanıcı v106'dan sonra hâlâ çıktığını söyledi ("evet") → **v106 düzeltmesi işe yaramadı**. Bekleniyor: ekran kaydı + fotoğraf düzenleme modunda mı taşınıyordu, sayfa mı kaydırılıyordu.
- [?] **App Store yolu**: web'i paketleyen kabuk (öneri) mi, native'e taşıma mı? Eski Swift kodu `Sources/PencilPages` ayrıca duruyor. Fiyat önerisi: yıllık ₺499,99 / ömür boyu ₺999,99 / aylık ₺99,99. El yazısı OCR ücreti "app bitince konuşulacak". 13 Kas: kullanıcı "bakıcam" dedi — kendisi inceleyecek, acele ettirme.

- [?] **Kapak açılış sesi** (sayfa sesinden farklı): ElevenLabs izni verildi ("evet", 13 Kas; ~30–40 kredi). 13 Kas: 3 deneme gönderildi — `tasarim/ses/kapak-1-hazir.mp3`, `kapak-2-hazir.mp3`, `kapak-3-hazir.mp3` (36 kredi). Bekleniyor: hangisi (ya da hiçbiri).
- [?] **Klasör yelpazesi B'ye de eklensin mi?** (13 Kas) — denemede yelpaze yalnız C'de gösterildi; B seçildi ama yelpaze için cevap yok.
- [?] **Genel arayüz daha sade olabilir** — kullanıcı bakacak, acele ettirme (18 Kas, "tasarımlarımız genel arayüz içime sinmiyor onu belki değiştirip daha sade yaparız bakacağım").

## Yapılıyor

- [x] **Klasör yönü** — karar: **B buzlu cam** (13 Kas, "B bence"). İstek 13 Kas, "bu klasör nasıl"; referans @damienghader "File Folder" — https://x.com/bestdesignsonx/status/2120305510331089286. Deneme: `tasarim/klasor-cam-denemesi.jpg` (A şu anki pul, B buzlu cam, C açık cam, C dokununca yelpaze). Yelpaze hareketinin B'ye de eklenip eklenmeyeceği söylenmedi.
- [i] **B buzlu cam klasörü uygulamaya al** (`web/js/folders.js`) — 13 Kas. Yapıldı: içindeki ilk 3 defterin kapağı buzlu camın ardından bulanık görünür (SVG, backdrop-filter yok); eski kroko klasörler bir kez cama geçer; Ayarlar > Kapak görünümü (Buzlu cam / Düz renk). İnceleyici 6 bulgu, hepsi düzeltildi; doğrulayıcı 7/7, animasyon izlenemedi (panel gizli). iPad denemesi bekliyor — **v108** (06432f2, 18 Kas). Yelpaze eklenmedi (yukarıda [?]).
- [x] **B klasörüyle uyumlu defter görünümü** — karar: **2 · Cam kapak** (kapak buzlu cam, ilk sayfadaki yazı arkadan bulanık görünür) — 18 Kas, "şimdilik 2 olsun". İstek 13 Kas, "ona uygun da defter ne olabilir".
- [i] **Cam kapak defter görünümü uygulamaya al** — 18 Kas. Yapıldı: kapak renkli buzlu cam, altından ilk sayfa yazısıyla bulanık görünür; fotoğraflı kapak fotoğraf kalır; koyu renklerde cam daha örtücü; PDF ilk sayfası, açılış kuyruğu, eşzamanlı istek, kimlik tekrarı, kapaksız defter rengi düzeltildi. Defter açılış animasyonu iPad'de izlenmeli — **v108** (06432f2). "Şimdilik" dendi; genel arayüz sadeleşirse yeniden bakılabilir.
- [i] **Yazıda gariplik hissi** (19 Kas, "yazı tarafında bir gariplik hissediyorum, sanki bununla ilgili bir şey demiştin") — 19 Kas cevap: "Temel'de kötü yazdım ama gariplik gitti, harflerimi küçültüyor sanki". Neden: v107 (ea17bb3) üstel yumuşatma küçük kıvrımları içeriden kesip harfleri küçültüyor. Yapıldı: Akıcı ve Yumuşak'ta hıza uyarlanan süzgeç (`web/js/yumusatma.js`); yazı hızında harf boyu korunuyor (Akıcı en küçük harf %34 → %96, Yumuşak %81 → %98), yavaşken titreme alma eskisi gibi, Akıcı gecikmesi 31 → 0,06 birim. Hız ekran biriminde ölçülüyor: yakınlaştırınca/yatayda da çalışıyor (2x, 3x testli). İpek v109 ile birebir aynı bırakıldı (19 Kas, "ipek de iyi bu arada akıcıda sıkıntı"). Kalkışta uç son gerçek basıncı alıyor (eskiden 0,5'e sıçrıyordu). İnceleyici: engelleyici yok, 3 önerisi yapıldı. `test/yumusatma-testi.mjs` hepsi ✓, önizlemede Akıcı çizgisi ölçüldü. iPad denemesi bekliyor (aşağıda) — **v110** (d0a8463, 19 Kas).
  - [?] **Akıcı mı İpek mi daha az titreme alsın?** (inceleyici notu, 19 Kas) — v110'da yazı hızında Akıcı artık İpek'ten daha az titreme alıyor: yavaşken sıra Yumuşak < İpek < Akıcı, hızlı yazarken Akıcı İpek'ten pürüzlü. Kullanıcının iPad'de Akıcı–İpek karşılaştırmasına göre karar verilecek.
- [~] **Freenotes özellikleri (TikTok @studiwithmai)**: "hepsi bizde de olmalı", "o özelliklerin şu an çok basit bizimkiler" (18 Kas) — araştırma yapıldı (18 Kas), görülen özellikler aşağıda madde madde. Kaynak video yok; kaynak: Freenotes (@studiwithmai).
  - [?] **Anlık el yazısı güzelleştirme**: yazılan kelime seçilen el yazısı stiline dönüşüyor (ör. Noteworthy, Simplenote, Still Script, Kindred, Charmer); yazı dili Türkçe seçilebiliyor. Tanıma gerektirir. Kullanıcıya soruldu (18 Kas): web'de el yazısı Google'ın tanıma servisine gönderilsin mi (gizlilik), yoksa App Store sürümüne mi kalsın? — Freenotes (@studiwithmai), 18 Kas
  - [i] **Yazı boyunu ve satır aralığını eşitleme** (kaydırıcılar) + düzeltme şiddeti — tanıma gerektirmeden geometrik yapılabilir, **ilk iş** — Freenotes (@studiwithmai), 18 Kas. Yapıldı: Kement > **Düzenle** paneli (Yazı boyu, Satır aralığı, Çizgiye otur, Düzeltme şiddeti); canlı önizleme sayfa verisine yazılmıyor; şekil çizgileri işaretlenip dokunulmuyor (`web/js/duzenle.js`). İnceleyici 2 tur (5+3 bulgu), doğrulayıcı 1 tur (6 bulgu), hepsi düzeltildi; `test/duzenle-testi.mjs` 234/234. iPad'de gerçek el yazısıyla denenmeli, özellikle ayrık harfli ve l/k/d'li yazı — **v109** (e7d617d, 18 Kas).
  - [ ] **Yazarken otomatik düzenleme (2. aşama)**: yazma durunca son kelime/satır aynı çözümlemeyle düşük şiddette düzenlensin, ayardan kapatılabilsin — **1. aşama (v109) iPad'de iyi çalışırsa** — 18 Kas
  - [ ] **Başlık güzelleştirme** (el yazısı başlık seçili stilde) — el yazısı güzelleştirme kararına bağlı — Freenotes (@studiwithmai), 18 Kas
  - [ ] **Ezber bandı**: desenli bant yazıyı örter, dokununca açılır. Bizde buzlu kalem benzeri var; desenli bant stilleri eklenecek — Freenotes (@studiwithmai), 18 Kas
  - [ ] **Tema renk paletleri** (favori renkler, kişisel tema, en çok kullanılanlar) — bizde favori/son renkler var, tema paletleri yok — Freenotes (@studiwithmai), 18 Kas
  - [ ] **Kementle seçilen alanın ekran görüntüsü** / kırpıp görsel yapma — Freenotes (@studiwithmai), 18 Kas
  - [ ] **PDF'te istenen yeri istenen renkle temiz vurgulama** — bizde satıra hizalama var (v96); renk paleti entegrasyonu kontrol edilecek — Freenotes (@studiwithmai), 18 Kas

## iPad'de denenmesi gerekenler (canlı)

- [i] Yazı hissi: stabilizatör seviyeleri artık farklı mı, yavaş yazarken harfler bozuluyor mu — v107 (8 Kas, "savsak yazıyormuşum gibi") — ea17bb3. 19 Kas: v107 yumuşatması harfleri küçültüyordu → yerine v110'daki hıza uyarlanan süzgeç geldi; deneme bir alt satırda (v110).
- [i] Yazı hissi v110: Akıcı'da hızlı küçük yazı harfleri küçültüyor mu; İpek eskisi gibi mi; sayfa yakınlaştırılmışken de aynı mı; avuç/sistem hareketiyle çizgi iptal olunca sonunda kuyruk çıkıyor mu — v110 (d0a8463, 19 Kas)
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
- [ ] Defter kilidi — web: yalnız gizlilik kapağı (gerçek şifreleme değil). Face ID kilidi aşağıda native bölümünde
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
- [ ] Klasör aynı yöntemle — yön kararı verildi: B buzlu cam (13 Kas); uygulama işi yukarıda "Yapılıyor"da
- [ ] Rafa entegrasyon ve performans (300 defterde de akıcı)

### App Store hazırlığı (en son)
- ~~Kabuk/native kararı (kullanıcı)~~ (birleştirildi: yukarıdaki [?] "App Store yolu" ile aynı iş, 13 Kas)
- [ ] Satın alma (abonelik + ömür boyu), Small Business Program
- [ ] Gizlilik etiketleri (çeviri metni internete gidiyor — beyan edilmeli)
- [ ] Mağaza görselleri ve metni

---

## Bitti (özet)

`[i]` olanlar canlıda ama iPad denemesi bekliyor (yukarıdaki bölüm).

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
- [i] Sesle eşli not — v101
- [i] Dolma ve fırça kalem — v102
- [i] Karalayarak silme — v103, v105
- [i] Defterden çıkış animasyonu — v104
- [i] Desen kalemi + fırça içe aktarma, sesle yaz, yer işareti (adsız, renk değişir), bölümlü menü, Tüm sayfalara uygula (şablon/renk), "İki sayfayı kapla", buzlu kalem kalem panelinde — v105
- [i] Sayfa sesi kâğıt kalkarken, basılı tut Yapıştır — v106
- [i] Stabilizatör zamana bağlı, harfler şekle dönmüyor — v107
- [i] Stabilizatör harfleri küçültmüyor: Akıcı/Yumuşak hıza uyarlanan süzgeç, İpek aynı — v110 (d0a8463)
- [x] Pinterest sayfa tasarımları sorusu cevaplandı (kişisel kullanım: Şablonlarım; dağıtım: kendi/AI tasarımı)
- [x] Pazar araştırması ve rakip açığı listesi (150 madde) — https://claude.ai/artifact/4DXNBCSUMUHur7nEssLmfY
