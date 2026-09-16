# Install Pencil Pages from Windows

This guide installs the current test build on an iPad using a Windows PC. The build download stays available for up to 90 days. The app is free, but a free Apple signing profile needs to be renewed every seven days. Keep Sideloadly installed and refresh the app before it expires.

## 1. Download the app build

1. On your PC, open the [Pencil Pages build runs](https://github.com/FerrariF4O/pencil-pages/actions/workflows/build.yml).
2. Open the newest run with a green check mark.
3. Under **Artifacts**, download **PencilPages-unsigned-ipa**. It downloads as a ZIP file.
4. In File Explorer, open **Downloads**, right-click the ZIP, and choose **Extract All**.
5. Open the extracted folder. The file Sideloadly needs is **PencilPages-unsigned.ipa**. Do not select the checksum file or the ZIP.

If your browser is showing a long download address, press **Ctrl+J** to open its downloads list, then choose **Show in folder** beside the ZIP.

## 2. Prepare the PC and iPad

1. Install [Sideloadly for Windows](https://sideloadly.io/). Sideloadly says Windows also needs Apple's web versions of iTunes and iCloud; Microsoft Store versions can cause device detection problems. The Sideloadly page has the downloads.
2. Unlock the iPad and connect it to the PC with a USB-C cable.
3. If the iPad asks whether to trust this computer, tap **Trust** and enter your iPad passcode.
4. On the iPad, open **Settings → Privacy & Security → Developer Mode** and turn it on. If prompted, restart and confirm Developer Mode after the restart. If this setting is not shown yet, try the install first, then check again.

## 3. Install Pencil Pages

1. Open Sideloadly on the PC and select your connected iPad.
2. Drag **PencilPages-unsigned.ipa** into Sideloadly.
3. Enter your Apple ID in Sideloadly on your PC. Do not send your Apple password or verification codes to anyone or put them in GitHub.
4. Leave Sideloadly's automatic refresh option on and click **Start**.
5. If iPadOS asks you to trust the developer, open **Settings → General → VPN & Device Management**, select the developer entry, and tap **Trust**.
6. Open **Pencil Pages** from the iPad Home Screen. Create a notebook, draw a few strokes, close the app, and reopen the notebook to check that it saved.

## Keep the app available

With a free Apple account, sideloaded apps work for seven days before they need signing again. Sideloadly can refresh the app when the iPad is connected by USB; Wi-Fi refresh can be set up later. If the app stops opening, reconnect the iPad and install the same build through Sideloadly using the same Apple ID. Before installing a new test build, export any notes you care about from inside the app.

## Official setup references

- [Sideloadly for Windows](https://sideloadly.io/)
- [Sideloadly FAQ: Developer Mode, automatic refresh, and seven-day signing](https://sideloadly.io/faq)
- [Apple: Enable Developer Mode on a device](https://developer.apple.com/documentation/xcode/enabling-developer-mode-on-a-device)
