# 2D UI renders as a DOM overlay, not in three.js

Godot Control/CanvasLayer subtrees render as nested `<div>`s (a `ControlDispatcher` mirroring NodeDispatcher), layered as a sibling of the R3F `<Canvas>`, mapping `layout_mode`/anchors/offsets to CSS positioning, container nodes to flex/grid, and StyleBox resources to CSS background/border. They are not drawn as textured quads inside the 3D scene.

We chose DOM because the browser gives faithful text shaping, wrapping, scrolling, and box layout for free, which matches Godot's Control system far more cheaply than re-implementing it on textured planes. The trade-off: 2D and 3D never composite in one view (see ADR-0006), and 2D picking is not unified with 3D picking (tree→element highlight is supported; click-element→tree selection is deferred). Fidelity is best-effort: system fonts only (the VS Code webview CSP has no `font-src`), Control images decoded to a canvas and emitted as self-contained `data:` URLs (the loader's blob URL is revoked after decode; CSP `img-src` allows `blob:`/`data:`), and a minimal bbcode subset (`[b]`/`[i]`/`[color]`).

Hard to reverse (a whole parallel dispatcher + registry + layout engine) and a genuine trade-off against the textured-quad alternative, so it is recorded.
