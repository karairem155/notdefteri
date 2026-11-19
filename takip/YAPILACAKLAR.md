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
- [x] **Görsel kaydırırken altta çok sayıda gölge** (8 Kas): Safari gölge izi düzeltmesi v106'da yapıldı ama bilgisayarda üretilemedi. 13 Kas: kullanıcı v106'dan sonra hâlâ çıktığını söyledi ("evet"). 19 Kas: "gölgeler düzeldi" → v106 düzeltmesi sonunda işe yaramış (iPad'de kullanıcı doğruladı) — v106.
- [x] **App Store yolu**: web'i paketleyen kabuk (öneri) mi, native'e taşıma mı? Eski Swift kodu `Sources/PencilPages` ayrıca duruyor. Fiyat önerisi: yıllık ₺499,99 / ömür boyu ₺999,99 / aylık ₺99,99. El yazısı OCR ücreti "app bitince konuşulacak". 13 Kas: kullanıcı "bakıcam" dedi. 19 Kas: "kabuğa koymak vs derken onu da anlamadım" → 19 Kas açıklandı. **KARAR 19 Kas: kabuk** — "webde kalmayacağız, App Store'a eklenecek", "kabuğa da koyalım" (web uygulaması iPad uygulamasının içine konacak). Uygulama işi aşağıda "Yapılıyor > App Store kabuğu".
  - [x] Soru (19 Kas): "önce App Store'a ekleyip sonra mı özellik güncelleniyor?" → 19 Kas cevaplandı.
- [?] **Apple Developer hesabı var mı?** (19 Kas, kabuk kararıyla) — kişisel mi şirket mi; yıllık 99 $. TestFlight ve App Store için şart. Bekleniyor: kullanıcının cevabı.

- [?] **Kapak açılış sesi** (sayfa sesinden farklı): ElevenLabs izni verildi ("evet", 13 Kas; ~30–40 kredi). 13 Kas: 3 deneme gönderildi — `tasarim/ses/kapak-1-hazir.mp3`, `kapak-2-hazir.mp3`, `kapak-3-hazir.mp3` (36 kredi). 19 Kas: "kapak sesleri geride kaldı unuttum" → dosyalar yeniden gönderildi. 19 Kas: "pc ses bozuk dinleyeceğim bunu hatırlat bana arada, kulaklık yanımda değil" → **hatırlatılacak** (oturum başlarında/arada bir kez sor). Bekleniyor: hangisi (ya da hiçbiri).
- [x] **Klasör yelpazesi B'ye de eklensin mi?** (13 Kas) — karar 19 Kas: "açılsın" (dokununca defterler yelpaze gibi açılsın, B buzlu cam klasörde). Uygulama işi aşağıda "Yapılacaklar > iPad geri bildirimi (19 Kas)".
- [x] **Genel arayüz daha sade olabilir / beyaz tema** — (18 Kas, "tasarımlarımız genel arayüz içime sinmiyor onu belki değiştirip daha sade yaparız bakacağım"). 19 Kas: "bence daha clean beyaz bir temada mı olsa, özentilik yapmış olur muyum Freenotes'tan"; sonra 19 Kas: "beyaz tema yapalım bence ne dersin ama logoyla uyumsuz mu" → yön görseli `tasarim/beyaz-tema-yonleri.jpg`. **KARAR 19 Kas**: "c olsun ama defter kısmı b deki gibi olsun" → raf tam beyaz (A), defter ekranında lacivert çubuklar (B). Uygulama: aşağıda iPad denemesi "Beyaz masa" — v112 (04e854a).
- [?] **Genel tasarımı beğenmemeye başladı** (19 Kas, "genel tasarımını beğenmemeye başladım") — neyi beğenmediği soruluyor: kapaklar, raf, simgeler, yazı tipi, alt çubuk? Önce ne beğenilmediği, sonra ikişerli örnek (tahminle üretme). Bekleniyor: kullanıcının cevabı.
- [?] **Akıcı mı İpek mi?** — düşük öncelik: 19 Kas yazı hissi denemesinde sorun bildirmedi ("her şey yolunda gibi"); karşılaştırma istenirse sorulacak. Ayrıntı aşağıda "Yazıda gariplik hissi" altında.
- [x] **El yazısını Google'ın tanıma servisine göndermek** (stil dönüşümü için) mi, App Store sürümünü beklemek mi? — 18 Kas. 19 Kas: "sorun ne, neden el yazısı olmuyor" → 19 Kas açıklandı. **Karar 19 Kas (kabuk kararıyla)**: Google'a gönderme yok; App Store kabuğunda Apple'ın cihazdaki tanıma özelliğiyle yapılacak. İş aşağıda Freenotes altında [ ], kabuğa bağlı.
- [x] **Sesle yazılan metin için el yazısı tarzı font** (19 Kas, "fontu çok beğenmedim, daha el yazısı tarzı font lazım") — seçenekler gösterildi; **karar 19 Kas**: "5 Playpen Sans ve 3 ve 2 opsiyonel olsun, default 5" → varsayılan Playpen Sans, seçenek Patrick Hand ve Kalam. Uygulama işi aşağıda "Yapılıyor".
- [?] **Kement > Düzenle anlaşılmadı** (19 Kas, "kement anlamadım bunu") — 19 Kas anlatıldı; ardından 19 Kas: "kementi yine anlamadım ya" → **önce/sonra görseli ve adım adım yeniden anlatıldı** (19 Kas). Bekleniyor: anladı mı, iPad'de deneyecek mi. Keşfedilebilirlik sorunu güçlü (Düzenle kementin içinde gizli). Ayrıntı aşağıda Freenotes altında (v109).

## Yapılıyor

- [i] **Sesle yaz fontu**: varsayılan **Playpen Sans**, seçenek olarak **Patrick Hand** ve **Kalam** — karar 19 Kas ("5 Playpen Sans ve 3 ve 2 opsiyonel olsun, default 5"). Yapıldı: üç font `web/fonts/` altına gömüldü (latin + latin-ext); dışa aktarmada eski yazı tipi korunuyor (inceleyici önerisi) — **v111** (00198e8, 19 Kas). iPad'de yazı tipleri denenecek.
- [~] **App Store kabuğu** — karar 19 Kas ("webde kalmayacağız, App Store'a eklenecek", "kabuğa da koyalım"). Plan: Capacitor/WKWebView, web dosyaları uygulamanın içinde, GitHub macOS sunucusunda derleme, TestFlight ile iPad'e. Apple Developer hesabı sorusu yukarıda [?]. **Not**: web'deki notlar uygulamaya kendiliğinden geçmez → web'de yedekle → uygulamada geri yükle akışı gerekli.

- [x] **Klasör yönü** — karar: **B buzlu cam** (13 Kas, "B bence"). İstek 13 Kas, "bu klasör nasıl"; referans @damienghader "File Folder" — https://x.com/bestdesignsonx/status/2120305510331089286. Deneme: `tasarim/klasor-cam-denemesi.jpg` (A şu anki pul, B buzlu cam, C açık cam, C dokununca yelpaze). Yelpaze hareketinin B'ye de eklenip eklenmeyeceği söylenmedi.
- [ ] **B buzlu cam klasörü uygulamaya al** (`web/js/folders.js`) — 13 Kas. Yapıldı: içindeki ilk 3 defterin kapağı buzlu camın ardından bulanık görünür (SVG, backdrop-filter yok); eski kroko klasörler bir kez cama geçer; Ayarlar > Kapak görünümü (Buzlu cam / Düz renk). İnceleyici 6 bulgu, hepsi düzeltildi; doğrulayıcı 7/7, animasyon izlenemedi (panel gizli). **v108** (06432f2, 18 Kas). **19 Kas iPad denemesi: HATALI** (alt satır). Yelpaze kararı "açılsın" (19 Kas), iş aşağıda.
  - [ ] **HATA: klasör iPad'de buzlu cam görünmüyor** (19 Kas, "dosya buzlu cam gözükmüyor iPad'de") — v108. Ekran görüntüsü istendi (19 Kas); bilgisayarda görünüp iPad'de görünmemesi Safari'ye özgü SVG/filtre farkı olabilir.
- [x] **B klasörüyle uyumlu defter görünümü** — karar: **2 · Cam kapak** (kapak buzlu cam, ilk sayfadaki yazı arkadan bulanık görünür) — 18 Kas, "şimdilik 2 olsun". İstek 13 Kas, "ona uygun da defter ne olabilir".
- [ ] **Cam kapak defter görünümü uygulamaya al** — 18 Kas. Yapıldı: kapak renkli buzlu cam, altından ilk sayfa yazısıyla bulanık görünür; fotoğraflı kapak fotoğraf kalır; koyu renklerde cam daha örtücü; PDF ilk sayfası, açılış kuyruğu, eşzamanlı istek, kimlik tekrarı, kapaksız defter rengi düzeltildi — **v108** (06432f2). "Şimdilik" dendi; genel arayüz sadeleşirse yeniden bakılabilir. **19 Kas iPad denemesi: HATALI** (alt satır).
  - [ ] **HATA: cam kapak iPad'de garip/hatalı duruyor** (19 Kas, "defter kapağı da garip olmuş", "buzlu cam kapak defterde yazı arkadan gözüküyor hmm ama bi garip duruyor hatalı gibi") — v108. Yazı arkadan görünüyor, yani özellik çalışıyor ama görünüm bozuk. Ekran görüntüsü istendi (19 Kas).
- [x] **Yazıda gariplik hissi** (19 Kas, "yazı tarafında bir gariplik hissediyorum, sanki bununla ilgili bir şey demiştin") — 19 Kas cevap: "Temel'de kötü yazdım ama gariplik gitti, harflerimi küçültüyor sanki". Neden: v107 (ea17bb3) üstel yumuşatma küçük kıvrımları içeriden kesip harfleri küçültüyor. Yapıldı: Akıcı ve Yumuşak'ta hıza uyarlanan süzgeç (`web/js/yumusatma.js`); yazı hızında harf boyu korunuyor (Akıcı en küçük harf %34 → %96, Yumuşak %81 → %98), yavaşken titreme alma eskisi gibi, Akıcı gecikmesi 31 → 0,06 birim. Hız ekran biriminde ölçülüyor: yakınlaştırınca/yatayda da çalışıyor (2x, 3x testli). İpek v109 ile birebir aynı bırakıldı (19 Kas, "ipek de iyi bu arada akıcıda sıkıntı"). Kalkışta uç son gerçek basıncı alıyor (eskiden 0,5'e sıçrıyordu). İnceleyici: engelleyici yok, 3 önerisi yapıldı. `test/yumusatma-testi.mjs` hepsi ✓, önizlemede Akıcı çizgisi ölçüldü. 19 Kas iPad denemesi: "her şey yolunda gibi" — **v110** (d0a8463, 19 Kas).
  - [?] **Akıcı mı İpek mi daha az titreme alsın?** (inceleyici notu, 19 Kas) — v110'da yazı hızında Akıcı artık İpek'ten daha az titreme alıyor: yavaşken sıra Yumuşak < İpek < Akıcı, hızlı yazarken Akıcı İpek'ten pürüzlü. **Düşük öncelik**: 19 Kas denemesinde sorun bildirmedi ("her şey yolunda gibi"); karşılaştırma istenirse sorulacak.
