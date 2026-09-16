// Yedekleme: bütün defterler, ayarlar ve görseller tek bir JSON dosyasına yazılır; geri yükleme aynı dosyadan.
// Safari yer açmak için ana ekran uygulamasının verisini silebilir; bu düğme o riske karşı.
import { db } from "./db.js";
import { store } from "./store.js";
import { toast, confirmDialog, pickFile } from "./ui.js";

const FORMAT = 1;

function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function dataURLToBlob(dataURL) {
  const response = await fetch(dataURL);
  return response.blob();
}

function fileName() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `not-defteri-yedek-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.json`;
}

export async function exportBackup() {
  await store.flush();
  toast("Yedek hazırlanıyor…");
  const [notebooks, settings, assets] = await Promise.all([db.getAll("notebooks"), db.getAll("settings"), db.getAll("assets")]);
  const encodedAssets = [];
  for (const asset of assets) {
    encodedAssets.push({ id: asset.id, type: asset.type, name: asset.name, data: await blobToDataURL(asset.blob) });
  }
  const payload = { app: "notdefteri", format: FORMAT, exportedAt: new Date().toISOString(), notebooks, settings, assets: encodedAssets };
  const json = JSON.stringify(payload);
  const name = fileName();
  const file = new File([json], name, { type: "application/json" });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: "Not Defteri yedeği" });
      toast("Yedek paylaşıldı");
      return;
    } catch (error) {
      if (error && error.name === "AbortError") return;
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  toast("Yedek indirildi: " + name);
}

export async function importBackup() {
  const file = await pickFile("file-backup");
  if (!file) return;
  let payload;
  try {
    payload = JSON.parse(await file.text());
  } catch (_) {
    toast("Dosya okunamadı: geçerli bir yedek değil.");
    return;
  }
  if (!payload || payload.app !== "notdefteri" || !Array.isArray(payload.notebooks)) {
    toast("Bu dosya bir Not Defteri yedeği değil.");
    return;
  }
  const count = payload.notebooks.length;
  confirmDialog(
    "Yedek geri yüklensin mi?",
    `Yedekte ${count} defter var. Cihazdaki bütün defterler, ayarlar ve görseller bu yedekle DEĞİŞTİRİLİR. Önce mevcut veriyi yedeklemek istersen Vazgeç de.`,
    "Geri Yükle",
    async () => {
      try {
        await db.clear("notebooks");
        await db.clear("assets");
        await db.clear("settings");
        for (const notebook of payload.notebooks) await db.put("notebooks", notebook);
        for (const row of payload.settings || []) await db.put("settings", row);
        for (const asset of payload.assets || []) {
          await db.put("assets", { id: asset.id, type: asset.type, name: asset.name || "", blob: await dataURLToBlob(asset.data) });
        }
        toast("Yedek geri yüklendi, uygulama yenileniyor…");
        setTimeout(() => location.reload(), 900);
      } catch (error) {
        toast("Geri yükleme başarısız: " + error.message);
      }
    }
  );
}
