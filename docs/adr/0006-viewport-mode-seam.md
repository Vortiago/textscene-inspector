# 2D/3D selection is a single viewport-mode seam, 3D-default with a 2D-UI hint

One `ViewportModeContext` holds `{ mode: '2D' | '3D', showCollisions }`. `mode` chooses whether the center viewport mounts the R3F `<Canvas>` (3D) or the Control overlay (2D); `showCollisions` drives the collision gizmo. The viewport **defaults to 3D** (matching Godot's own 3D editor viewport, which doesn't show CanvasLayers), overridable by the `<ViewportToolbar>` 3D/2D toggle.

So the 2D overlay stays discoverable without auto-switching, the shell floats a **"switch to 2D" hint over the 3D viewport whenever the scene carries any Control/CanvasLayer node** (`has2DUIContent` + `ViewportArea` in `TscnPreviewShell`); clicking it flips to 2D. (We considered auto-opening Control-rooted scenes in 2D, but a uniform 3D default + hint was chosen — simpler, and it never surprises the user.) The two modes never composite into one view.

Mode is per-session today (the `ViewportModeProvider` default); per-app persistence through a `usePersistedMode()` hook (`localStorage` web / webview state API) is a tracked follow-up.

Recorded because the no-composite decision and the 3D-default-with-hint choice are deliberate product choices a future reader would otherwise question, and both the overlay subsystem and the collision toggle depend on this single seam.
