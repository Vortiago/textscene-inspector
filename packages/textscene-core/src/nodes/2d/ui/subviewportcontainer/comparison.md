---
type: SubViewportContainer
category: 2D
status: unreviewed
fixture: unit-sub-viewport-container.tscn
image: unit-sub-viewport-container
renders_as: a clipped surface showing its SubViewport children's targets
---

# SubViewportContainer

The Control that displays its `SubViewport` children's render targets — a
**viewport surface** (ADR-0033), and the one place a sub-viewport's canvas
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

## Minimum size

`SubViewportContainer::get_minimum_size()` is `Size2()` when `stretch`, else the
componentwise **max** over its `SubViewport` children's own `get_size()`.
`stretch_shrink` never enters it — that divides the already-solved container
rect (`recalc_force_viewport_sizes`), which is downstream.

It decides nothing while the container's rect comes from its own anchors and
offsets, and everything once a parent DISTRIBUTES space. Measured through Godot
4.6.3 on `unit-sub-viewport-container-centred.tscn` — an offsetless container
holding a 300×180 sub-viewport, inside a `CenterContainer` occupying
(100, 80) 800×480:

| Reported minimum size | Solved container rect | Surface |
| --- | --- | --- |
| 300×180 (Godot, and ours) | (350, 230) 300×180 | orange spans x 350..649, y 230..409 |
| 0×0 | (500, 320) 300×180 | displaced by (150, 90) — exactly half the sub-viewport |

`CenterContainer` offsets by `floor((parent - minsize) / 2)`, so a zero minimum
size puts the container's TOP-LEFT where its centre belongs, and the surface
right edge then clips against the project viewport rather than merely moving.
Every other `SubViewportContainer` fixture pins the container with explicit
offsets, where the anchor formula never reads the minimum size at all once the
authored rect already exceeds it — hence the dedicated fixture.

## What the surface shows

A viewport target has two kinds of source, and the painter draws both, since
every content kind is a WebGL texture it can sample directly:

| Sub-viewport holds | Reaches the surface as |
| --- | --- |
| Controls | its own live `<ControlCanvasWalker>` mount, drawn straight into the surface |
| 2D-world (CanvasItem) or 3D content | the offscreen target's `texture`, sampled directly on a `<ControlQuad>` — no CPU round trip, no colour-space re-encode |

The target itself stores **linear** values: `createOffscreenTarget` tags it
`LinearSRGBColorSpace` and sets `isXRRenderTarget`, so three takes the offscreen
pass's output space from that tag, and the consumer decodes it back through the
ordinary sampling pipeline. Measured on
`unit-sub-viewport-container-2d-content.tscn` with `pnpm ref:godot
scenes/fixtures/unit-sub-viewport-container-2d-content.tscn --mode 2d --probe
<x,y>` against `pnpm ref:ours unit-sub-viewport-container-2d-content.tscn --2d
--probe <x,y>`:

| Probe | What it is | Godot 4.6.3 | Ours |
| --- | --- | --- | --- |
| (250, 200) | the default clear colour, sRGB `Color(0.3, 0.3, 0.3)` | rgb(76, 76, 76) | rgb(77, 77, 77) |
| (200, 100) | the authored `Color(0.5, 0.5, 0.5)` band | rgb(127, 127, 127) | rgb(128, 128, 128) |

The 1-byte gap is the 8-bit **linear** intermediate: Godot keeps float precision
to its swap chain, while the target quantises before the curve expands the
darks. Dark gradients inside a sub-viewport band slightly more than the same
content drawn directly. Over the whole frame that is a mean channel error of
0.04/255 — the scale of a one-count rounding, not of a shading difference.

Both content kinds land on the same value.
`unit-sub-viewport-container-3d-content.tscn` is
`unit-sub-viewport-container-2d-content.tscn` with the same authored
`Color(0.5, 0.5, 0.5)` moved onto an unshaded box, so the one variable is which
pass filled the target: the same two probes return the same two pairs, 127
against 128 and 76 against 77.

`<SubViewport>` deliberately leaves the renderer's live tone curve in force for
3D content — a shared world resolves to the parent viewport's environment — and
a viewport surface only ever exists in the 2D workspace, whose canvas mounts no
`EnvironmentLayer`. That canvas is `flat` (`NoToneMapping`), which is Godot:
`_render_buffers_post_process_and_tonemap` runs on the 3D buffers and canvas
items are composited AFTER it.

## `stretch` forces the viewport's size

`recalc_force_viewport_sizes` runs `set_size_force(get_size() / stretch_shrink)`
on every `SubViewport` child and returns early when `stretch` is off, so with it
on the authored `size` is **dead** — the content lays out against the
container's own rect. That number is produced by the Control rect solve while
the target is allocated in the R3F root, so the surface publishes its solved box
through `ViewportRectRegistry`; `<SubViewport>` prefers it over
`properties.size`. No
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

## `modulate` / `self_modulate` tint the composite

`NOTIFICATION_DRAW` calls a plain `draw_texture_rect(c->get_texture(), rect)` —
no colour argument — but every `CanvasItem` draw call is tinted by the item's
own `modulate`/`self_modulate` at the rendering-server level
(`RenderingServer::canvas_item_set_modulate`/`_self_modulate`), the same
mechanism `ColorRect`/`TextureRect` go through. Measured through Godot 4.6.3 on
a scratch fixture (a `SubViewportContainer` compositing a `ColorRect(0.8, 0.8,
0.8)` that fills its sub-viewport — not a corpus fixture; the numbers below are
what proves the fold, not a specific pixel worth pinning to a golden):

| Tint authored | Composited pixel |
| --- | --- |
| none | rgb(204, 204, 204) |
| `self_modulate = Color(0.5, 0.5, 0.5, 1)` | rgb(102, 102, 102) — 204 × 0.5 exactly |
| ancestor `modulate = Color(0.5, 0.5, 0.5, 1)` **and** that same `self_modulate` | rgb(51, 51, 51) — 204 × 0.5 × 0.5 exactly |

A plain multiply in the same sRGB-authored space the content colour lives in —
not a double gamma application, and not two independent multiplies that
happen to agree only at this pair of values. The painter now folds both
through `useCanvasItemTint({ modulate: WHITE_MODULATE, self_modulate })`, the
identical mechanism every other native painter uses (`TextureRect`,
`ColorRect`, …); `Component.modulate.test.tsx` asserts the resulting material
colour against `sRGB→linear(self_modulate)` rather than re-deriving the byte
math, since `useCanvasItemTint`'s own correctness is established elsewhere.

## Divergences

- **Clipping is a consequence, not an operation.** The container issues no clip;
  content outside the target simply was never rendered, because the texture is
  only `size` pixels. A surface may legitimately overflow the container's own
  box, since Godot Controls do not clip unless `clip_contents`.
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
Strict parsing format-checks these `SubViewportContainer` properties, plus 35 inherited from Control. Every validator failure is an **error**.

| Property |
| --- |
| `stretch` |
| `stretch_shrink` |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-subviewportcontainer-children` | `subviewportcontainer-no-viewport` | warning |
<!-- lint:end -->

Strict and lenient parsing diverge on `stretch_shrink`: the strict parser errors
on anything below 1 (Godot's own setter rejects it), while the lenient parser
warns and falls back to `1`. A non-boolean `stretch` errors strictly and falls
back to `false` leniently. The advisory `subviewportcontainer-no-viewport` rule
covers the structural case no format check can see — a container with no
`SubViewport` child draws nothing at all — and stays silent when a child is an
`instance=` node, whose sub-scene root the linter cannot inspect.
