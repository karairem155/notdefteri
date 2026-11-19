// Paket kimliği (bundle id) yalnız capacitor.config.json "appId" içinde tanımlı.
// Bu betik o değeri Xcode projesine (PRODUCT_BUNDLE_IDENTIFIER) yazar; cap sync bunu yapmıyor.
// Kullanım: npm run kimlik   (npm run cap:sync zaten çağırır)
import { readFileSync, writeFileSync } from "node:fs";

const { appId } = JSON.parse(readFileSync("capacitor.config.json", "utf8"));
if (!/^[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$/.test(appId || "")) {
  console.error(`capacitor.config.json appId geçersiz: ${appId}`);
  process.exit(1);
}
const yol = "ios/App/App.xcodeproj/project.pbxproj";
const eski = readFileSync(yol, "utf8");
const yeni = eski.replace(/PRODUCT_BUNDLE_IDENTIFIER = [^;]+;/g, `PRODUCT_BUNDLE_IDENTIFIER = ${appId};`);
if (yeni !== eski) writeFileSync(yol, yeni);
console.log(`Paket kimliği: ${appId}${yeni !== eski ? " (Xcode projesi güncellendi)" : ""}`);
