import SwiftUI

@main
struct PencilPagesApp: App {
    @StateObject private var store = NotebookStore()
    @StateObject private var pens = PenFavoritesStore()
    @StateObject private var templates = TemplateLibrary()
    @Environment(\.scenePhase) private var scenePhase

    var body: some Scene {
        WindowGroup {
            LibraryView(store: store)
                .environmentObject(pens)
                .environmentObject(templates)
                .tint(Color(red: 0.36, green: 0.35, blue: 0.85))
                .onChange(of: scenePhase) { _, phase in
                    if phase != .active { store.flushPendingSaves() }
                }
        }
    }
}
