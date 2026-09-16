import PencilKit
import Combine
import SwiftUI
import UIKit

@MainActor
final class CanvasActions: ObservableObject {
    weak var canvasView: PKCanvasView?
    var commitCurrentDrawing: (() -> Void)?
    @Published var canUndo = false
    @Published var canRedo = false

    func undo() {
        canvasView?.undoManager?.undo()
        refreshUndoState()
    }

    func redo() {
        canvasView?.undoManager?.redo()
        refreshUndoState()
    }

    func refreshUndoState() {
        canUndo = canvasView?.undoManager?.canUndo ?? false
        canRedo = canvasView?.undoManager?.canRedo ?? false
    }
}

struct PencilCanvasView: UIViewRepresentable {
    var drawing: PKDrawing
    var toolConfiguration: DrawingToolConfiguration
    var actions: CanvasActions
    var onDrawingChange: (PKDrawing, Bool) -> Void

    func makeCoordinator() -> Coordinator { Coordinator(self) }

    func makeUIView(context: Context) -> PKCanvasView {
        let canvas = PKCanvasView()
        canvas.delegate = context.coordinator
        canvas.drawingPolicy = .pencilOnly
        canvas.backgroundColor = .clear
        canvas.isOpaque = false
        canvas.isScrollEnabled = false
        canvas.bounces = false
        canvas.tool = toolConfiguration.makeTool()
        canvas.drawing = drawing
        canvas.contentInsetAdjustmentBehavior = .never
        context.coordinator.appliedToolConfiguration = toolConfiguration
        actions.canvasView = canvas
        actions.commitCurrentDrawing = { [weak canvas, weak coordinator = context.coordinator] in
            coordinator?.commit(canvas)
        }
        return canvas
    }

    func updateUIView(_ canvas: PKCanvasView, context: Context) {
        context.coordinator.parent = self
        if context.coordinator.appliedToolConfiguration != toolConfiguration {
            canvas.tool = toolConfiguration.makeTool()
            context.coordinator.appliedToolConfiguration = toolConfiguration
        }
        if canvas.drawing != drawing { canvas.drawing = drawing }
        actions.canvasView = canvas
        actions.commitCurrentDrawing = { [weak canvas, weak coordinator = context.coordinator] in
            coordinator?.commit(canvas)
        }
        updateUndoState(canvas)
    }

    static func dismantleUIView(_ canvas: PKCanvasView, coordinator: Coordinator) {
        coordinator.commit(canvas)
        if coordinator.parent.actions.canvasView === canvas {
            coordinator.parent.actions.canvasView = nil
            coordinator.parent.actions.commitCurrentDrawing = nil
        }
    }

    private func updateUndoState(_ canvas: PKCanvasView) {
        actions.refreshUndoState()
    }

    @MainActor
    final class Coordinator: NSObject, PKCanvasViewDelegate {
        var parent: PencilCanvasView
        var appliedToolConfiguration: DrawingToolConfiguration?
        private var saveWorkItem: DispatchWorkItem?

        init(_ parent: PencilCanvasView) { self.parent = parent }

        func canvasViewDidEndUsingTool(_ canvasView: PKCanvasView) {
            saveWorkItem?.cancel()
            parent.onDrawingChange(canvasView.drawing, false)
            parent.actions.refreshUndoState()
        }

        func canvasViewDrawingDidChange(_ canvasView: PKCanvasView) {
            saveWorkItem?.cancel()
            let work = DispatchWorkItem { [weak self, weak canvasView] in
                guard let self, let canvasView else { return }
                self.parent.onDrawingChange(canvasView.drawing, false)
            }
            saveWorkItem = work
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.25, execute: work)
        }

        func commit(_ canvasView: PKCanvasView?) {
            saveWorkItem?.cancel()
            guard let canvasView else { return }
            parent.onDrawingChange(canvasView.drawing, true)
        }
    }
}
