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

## Divergences

- **Content stops updating once it has settled.** `readRenderTargetPixels` is a
  synchronous GPU stall, so the surface samples the target on a bounded
  schedule (an opening animation frame, then `BLIT_ATTEMPTS` × 350 ms, the
  visual harness's own settle window) and then stops. It re-arms on a new
  target or a fresh parse. An `AnimationPlayer` running inside a sub-viewport
  therefore shows its settled frame in the surface, while the same animation
  drawn directly in the canvas keeps moving.
- **`stretch = true` lays content out against the authored `SubViewport.size`,
  not the container's rect.** Godot's `recalc_force_viewport_sizes` overwrites
  the child viewport's size with `get_size() / stretch_shrink` before it
  renders; the previewer's publisher sizes the target from the serialized
  `size` and the surface scales the result to the container's box. The drawn
  rect is right and the framing is not: a `399x480` sub-viewport in a `576x648`
  container shows less of its world than Godot does, stretched to fit.
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

## Linting

<!-- lint:begin SubViewportContainer -->
Strict parsing format-checks these `SubViewportContainer` properties, plus 28 inherited from Control. Every validator failure is an **error**.

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
