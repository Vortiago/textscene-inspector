---
type: SubViewport
category: 3D
status: unreviewed
fixture: unit-sub-viewport.tscn
# image: unit-sub-viewport
renders_as: an offscreen render target, plus a boundary that scopes its canvas subtree
---

# SubViewport

A Viewport that renders its subtree into an offscreen target. It draws nothing
itself; what it does is decide **where its subtree draws** — see ADR-0030 — and
publish what it rendered for a `ViewportTexture` consumer to sample.

A sub-viewport is a **canvas boundary, not a world boundary**. Godot's
`Viewport` constructor always instantiates its own `World2D`, so
`find_world_2d` never walks up to the parent: CanvasItem descendants (2D world
*and* Control UI) draw nowhere in the parent. But `find_world_3d` falls through
to `parent->find_world_3d()` unless `own_world_3d` is set, so **Node3D
descendants do draw in the parent's 3D view**, exactly as through a plain
`Node`. Measured against Godot 4.6.3, not derived.

The previewer gets both halves from the registration rather than from branching
code: the slice registers with neither `canvasItem` nor `container`, so
`NodeDispatcher`'s existing workspace rules pass it through in the 3D workspace
and drop its whole subtree in the 2D one.

## The offscreen pass

The pass renders **the scene the subtree is actually mounted in**. With 3D
content, a shared `World3D` and the 3D workspace, the subtree already draws
inline, so the main scene is the source — which is also what Godot does, since a
shared world means the viewport renders that whole world, environment and sky
included. Every other case (own world, 2D-world content, the 2D workspace) has
no inline mount, so the subtree is portalled into a detached scene that becomes
the source. Either way the subtree mounts exactly **once**: a second mount would
register a second Object3D at the same node path and selection would resolve to
the offscreen copy.

The camera is chosen by Godot's own rule, scoped to the sub-viewport's own
descendants — `camera_3d.cpp`'s `if (current || first_camera)`, where a later
`current` camera replaces an earlier one and, with none marked, the first in
tree order wins. No camera renders the clear colour and nothing else, as in
Godot. Its projection is rebuilt against the TARGET rect for the pass and
restored afterwards, because `<Camera3D>` builds every camera at the canvas's
16:9 default and the same object may be what the main canvas renders through.

## Divergences (offscreen pass)

- **Measured brightness gap on a shared-world target.** A Godot 4.6.3 render of
  `unit-sub-viewport-texture.tscn` and the previewer's own capture agree
  **exactly** in the main view (probe 630,240 → rgb(143, 150, 160) vs
  rgb(143, 150, 161)) but not inside the target, where the previewer is about
  0.6x in linear terms — probe 400,250 rgb(167, 188, 209) vs rgb(133, 153, 177),
  probe 420,440 rgb(80, 60, 50) vs rgb(62, 52, 40). The sphere and the horizon
  land in the right place and the target is not flipped, so the geometry is
  right. It is also NOT the target's colour space: three renders into a non-XR
  target in the WORKING space regardless of `texture.colorSpace`
  (`WebGLPrograms.js`), the target is tagged to match, and flipping that tag
  and rebuilding moves no probe by more than one code value. What localises it
  is the other acceptance scene: `3d_in_2d.tscn`, whose sub-viewport sets
  `transparent_bg` and is lit entirely from inside its own subtree, matches
  closely. The gap therefore sits in what the SHARED world contributes to the
  target — its environment and sky — not in the pass, the target format or the
  camera.
- **One content kind per target.** Godot composites a viewport's 3D world and
  its 2D canvas into one target. The previewer's renderer draws one workspace at
  a time, so a mixed-content sub-viewport shows its 3D half only.
- **Editor gizmos and selection highlights leak into a shared-world target**,
  because that target is a render of the main scene and they live there.
