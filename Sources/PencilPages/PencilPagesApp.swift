import SwiftUI

@main
struct PencilPagesApp: App {
    @StateObject private var store = NotebookStore()
    @Environment(\.scenePhase) private var scenePhase

    var body: some Scene {
        WindowGroup {
            LibraryView(store: store)
                .tint(Color(red: 0.25, green: 0.36, blue: 0.54))
                .onChange(of: scenePhase) { _, phase in
                    if phase != .active { store.flushPendingSaves() }
                }
        }
    }
}
