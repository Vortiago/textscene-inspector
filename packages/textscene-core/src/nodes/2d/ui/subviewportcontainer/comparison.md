---
type: SubViewportContainer
category: 2D
status: unreviewed
fixture: unit-sub-viewport-container.tscn
# image: unit-sub-viewport-container
renders_as: a clipped surface showing its SubViewport children's targets
---

# SubViewportContainer

The Control that displays its `SubViewport` children's render targets — a
**viewport surface** (ADR-0030), and the one place a sub-viewport's canvas
subtree is drawn.

It draws **every** `SubViewport` child, stacked in tree order — not just the
first. From `SubViewportContainer::_notification(NOTIFICATION_DRAW)`:

```cpp
if (stretch) draw_texture_rect(c->get_texture(), Rect2(Vector2(), get_size()));
else         draw_texture_rect(c->get_texture(), Rect2(Vector2(), c->get_size()));
```

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `stretch` | `false` (default) | Each target is drawn at the **sub-viewport's own `size`**, anchored at the container's top-left. The container's rect does not size the content. |
| `stretch` | `true` | Child viewports are resized to `container_rect / stretch_shrink` and drawn across the container's whole rect. The authored `size` is dead. |
| `stretch_shrink` | `1` (default) | Integer divisor applied when `stretch` is on: the target renders smaller and scales up. Godot `ERR_FAIL_COND(p_shrink < 1)`. **Ignored entirely when `stretch` is false** — `recalc_force_viewport_sizes` returns early. |

Measured through Godot 4.6.3 with a 300×200 container at (100, 80) holding a
200×150 sub-viewport:

| `stretch` | Drawn rect | Content laid out against |
| --- | --- | --- |
| `false` | 200×150 at the container's top-left | `SubViewport.size` |
| `true` | 300×200 (the container's rect) | `get_size() / stretch_shrink` |

## What the surface shows

Two arms, because a viewport target has two kinds of source and the previewer
draws them in different technologies:

| Sub-viewport holds | Reaches the surface as |
| --- | --- |
| Controls | DOM, rendered straight into the surface |
| 2D-world (CanvasItem) or 3D content | the offscreen target's pixels, snapshotted through `ViewportTextureEntry.readPixels` into a `<canvas>` under the Control arm |

The target stores **linear** values: `createOffscreenTarget` tags it
`LinearSRGBColorSpace` and sets `isXRRenderTarget`, so three takes the offscreen
pass's output space from that tag. A 2D canvas reads `putImageData` bytes as
sRGB, so the blit applies the sRGB OETF the main WebGL canvas gets from its
fragment shader. Measured on `unit-sub-viewport-container-2d-content.tscn`
through Godot 4.6.3:

| | Stored in the target | Blitted | Godot 4.6.3 |
| --- | --- | --- | --- |
| default clear colour, sRGB `Color(0.3, 0.3, 0.3)` | 19 | 77 | 76 |
| authored `Color(0.5, 0.5, 0.5)` | 55 | 128 | 127 |

The 1-byte gap is the 8-bit **linear** intermediate: Godot keeps float precision
to its swap chain, while the target quantises before the curve expands the
darks. Dark gradients inside a sub-viewport band slightly more than the same
content drawn directly.

Both content kinds land on the same value.
`unit-sub-viewport-container-3d-content.tscn` is
`unit-sub-viewport-container-2d-content.tscn` with the same authored
`Color(0.5, 0.5, 0.5)` moved onto an unshaded box, so the one variable is which
pass filled the target: Godot renders both at 127 and the previewer renders both
at 128.

That took fixing the canvas underneath. `<SubViewport>` deliberately leaves the
renderer's live tone curve in force for 3D content — a shared world resolves to
the parent viewport's environment — and a viewport surface only ever exists in
the 2D workspace, whose canvas mounts no `EnvironmentLayer` and so carried
@react-three/fiber's ACES default. The 2D canvas is now `flat`
(`NoToneMapping`), which is Godot: `_render_buffers_post_process_and_tonemap`
runs on the 3D buffers and canvas items are composited AFTER it.

## `stretch` forces the viewport's size

`recalc_force_viewport_sizes` runs `set_size_force(get_size() / stretch_shrink)`
on every `SubViewport` child and returns early when `stretch` is off, so with it
on the authored `size` is **dead** — the content lays out against the
container's own rect. That number lives in the DOM (the surface is a `<div>` in
the Control overlay) while the target is allocated in the R3F root, so the
surface measures its box with a `ResizeObserver` and publishes it through
`ViewportRectRegistry`; `<SubViewport>` prefers it over `properties.size`. No
rect published is the ordinary case, not an error — a non-stretching container
resizes nothing, and a sub-viewport with no container has nothing to be resized
by. Both keep the authored size.

The measurement cannot feed back on itself: with `stretch` off the surface is
sized FROM `size` (so nothing is published), and with it on the surface is
sized by the container's layout, which the target has no influence over.

Measured on `unit-sub-viewport-container-stretch-2d-content.tscn` — the
non-stretch sibling with `stretch` as the only variable. Its `Outside` square
spans x 220..280, y 160..190: wholly outside the authored 200x150 target and
wholly inside the forced 300x200 one, so it is drawn only if the forced rect
won. Godot rgb(255, 102, 0), previewer rgb(255, 102, 0).

## A Camera2D frames the forced rect