- **A consumer surface inside its own viewport's frustum is a GL feedback
  loop** — the target is being written while the surface samples it. Godot has
  the same shape of hazard and resolves it a frame late; here the result is
  driver-defined. Neither acceptance scene hits it (the quad is behind its
  sub-viewport's camera).
- **`viewport_path` is rebased onto the OUTER scene root**, derived from the
  consumer's own path. Godot resolves it against the root of the scene the
  resource is local to, so a ViewportTexture inside an instanced sub-scene
  resolves against that sub-scene's root instead — not reproduced.
- **Only `albedo_texture` accepts a ViewportTexture** among the material slots,
  plus `Sprite2D.texture`. Godot allows one in any Texture2D slot except
  `Decal`, `Light3D` and `PointLight2D`.
- **`TextureRect` cannot show one.** It is a Control, so it renders in the DOM
  overlay (ADR-0003) via `imageToDataUrl(texture.image)`, and a render target
  has no `image` element to draw. That is exactly why `ViewportTextureEntry`
  also carries `readPixels`; consuming it is the DOM rasterizer's job.
- **`msaa_3d`, `use_debanding` and `canvas_item_default_texture_filter` still do
  not affect the target**; it is rendered at `size` with linear filtering.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `size` | `Vector2i(256, 256)` | Render-target size in pixels. Default `Vector2i(512, 512)`. Overwritten by a stretching `SubViewportContainer`. |
| `own_world_3d` | `true` | Severs the shared `World3D`, so 3D descendants stop drawing in the parent view. The single most consequential property here. |
| `disable_3d` | `true` | Disables this viewport's own 3D pass. **Does not** hide 3D descendants from the parent view — probe-verified. |
| `transparent_bg` | `true` | Target clears transparent instead of to the opaque project clear colour. |
| `render_target_update_mode` | `0`–`4` | When the target re-renders. Default `2` (WHEN_VISIBLE). Forced to ALWAYS by a `SubViewportContainer` parent. |
| `render_target_clear_mode` | `0`–`2` | How the target clears. Default `0` (ALWAYS). |
| `handle_input_locally` | `false` | Input routing only; no render effect. Forced to `false` by a `SubViewportContainer` parent. |
| `size_2d_override` / `_stretch` | `Vector2i(320, 240)` / `true` | 2D-only size override; `(0, 0)` means unused. |
| `msaa_3d`, `use_debanding`, `canvas_item_default_texture_filter` | enums | Parsed; quality settings the previewer does not reproduce. |
| `audio_listener_enable_2d`, `gui_embed_subwindows` | booleans | Parsed; no render effect in a static previewer. |

## Divergences

- **Quality settings are parsed, not applied.** `msaa_3d`, `use_debanding` and
  `canvas_item_default_texture_filter` describe how Godot rasterises the target;
  the previewer renders through three.js defaults.
- **`handle_input_locally`, `gui_embed_subwindows`, `audio_listener_enable_2d`**
  concern input, subwindow and audio routing, none of which a static preview has.
- **`render_target_update_mode` does not gate rendering.** Godot skips the pass
  for `DISABLED`/`ONCE`; the previewer re-renders the target every frame
  whatever the mode says. Both scenes this is measured against author `4`
  (ALWAYS), so always-render is right where it has been checked; a `DISABLED`
  viewport still gets a live target here rather than a stale or blank one.
- **`render_target_clear_mode` does not gate clearing** either — the target is
  cleared every frame, so `NEVER` (which in Godot preserves the previous
  frame's contents) behaves like `ALWAYS`.
- **A `SubViewportContainer` parent overrides two authored values.** On
  enter-tree it forces `update_mode = ALWAYS` and `handle_input_locally = false`
  on its viewports, so those properties are dead for a contained sub-viewport.
  Not linted, because Godot's own editor writes them anyway.

## Linting

<!-- lint:begin SubViewport -->
Strict parsing format-checks these `SubViewport` properties. Every validator failure is an **error**.

| Property |
| --- |
| `audio_listener_enable_2d` |
| `canvas_item_default_texture_filter` |
| `disable_3d` |
| `gui_embed_subwindows` |
| `handle_input_locally` |
| `msaa_3d` |
| `own_world_3d` |
| `render_target_clear_mode` |
| `render_target_update_mode` |
| `size` |
| `size_2d_override` |
| `size_2d_override_stretch` |
| `transparent_bg` |
| `use_debanding` |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-subviewport-properties` | `subviewport-empty-size` | warning |
<!-- lint:end -->

Strict and lenient parsing diverge only on out-of-range enums: the lenient
parser warns and falls back to Godot's default (`render_target_update_mode` → 2,
`render_target_clear_mode` → 0, `msaa_3d` → 0,
`canvas_item_default_texture_filter` → 1), while the strict parser reports an
error. A malformed `size` falls back to `Vector2i(512, 512)`; a zero-area size
parses cleanly and is reported by the advisory `subviewport-empty-size` rule
instead.