- [~] **Freenotes özellikleri (TikTok @studiwithmai)**: "hepsi bizde de olmalı", "o özelliklerin şu an çok basit bizimkiler" (18 Kas) — araştırma yapıldı (18 Kas), görülen özellikler aşağıda madde madde. Kaynak video yok; kaynak: Freenotes (@studiwithmai).
  - [ ] **Anlık el yazısı güzelleştirme** (19 Kas: [?] → [ ], **App Store kabuğuna bağlı**; Apple'ın cihazdaki tanımasıyla, Google'a gönderme yok): yazılan kelime seçilen el yazısı stiline dönüşüyor (ör. Noteworthy, Simplenote, Still Script, Kindred, Charmer); yazı dili Türkçe seçilebiliyor. Tanıma gerektirir. Kullanıcıya soruldu (18 Kas): web'de el yazısı Google'ın tanıma servisine gönderilsin mi (gizlilik), yoksa App Store sürümüne mi kalsın? — Freenotes (@studiwithmai), 18 Kas. 19 Kas: "sorun ne, neden el yazısı olmuyor" → 19 Kas açıklandı (tanıma servisi gerekiyor, web'de gizlilik); karar açık. 19 Kas karar: kabukta cihazda tanıma.
  - [?] **Yazı boyunu ve satır aralığını eşitleme** (kaydırıcılar) + düzeltme şiddeti — tanıma gerektirmeden geometrik yapılabilir, **ilk iş** — Freenotes (@studiwithmai), 18 Kas. Yapıldı: Kement > **Düzenle** paneli (Yazı boyu, Satır aralığı, Çizgiye otur, Düzeltme şiddeti); canlı önizleme sayfa verisine yazılmıyor; şekil çizgileri işaretlenip dokunulmuyor (`web/js/duzenle.js`). İnceleyici 2 tur (5+3 bulgu), doğrulayıcı 1 tur (6 bulgu), hepsi düzeltildi; `test/duzenle-testi.mjs` 234/234. iPad'de gerçek el yazısıyla denenmeli, özellikle ayrık harfli ve l/k/d'li yazı — **v109** (e7d617d, 18 Kas). 19 Kas: "kement anlamadım bunu" → kullanıcı bulamadı/anlamadı; önce anlatılacak, keşfedilebilirlik sorunu olabilir (yukarıda [?]). 19 Kas: "kementi yine anlamadım ya" → önce/sonra görseliyle yeniden anlatıldı.
  - [ ] **Yazarken otomatik düzenleme (2. aşama)**: yazma durunca son kelime/satır aynı çözümlemeyle düşük şiddette düzenlensin, ayardan kapatılabilsin — **1. aşama (v109) iPad'de iyi çalışırsa** — 18 Kas
  - [ ] **Başlık güzelleştirme** (el yazısı başlık seçili stilde) — el yazısı güzelleştirme kararına bağlı — Freenotes (@studiwithmai), 18 Kas
  - [ ] **Ezber bandı**: desenli bant yazıyı örter, dokununca açılır. Bizde buzlu kalem benzeri var; desenli bant stilleri eklenecek — Freenotes (@studiwithmai), 18 Kas
  - [ ] **Tema renk paletleri** (favori renkler, kişisel tema, en çok kullanılanlar) — bizde favori/son renkler var, tema paletleri yok — Freenotes (@studiwithmai), 18 Kas
  - [ ] **Kementle seçilen alanın ekran görüntüsü** / kırpıp görsel yapma — Freenotes (@studiwithmai), 18 Kas
  - [ ] **PDF'te istenen yeri istenen renkle temiz vurgulama** — bizde satıra hizalama var (v96); renk paleti entegrasyonu kontrol edilecek — Freenotes (@studiwithmai), 18 Kas

## iPad'de denenmesi gerekenler (canlı)

19 Kas: kullanıcı 1–12 numaralı listeye cevap verdi; 5, 6, 9, 10 cevapsız (hâlâ [i]).

- [x] Yazı hissi: stabilizatör seviyeleri artık farklı mı, yavaş yazarken harfler bozuluyor mu — v107 (8 Kas, "savsak yazıyormuşum gibi") — ea17bb3. 19 Kas: v107 yumuşatması harfleri küçültüyordu → yerine v110'daki hıza uyarlanan süzgeç geldi; v110 denemesi tamam (alt satır).
- [x] (1) Yazı hissi v110: Akıcı'da hızlı küçük yazı harfleri küçültüyor mu; İpek eskisi gibi mi; sayfa yakınlaştırılmışken de aynı mı; avuç/sistem hareketiyle çizgi iptal olunca sonunda kuyruk çıkıyor mu — v110 (d0a8463, 19 Kas). 19 Kas: "her şey yolunda gibi".
- [i] (5) Sayfa çevirme sesi kâğıt kalkarken mi geliyor — v106 (19 Kas cevapsız)
- [i] (6) Basılı tutunca Yapıştır — v106 (19 Kas cevapsız)
- [x] (7) Dolma, fırça, desen kalemleri; kendi fırçasını PNG'den ekleme — v102/v105. 19 Kas: "desen png ekleniyor" (sorun bildirilmedi). Procreate fırçası isteği ayrı satır: Yapılacaklar > iPad geri bildirimi (19 Kas).
- [x] (8) Sesle yaz (dikte, Türkçe) — v105. 19 Kas: "sorunsuz" (gerçek mikrofonla denendi). Font isteği yukarıda [?].
- [i] (9) Sesle eşli not: kayıt sırasında yazılan çizgiye parmakla dokun → o an çalar — v101 (gerçek mikrofonla denenmedi; 19 Kas cevapsız)
- [i] (10) Karalayarak silme hassasiyeti — v105 (kullanıcı "çok yoğun karalamada çalışıyor" demişti, gevşetildi; 19 Kas cevapsız)
- [x] (11) Defterden çıkış animasyonu yarıda kalmıyor mu — v104. 19 Kas: "animasyon yarıda kalmıyor".
- [x] (12) Dikey iPad'de üst çubuk tek satır, yer işareti düğmesi — v105. 19 Kas: "evet".
- [x] (2) Buzlu cam klasör: rafta görünüm, klasörü açıp kapama, Ayarlar > Kapak görünümü — v108. Deneme yapıldı 19 Kas, **sonuç HATA** ("dosya buzlu cam gözükmüyor iPad'de") → iş yukarıda "Yapılıyor"da [ ].
- [x] (3) Cam kapak defter: ilk sayfa yazısı arkadan bulanık görünüyor mu, koyu kapaklar, defter açılış animasyonu — v108. Deneme yapıldı 19 Kas, **sonuç HATA** ("bi garip duruyor hatalı gibi") → iş yukarıda "Yapılıyor"da [ ].
- [?] (4) Kement > Düzenle (yazı boyu, satır aralığı, çizgiye otur): gerçek el yazısıyla, ayrık harfli ve l/k/d'li yazıda — v109. 19 Kas: "kement anlamadım bunu" → önce anlatılacak, sonra yeniden denenecek. 19 Kas: "kementi yine anlamadım ya" → görselle yeniden anlatıldı.
- [i] (13) Yeni kalem paneli: renk en üstte, basınç/şekil/stabilizatör kapalı "Yazma ayarları"nda; buzlu kalem uç tipleri arasında — v111 (00198e8, 19 Kas)
- [i] (14) "Metin ve Ses" paneli (sesli not sesle yazın yanında); Seçim düğmesine ikinci dokunuş → Nesneleri düzenle — v111
- [i] (15) Sesle yaz yazı tipleri: Playpen Sans (varsayılan), Patrick Hand, Kalam; Türkçe harfler — v111
- [i] (16) Tek/Çift: dikeyde ve yatayda üst çubukta, bölmede menüde — v111
- [i] (17) Medya > Fotoğraftan Çıkartma Yap çalışıyor mu — v111
- [i] (18) Beyaz masa: raf tam beyaz, defter ekranında lacivert çubuklar; Ayarlar > Masa'da eski "Marka gri" seçilebiliyor — v112 (04e854a, 19 Kas)

## Yapılacaklar

### iPad geri bildirimi (19 Kas)
- [ ] **Klasör yelpazesi**: B buzlu cam klasöre dokununca içindeki defterler yelpaze gibi açılsın — karar 19 Kas, "açılsın" (denemedeki C hareketi; `tasarim/klasor-cam-denemesi.jpg`). Önce klasörün iPad'de buzlu cam görünmeme hatası çözülmeli.
- [ ] **Procreate fırçasını doğrudan içe aktarma** (.brush / .brushset) ve Procreate gibi çizim (19 Kas, "ben brush direkt içe aktarılıyor ya onu da istedim, Procreate gibi çizim de yapabilmek için"). PNG'den fırça ekleme zaten çalışıyor (v105).
- [i] **Menü düzeni** — onaylanan düzen uygulandı; inceleyicinin 4 önerisi de yapıldı (bölmede Tek/Çift menüde, düzenleme açıkken Seçim menüsü, dışa aktarmada eski yazı tipi, renk düğmeleri 44 px); ölü menü kodu silindi — **v111** (00198e8, 19 Kas). iPad denemesi aşağıda. İstek: bazı öğeler yanlış bölümde (19 Kas, "menüde bazı yerler çok saçma yerlerde, mesela sesli not görüntüler kısmında, diğerde ne alaka, buzlu kalem de öyle, kalem renk seçme çok aşağıda menüde"). **Önerilen düzen onaylandı** (19 Kas, "bu düzenle başla"):
  - kalem rengi kalem panelinin en üstüne; sıra renk → uç tipi → kalınlık → opaklık → favoriler; basınç/şekil/stabilizatör en altta kapalı "Yazma ayarları"
  - buzlu kalem yalnız kalemler arasında (ayarları kalem panelinde)
  - sesli not → "Metin ve Ses" paneli (sesle yazın yanında)
  - Nesneleri düzenle → Seçim düğmesine
  - Yapıştır Medya'dan kalkar; "Diğer" bölümü kalkar; Medya paneli adı "Fotoğraf ve Dosya"
  - üç nokta menüsünde tekrar eden (kopya) öğeler kalkar
- [i] **HATA: Medya > "Fotoğraftan Çıkartma Yap" çalışmıyor** (19 Kas, menü incelemesinde bulundu) — panelde `ctx.makeSticker` verilmemiş (`web/js/panels.js` 646. satır çağırıyor); v90 özelliği. Düzeldi — **v111** (00198e8, 19 Kas).
- [i] **Tek sayfa görünümü daha erişilebilir yerde** (19 Kas, "tek sayfa görünümü daha erişilebilir bir yerde olsun") — Tek/Çift artık dikeyde de üst çubukta (önce dikeyde gizliydi); bölmede menüde — **v111** (00198e8, 19 Kas).
- [ ] **Chrome sekmesi gibi defter sekmeleri** (19 Kas, "sekmeler Chrome sekmesi gibi açılabilsin") — açık defterler üstte sekme şeridi gibi.

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
- [ ] El yazısında arama ve el yazısını metne çevirme (Türkçe desteği önce cihazda doğrulanacak) — 19 Kas kabuk kararıyla el yazısı güzelleştirme de bu cihazdaki tanımayı kullanacak
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
- [x] Dolma ve fırça kalem — v102 (iPad 19 Kas)
- [i] Karalayarak silme — v103, v105
- [x] Defterden çıkış animasyonu — v104 (iPad 19 Kas, "animasyon yarıda kalmıyor")
- [i] Desen kalemi + fırça içe aktarma, sesle yaz, yer işareti (adsız, renk değişir), bölümlü menü, Tüm sayfalara uygula (şablon/renk), "İki sayfayı kapla", buzlu kalem kalem panelinde — v105. 19 Kas iPad: desen/PNG fırça, sesle yaz, dikey üst çubuk tamam; bölümlü menünün düzeni beğenilmedi → v111'de yeniden düzenlendi (Yapılacaklar > Menü düzeni); diğerleri denenmedi.
- [x] Safari gölge izi (görsel kaydırırken) — v106 (iPad 19 Kas, "gölgeler düzeldi")
- [i] Sayfa sesi kâğıt kalkarken, basılı tut Yapıştır — v106
- [x] Stabilizatör zamana bağlı, harfler şekle dönmüyor — v107 (v110 ile yerine geçildi)
- [x] Stabilizatör harfleri küçültmüyor: Akıcı/Yumuşak hıza uyarlanan süzgeç, İpek aynı — v110 (d0a8463; iPad 19 Kas, "her şey yolunda gibi")
- [i] Menü düzeni (renk üstte kalem paneli, Yazma ayarları, Metin ve Ses, Seçim'de Nesneleri düzenle, Fotoğraf ve Dosya), Çıkartma hatası, sesle yaz fontları (Playpen Sans / Patrick Hand / Kalam gömülü), Tek/Çift dikeyde de; ölü menü kodu silindi — v111 (00198e8)
- [i] Beyaz masa varsayılan (raf beyaz, defterde lacivert çubuklar; "Marka gri" Ayarlar > Masa'da) — v112 (04e854a)
- [x] Pinterest sayfa tasarımları sorusu cevaplandı (kişisel kullanım: Şablonlarım; dağıtım: kendi/AI tasarımı)
- [x] Pazar araştırması ve rakip açığı listesi (150 madde) — https://claude.ai/artifact/4DXNBCSUMUHur7nEssLmfY