The pixel arm draws whatever the sub-viewport's 2D pass rendered, and that pass
frames through the viewport's current Camera2D over the rect `stretch` forced —
not the authored `size`, and not the origin. `unit-sub-viewport-container-camera-2d.tscn`
adds a Camera2D to the stretch fixture and changes nothing else: the forced rect
stays 300x200 and the camera at (500, 400) makes the view world x 350..650,
y 300..500.

`Decoy` is what makes that falsifiable. It sits wholly outside the camera's view
and wholly inside the whole-rect fallback; `Band` and `Mark` sit the other way
round. The surface therefore holds one set or the other, never both — and
"both, in horizontal bands" is what a paint covering only part of its canvas
would look like, so the clear-colour probe where the fallback puts `Decoy` is
also the blit's coverage guard. Measured through Godot 4.6.3 with
`--scene-camera` (`ref:godot` disables a 2D scene's own cameras by default):

| Surface pixel | What it is | Godot 4.6.3 | Previewer |
| --- | --- | --- | --- |
| (150, 20) | `Band`, authored `Color(0.5, 0.5, 0.5)` | rgb(127, 127, 127) | rgb(128, 128, 128) |
| (40, 95) | `Mark` | rgb(255, 102, 0) | rgb(255, 102, 0) |
| (80, 50) | where the whole-rect fallback puts `Decoy` | rgb(76, 76, 76) | rgb(77, 77, 77) |

## Divergences

- **Content stops updating once it has settled.** `readRenderTargetPixels` is a
  synchronous GPU stall, so the surface samples the target on a bounded
  schedule (an opening animation frame, then `BLIT_ATTEMPTS` × 350 ms, the
  visual harness's own settle window) and then stops. It re-arms on a new
  target or a fresh parse. An `AnimationPlayer` running inside a sub-viewport
  therefore shows its settled frame in the surface, while the same animation
  drawn directly in the canvas keeps moving.
- **Clipping is a consequence, not an operation.** The container issues no clip;
  content outside the target simply was never rendered, because the texture is
  only `size` pixels. The DOM equivalent puts `overflow: hidden` on the
  *surface*, never on the container — a surface may legitimately overflow the
  container's own box, since Godot Controls do not clip unless `clip_contents`.
- **`get_minimum_size()`** is `Size2()` when `stretch`, else the **max** over its
  `SubViewport` children's sizes — load-bearing when the container sits inside a
  layout container.
- **It mutates its children.** On enter-tree and visibility change it forces
  `render_target_update_mode = ALWAYS` and `handle_input_locally = false` on
  every `SubViewport` child, so those authored values never take effect here.
- **A surface a script populates at runtime shows only what the `.tscn` holds.**
  `demos/2d/platformer/game_splitscreen.tscn` has two surfaces and only the
  first is comparable. Its `_ready()` runs
  `viewport_2.world_2d = viewport_1.world_2d`,
  `player_2.camera.custom_viewport = viewport_2`, `make_current()`. None of that
  serialises — `custom_viewport` is registered `PROPERTY_USAGE_NONE`
  (`camera_2d.cpp`) and a `world_2d` reassignment is not a property at all — so
  statically `Viewport2` holds one `ParallaxBackground` and no Camera2D, and its
  surface correctly shows that background framed from the origin. Godot's
  reference render differs because `pnpm ref:godot` runs the game. The
  static/runtime boundary, not a defect in the surface.
- **`ParallaxBackground` does not follow the camera**, so its edge cuts a
  horizontal line across a Camera2D-framed surface. In Godot it is a
  `CanvasLayer` whose layer transform tracks the viewport's canvas transform
  (`parallax_background.cpp::_camera_moved` → `set_scroll_offset`), so the
  background covers the viewport wherever the camera goes. The previewer has no
  slice for it, so its `ParallaxLayer`/`Sprite2D` descendants draw as ordinary
  world-space Node2Ds at their authored coordinates and stay put while the
  camera moves. On `game_splitscreen.tscn` the background art ends at world
  y 429 and the left view's top is world y 260, so the edge lands at surface
  row 169 with bare sky below it. It is content, not a blit artefact: the same
  edge sits at the same world y in `level/background/parallax_background.tscn`
  rendered alone, and every paint covers the whole canvas. The minimum that
  removes the edge is a `ParallaxBackground`/`ParallaxLayer` pair carrying the
  layer transform and `motion_scale`; anything less relocates or mis-scales it.

## Linting

<!-- lint:begin SubViewportContainer -->
Strict parsing format-checks these `SubViewportContainer` properties, plus 53 inherited from Control, 16 inherited from CanvasItem, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `mouse_target` | true or false |  |
| `stretch` | true or false |  |
| `stretch_shrink` | integer > 0 | error below |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
| `valid-control-tooltip-mouse-filter` (type-family match) | `control-tooltip-ignored-by-mouse-filter` | warning |
| `valid-subviewportcontainer-children` | `subviewportcontainer-no-viewport` | warning |
|  | `subviewportcontainer-non-arrow-cursor` | warning |
<!-- lint:end -->

Strict and lenient parsing diverge on `stretch_shrink`: the strict parser errors
on anything below 1 (Godot's own setter rejects it), while the lenient parser
warns and falls back to `1`. A non-boolean `stretch` errors strictly and falls
back to `false` leniently. The advisory `subviewportcontainer-no-viewport` rule
covers the structural case no format check can see — a container with no
`SubViewport` child draws nothing at all — and stays silent when a child is an
`instance=` node, whose sub-scene root the linter cannot inspect.
