---
type: SubViewport
category: 3D
status: unreviewed
fixture: unit-sub-viewport.tscn
# image: unit-sub-viewport
renders_as: an offscreen render target, plus a boundary that scopes its canvas subtree
---

# SubViewport

A Viewport that renders its subtree into an offscreen target for a `ViewportTexture` to sample (ADR-0030). It draws nothing itself. Its Node3D descendants still draw in the parent's 3D view unless `own_world_3d` is set, and its CanvasItem descendants draw only in the target. A Control-only subtree is rasterised from the DOM rather than by a WebGL pass.

## Linting

<!-- lint:begin SubViewport -->
Strict parsing format-checks these `SubViewport` properties, plus 47 inherited from Viewport, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `render_target_clear_mode` | enum 0-2 (ALWAYS/NEVER/ONCE) | warning |
| `render_target_update_mode` | enum 0-4 (DISABLED/ONCE/WHEN_VISIBLE/WHEN_PARENT_VISIBLE/ALWAYS) | warning |
| `size` | Vector2i(x, y), both >= 2, or the Vector2 spelling Godot converts | error below |
| `size_2d_override` | Vector2i(x, y), or the Vector2 spelling Godot converts |  |
| `size_2d_override_stretch` | true or false |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
<!-- lint:end -->

Strict and lenient parsing diverge only on out-of-range enums. The lenient parser warns and falls back to Godot's default (`render_target_update_mode` 2, `render_target_clear_mode` 0, `msaa_3d` 0, `canvas_item_default_texture_filter` 1), while the strict parser reports an error. A `size` Godot cannot read at all falls back to `Vector2i(512, 512)`. A component below 2 is a strict error, because `Viewport::_set_size` raises it (`viewport.cpp:1120`).

## Known limitations

- **Approximated** A sub-viewport holding both 2D and 3D content shows its 3D half only, since the renderer draws one workspace at a time.
- **Approximated** `render_target_update_mode` and `render_target_clear_mode` do not gate the pass. The target is re-rendered and cleared every frame, whatever the mode says.
- **Approximated** `msaa_3d`, `use_debanding` and `canvas_item_default_texture_filter` do not affect the target, which renders at `size` with linear filtering.
- **Approximated** Selection highlights and gizmos leak into a shared-world target, because that target is a render of the main scene.
- **Approximated** A consumer surface inside its own viewport's frustum samples a target still being written, with a driver-defined result.
- **Approximated** `viewport_path` on a consumer inside an instanced sub-scene resolves against the outer scene root, not the sub-scene's.
- **Not drawn** A `TextureRect` showing a `ViewportTexture` draws nothing for it. Only `albedo_texture` and `Sprite2D.texture` accept one.
- **Approximated** Text in a Control-only target uses system fonts, so glyph shapes and advance widths differ from Godot's Open Sans.
- **Approximated** Project settings such as `gui/theme/default_theme_scale` and `use_hdr_2d` are not read, so a themed or HDR canvas composites differently.
- **Needs runtime** A viewport whose camera or world is assigned by script frames from the origin.
