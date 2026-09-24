**Superseded by ADR-0037: Control nodes render natively in the WebGL canvas.** This
record keeps why the DOM was chosen and what it cost. ADR-0037's native offscreen pass
also replaces the raster amendment below. ADR-0037 corrects the `font-src` framing of the
system-fonts-only limit: the blocker for a non-CSS text pipeline is both `worker-src` and
`connect-src`.

# 2D UI renders as a DOM overlay, not in three.js

Godot Control/CanvasLayer subtrees render as nested `<div>`s (a `ControlDispatcher` that mirrors NodeDispatcher), layered as a sibling of the R3F `<Canvas>`. `layout_mode`, anchors and offsets map to CSS positioning, container nodes to flex/grid, and StyleBox resources to CSS background/border. They are not drawn as textured quads inside the 3D scene.

The browser gives faithful text shaping, wrapping, scrolling and box layout. That matches Godot's Control system far more cheaply than a re-implementation on textured planes. The costs:

- 2D and 3D never composite in one view (see ADR-0006), and 2D picking is not unified with 3D picking.
- Tree-to-element highlight works. Click-element-to-tree selection is deferred.
- Fidelity is best-effort. Fonts are system fonts only (the VS Code webview CSP has no `font-src`).
- Control images are decoded to a canvas and emitted as self-contained `data:` URLs. The loader revokes its blob URL after decode, and CSP `img-src` allows `blob:`/`data:`.
- Only a minimal bbcode subset (`[b]`/`[i]`/`[color]`) works.

The decision is hard to reverse (a whole parallel dispatcher, registry and layout engine) and a real trade-off against the textured-quad option.

## Amendment: a derived raster of a Control subtree, for ViewportTexture

The decision above stands: Controls render as DOM, and the overlay is the only thing that lays them out. The amendment adds a **derived raster**. `rasterizeControlSubtree` (`src/r3f/controls/rasterizeControlSubtree.ts`) turns a live, laid-out Control subtree into a 2D canvas that WebGL can sample.

It exists for the one case where Godot composites a viewport onto a 3D surface: a `SubViewport` full of Controls sampled through a `ViewportTexture`. `scenes/demos/viewport/gui_in_3d/gui_panel_3d.tscn` puts a GUI on a `QuadMesh` this way. Controls as textured quads stay rejected. The raster is a *copy* of what the DOM already laid out, made on demand, never a second layout engine.

**Technique:** clone the subtree and inline every computed style onto the clone. The clone leaves the document, so nothing in the cascade reaches it. Wrap it in `<svg><foreignObject>`, and draw it through a data URL and an `Image` with `drawImage`. The browser keeps doing layout, text shaping, `object-fit`, clipping, the opacity and filter of `modulate`, and the Control transform. The module is framework-free (no React, no three) and returns a canvas. A caller that wants a texture wraps it in `THREE.CanvasTexture` itself.

**The one non-obvious constraint:** Chrome renders SVG-as-image with sub-resource loading disabled. An image source that is not a `data:` URL draws *nothing* inside the `foreignObject`, silently, with no `onerror`. Measured in `verify-raster.mjs`: the same 48×48 magenta bitmap gives 0 magenta pixels as a `blob:` URL and 4608/4608 as a `data:` URL. The Control components emit `data:` URLs (see above), so the real overlay rasterises correctly. The rasteriser also rewrites any non-`data:` source it finds, so that stays true if the components change.

**Gate: a third browser harness**, `scripts/showcase/verify-raster.mjs` (`pnpm verify:raster`), for the reason in ADR-0024. happy-dom has neither layout nor a rasteriser, so vitest covers only the pure helpers and the null guards. The harness asserts pixels: the blob-versus-data contrast above, and the real overlay for `unit-control-transform-modulate.tscn`. That capture has 954 px at the `default_theme` font colour rgb(223,223,223), 52562 px of the checkerboard texture's `#ffffff`, 371 distinct colours, and an untainted canvas.

**Known divergences and limits.** The raster inherits every fidelity limit of the overlay it copies, plus its own:

- **Text does not match Godot's.** Godot's default theme font is Open Sans SemiBold at size 16 (`scene/theme/default_theme.cpp`: `set_data_ptr(_font_OpenSans_SemiBold, …)`, `default_font_size = 16`). The overlay is system-fonts-only, and SVG-as-image cannot load a webfont. Glyph shapes and advances differ. The colour does not (`control_font_color` is `Color(0.875, …)`, which is rgb(223,223,223)).
- **The background is the caller's.** The raster is transparent where the subtree is, which matches a `SubViewport` with `transparent_bg = true`. Godot's default is `false` (`Viewport.xml`), which clears to `rendering/environment/defaults/default_clear_color` = `Color(0.3, 0.3, 0.3)` (`main/main.cpp`). That is rgb(77,77,77) after the rounding of `Color::to_rgba32`. A caller that reproduces it passes it as `backgroundColor`.
- **The host cannot hide itself presentationally.** Every computed property of the rasterised element is inlined onto the clone, and only position, margin and size are overridden. So `visibility: hidden`, `opacity: 0` and `clip-path` on it each give a *blank* canvas, not the `null` that signals "not ready". An off-screen host must hide by moving off-screen. Measured: 5366 opaque px at `left: -99999px`, 0 for each of the other three.
- `::before`/`::after` are lost, because computed style does not carry pseudo-elements. Control subtrees use pure inline styles (no `.module.css` under `r3f/controls/`, and no Control component uses pseudo-elements), which is why inlining computed style is sufficient.
- A `<canvas>` inside the subtree clones empty (`cloneNode` does not copy its bitmap), and the `ScrollContainer` scroll offset resets to the top.
- A cross-origin image source without CORS headers taints the conversion canvas, so the rasteriser drops it.
- **Recursive `ViewportTexture` is out of scope, and no corpus scene needs it.** A `ViewportTexture` sampled from *inside* the viewport it names must read that viewport's own render target. The rasteriser has no frame history and draws whatever the texture currently resolves to. In `gui_in_3d` the only `ViewportTexture` consumer is the `QuadMesh` material (`albedo_texture = SubResource("2")`). The `TextureRect` inside the SubViewport carries `texture = ExtResource("2")`, which is `res://icon.webp`. The two resources are unrelated and share only the number 2 across the ExtResource and SubResource namespaces, which makes the scene *look* recursive. The `ViewportSprite` of `3d_in_2d` and the plasma meshes of `procedural_materials` are also siblings of their SubViewport, not children.
