import SwiftUI

// Buzlu kalem paneli (docs/tasarim/10-BuzluKalem.png).
// Tezgahta buzlu kalem seçiliyken tekrar dokununca açılır.
struct FrostedPenPanel: View {
    @Binding var settings: FrostedPenSettings

    private let panelColor = Color(red: 0.13, green: 0.12, blue: 0.17)
    private let accent = Color(red: 0.55, green: 0.50, blue: 0.95)

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            HStack {
                Text("Buzlu kalem")
                    .font(.headline)
                    .foregroundStyle(.white)
                Spacer()
                Text("yazının üstüne çek")
                    .font(.footnote)
                    .foregroundStyle(Color.white.opacity(0.5))
            }

            HStack(spacing: 14) {
                Text("Bulanıklık")
                    .frame(width: 96, alignment: .leading)
                Slider(value: $settings.blurLevel, in: 1...12, step: 1)
                    .tint(accent)
            }

            HStack(spacing: 14) {
                Text("Şerit kalınlığı")
                    .frame(width: 96, alignment: .leading)
                Slider(value: $settings.thickness, in: 12...60, step: 2)
                    .tint(accent)
            }

            HStack {
                VStack(alignment: .leading, spacing: 3) {
                    Text("Dokununca açılsın")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(.white)
                    Text("Kapalıyken kalıcı bulanık kalır")
                        .font(.caption)
                        .foregroundStyle(Color.white.opacity(0.5))
                }
                Spacer()
                Toggle("Dokununca açılsın", isOn: $settings.revealOnTap)
                    .labelsHidden()
                    .tint(.green)
            }
            .padding(14)
            .background(Color.white.opacity(0.06), in: RoundedRectangle(cornerRadius: 12))
        }
        .foregroundStyle(Color.white.opacity(0.85))
        .padding(22)
        .frame(width: 460)
        .background(panelColor)
        .presentationBackground(panelColor)
    }
}
