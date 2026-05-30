# 2D/3D selection is a single viewport-mode seam with an auto-default

One `ViewportModeContext` holds `{ mode: '2D' | '3D', showCollisions }`. `mode` chooses whether the center viewport mounts the R3F `<Canvas>` (3D) or the Control overlay (2D); `showCollisions` drives the collision gizmo. The default is a heuristic on the scene root type — Control/CanvasLayer roots open in 2D, spatial roots open in 3D — overridable by a toolbar toggle.

For a scene mixing a 3D world and CanvasLayer UI (e.g. `main.tscn`), the default is 3D (matching Godot's own 3D editor viewport, which doesn't show CanvasLayers), and the tree surfaces a "contains 2D UI — switch to 2D" hint so the overlay is discoverable. The two modes never composite into one view.

Mode is persisted per app through a `usePersistedMode()` hook: `localStorage` in the web app, the webview state API in VS Code.

Recorded because the no-composite decision and the auto-default heuristic are deliberate product choices a future reader would otherwise question, and both the overlay subsystem and the collision toggle depend on this single seam.
