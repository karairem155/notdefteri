# Pencil Pages

Pencil Pages is a free, local-first notebook for iPad. The first milestone is an installation proof: create notebooks, write with Apple Pencil, add pages, and keep notes after closing and reopening the app. PDF annotation, study tools, search, and broader Goodnotes parity are later milestones.

The public source repository is [FerrariF4O/pencil-pages](https://github.com/FerrariF4O/pencil-pages).

## Get Pencil Pages onto an iPad

The current test build is available from the [GitHub Actions build page](https://github.com/FerrariF4O/pencil-pages/actions/workflows/build.yml). Download the artifact from the newest green run, then follow the step-by-step [Windows installation guide](INSTALL-ON-IPAD.md). This is an unsigned test app, so it must be signed on a Windows PC with Sideloadly; opening the ZIP on the iPad will not install it.

There are no subscriptions, ads, usage limits, or online services in this project. Notes stay in the app's private local storage. Writes are atomic; unrecognized or damaged notebook files are preserved and reported instead of being overwritten. The prototype can export an editable notebook file through the iPad share sheet. Direct Files import and restore are planned for a later milestone.

## Build from Windows

The source is Swift and the iPad app is compiled by a GitHub-hosted macOS runner. Standard macOS builds are free for public repositories ([GitHub runner documentation](https://docs.github.com/en/actions/reference/runners/github-hosted-runners)). Do not put personal notes or Apple account credentials in this repository.

1. Open the [latest successful Build iPad app run](https://github.com/FerrariF4O/pencil-pages/actions).
2. Download the `PencilPages-unsigned-ipa` artifact and extract its ZIP. Use the enclosed `PencilPages-unsigned.ipa` in [Sideloadly](https://sideloadly.io/); the downloaded artifact ZIP itself is not the installable app.
3. On Windows, install iTunes and iCloud from Apple's website (the Microsoft Store builds may not work with Sideloadly). Enable Developer Mode on the iPad, connect it by USB, trust the PC, then use Sideloadly to sign the IPA locally with your Apple account and install it. Enter Apple credentials only in Sideloadly on your PC; never add them to GitHub Actions or this repository. Keep the same Apple account and bundle identifier for updates.

Pushes and pull requests also run simulator tests and a device build. Downloadable IPA artifacts are uploaded for pushes and manual runs, not pull requests.

Free personal signing expires after seven days and has limits on active apps and devices. Keep Sideloadly available on the Windows PC and enable its refresh option; refresh requires the iPad and PC to be reachable by paired Wi-Fi or USB. If automatic refresh does not work, connect the iPad to the PC and refresh/reinstall before the signing period expires. The app's local note data should persist across an update using the same app identity, but export important notebooks through the share sheet before updating this prototype.

## Local development

The GitHub Actions workflow installs XcodeGen, generates `PencilPages.xcodeproj` from `project.yml`, builds and tests on the available iPad simulator, then packages an unsigned device IPA. A Mac is not required on your PC.

## Data format

Each `.pencilpages` file is a versioned JSON notebook. Page ink is stored as PencilKit drawing data encoded by the OS. This format is for this project; it does not read Goodnotes' proprietary notebook format. PDFs exported from Goodnotes can be imported in a later milestone.

See [PARITY.md](PARITY.md) for what is implemented, still needs testing, or is deferred.

## License

The original source code is licensed under the MIT License. Apple frameworks and GitHub-hosted build infrastructure remain subject to their own terms.
