**Superseded by ADR-0031 (2026-08-04): Control nodes render natively in the WebGL
canvas.** The history below is kept because it records why the DOM was chosen and
what it cost, including the 2026-07-29 raster amendment, which ADR-0031's native
offscreen pass also replaces. Its `font-src` framing for the system-fonts-only
limitation is corrected by ADR-0031: the real, twice-over blocker for a non-CSS text
pipeline is `worker-src` + `connect-src`, found only once one was attempted.

# 2D UI renders as a DOM overlay, not in three.js

Godot Control/CanvasLayer subtrees render as nested `<div>`s (a `ControlDispatcher` mirroring NodeDispatcher), layered as a sibling of the R3F `<Canvas>`, mapping `layout_mode`/anchors/offsets to CSS positioning, container nodes to flex/grid, and StyleBox resources to CSS background/border. They are not drawn as textured quads inside the 3D scene.

We chose DOM because the browser gives faithful text shaping, wrapping, scrolling, and box layout for free, which matches Godot's Control system far more cheaply than re-implementing it on textured planes. The trade-off: 2D and 3D never composite in one view (see ADR-0006), and 2D picking is not unified with 3D picking (tree→element highlight is supported; click-element→tree selection is deferred). Fidelity is best-effort: system fonts only (the VS Code webview CSP has no `font-src`), Control images decoded to a canvas and emitted as self-contained `data:` URLs (the loader's blob URL is revoked after decode; CSP `img-src` allows `blob:`/`data:`), and a minimal bbcode subset (`[b]`/`[i]`/`[color]`).

Hard to reverse (a whole parallel dispatcher + registry + layout engine) and a genuine trade-off against the textured-quad alternative, so it is recorded.

## Amendment (2026-07-29): a derived raster of a Control subtree, for ViewportTexture

The decision above stands unchanged: Controls render as DOM, and the overlay remains the only thing that lays them out. What is added is a **derived raster** — `rasterizeControlSubtree` (`src/r3f/controls/rasterizeControlSubtree.ts`) turns a live, laid-out Control subtree into a 2D canvas that WebGL can sample.

It exists for the one case where Godot itself composites a viewport onto a 3D surface: a `SubViewport` full of Controls sampled through a `ViewportTexture` (`scenes/demos/viewport/gui_in_3d/gui_panel_3d.tscn` puts a GUI on a `QuadMesh` exactly this way). Rendering Controls as textured quads was, and remains, rejected — the raster is a *copy* of what the DOM already laid out, produced on demand, never a second layout engine.

**Technique:** clone the subtree → inline every computed style onto the clone (the clone leaves the document, so nothing in the cascade reaches it) → wrap in `<svg><foreignObject>` → data URL → `Image` → `drawImage`. The browser keeps doing layout, text shaping, `object-fit`, clipping, `modulate`'s opacity/filter and the Control transform; we only hand it a self-contained document. The module is framework-free (no React, no three) and returns a canvas — a caller wanting a texture wraps it in `THREE.CanvasTexture` itself.

**The one non-obvious constraint** is that Chrome renders SVG-as-image with sub-resource loading disabled, so any image source that is not a `data:` URL draws *nothing* inside the `foreignObject` — silently, with no `onerror`. Measured in `verify-raster.mjs`: the same 48×48 magenta bitmap gives 0 magenta pixels as a `blob:` URL and 4608/4608 as a `data:` URL. The Control components already emit `data:` URLs (the clause above), which is why the real overlay rasterises correctly today; the rasteriser additionally rewrites any non-`data:` source it finds, so that stays true if it ever changes.

**Gated by a third browser harness**, `scripts/showcase/verify-raster.mjs` / `pnpm verify:raster`, for ADR-0024's reason — happy-dom has neither layout nor a rasteriser, so it can neither lay a Control out nor draw an SVG image, and vitest can only cover the pure helpers and the null guards. It asserts pixels: the blob-vs-data contrast above, and on the real overlay for `unit-control-transform-modulate.tscn` — 954 px at the `default_theme` font colour rgb(223,223,223), 52562 px of the checkerboard texture's `#ffffff`, 371 distinct colours, untainted canvas.

**Known divergences and limitations** (the raster inherits every fidelity limit of the overlay it copies, plus its own):

- **Text does not match Godot's.** Godot's default theme font is Open Sans SemiBold at size 16 (`scene/theme/default_theme.cpp` — `set_data_ptr(_font_OpenSans_SemiBold, …)`, `default_font_size = 16`); the overlay is system-fonts-only, and SVG-as-image cannot load a webfont even if one were added. Glyph shapes and advances differ; the colour does not (`control_font_color` = Color(0.875, …) → rgb(223,223,223)).
- **Background is the caller's.** The raster is transparent where the subtree is, matching a `SubViewport` with `transparent_bg = true`. Godot's default is `false` (`Viewport.xml`), which clears to `rendering/environment/defaults/default_clear_color` = Color(0.3, 0.3, 0.3) (`main/main.cpp`) → rgb(77,77,77) via `Color::to_rgba32`'s rounding; a caller reproducing that passes it as `backgroundColor`.
- **The host cannot hide itself presentationally.** Every computed property of the rasterised element is inlined onto the clone and only position/margin/size are overridden, so `visibility: hidden`, `opacity: 0` and `clip-path` on it each produce a *blank* raster — and a blank canvas, not the `null` that signals "not ready". An off-screen host must hide by moving off-screen. Measured: 5366 opaque px at `left: -99999px`, 0 for each of the other three.
- `::before`/`::after` are lost — computed style does not carry pseudo-elements. A non-issue for Control subtrees, which are pure inline styles (there is no `.module.css` under `r3f/controls/` and none of the Control components use pseudo-elements), and the reason inlining computed style is sufficient at all.
- A `<canvas>` inside the subtree clones empty (`cloneNode` does not copy its bitmap), and `ScrollContainer` scroll offset resets to the top.
- Cross-origin image sources without CORS headers taint the conversion canvas and are dropped rather than drawn.
- **Recursive `ViewportTexture` is not solved — and no corpus scene needs it to be.** A `ViewportTexture` sampled from *inside* the viewport it names would have to read that viewport's own render target; the rasteriser has no frame history and would draw whatever the texture currently resolves to. Deliberately out of scope, and unexercised: in `gui_in_3d` the only `ViewportTexture` consumer is the `QuadMesh` material (`albedo_texture = SubResource("2")`), while the `TextureRect` living inside the SubViewport carries `texture = ExtResource("2")` — `res://icon.webp`. Those are two unrelated resources that merely share the number 2 across the ExtResource and SubResource namespaces, which is the trap that makes the scene *look* recursive. `3d_in_2d`'s `ViewportSprite` and `procedural_materials`' plasma meshes are likewise siblings of their SubViewport, not children.
