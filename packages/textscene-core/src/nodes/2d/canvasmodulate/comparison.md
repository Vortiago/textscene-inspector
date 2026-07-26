---
type: CanvasModulate
category: 2D
fixture: unit-canvas-modulate.tscn
image: unit-canvas-modulate
status: limitation
group: Canvas effects
renders_as: a colour multiply folded onto its subtree
---

# CanvasModulate

Godot's canvas-wide tint: a single `color` multiplied onto the 2D canvas, used as a cheap
day/night or mood wash. The previewer folds that colour into the modulate inherited by the
node's **subtree** and multiplies it onto each CanvasItem below. The fixture tints a
checkerboard `Sprite2D` with `Color(0.5, 0.5, 1)`, so its white squares should read
periwinkle and its black squares stay black.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `color` | `Color(0.5, 0.5, 1, 1)` | halves red and green, keeps blue — white → periwinkle, black unchanged |

## Divergences

The multiply itself is faithful: white squares tint blue and black squares stay black on
both sides, in the same places. The exact colour is shifted. Godot writes the product
straight to the framebuffer — white `× (0.5, 0.5, 1)` lands at exactly `[128, 128, 255]`.
Ours renders it `[149, 143, 226]`: red and green lifted, blue pulled down. The scene has no
`WorldEnvironment`, so the previewer mounts Godot's editor preview environment (ADR-0025),
whose tonemapping is applied across the whole canvas — the unlit 2D sprites included —
lifting and desaturating the tint, whereas Godot tonemaps only the 3D pass and never the 2D
canvas. It is the same 2D colour lift the Sprite2D and RemoteTransform2D sheets measure.

## Linting

<!-- lint:begin CanvasModulate -->
Strict parsing format-checks these `CanvasModulate` properties, plus 15 inherited from Node2D. Every validator failure is an **error**.

| Property |
| --- |
| `color` |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
<!-- lint:end -->

`color` is the only property, and the lenient parser's `parseColor` falls back to white
`(1, 1, 1, 1)` whenever it is absent or fails the `Color(r, g, b, a)` grammar, logging no
warning either way, unlike the warn-then-fallback `vec2Or`/`boolOr` family used elsewhere in
the codebase.

## Known limitations

- **Scope is the subtree, not the whole canvas.** Godot's CanvasModulate tints every
  CanvasItem in the canvas layer regardless of tree position; ours tints only the nodes
  **below** the CanvasModulate. A sibling outside its subtree is tinted by Godot but not by
  ours — the fixture places the tinted sprite as a child so the two agree.
- **Last-writer-wins is not modelled.** Godot keeps one active CanvasModulate per
  `CanvasLayer` (the last one added wins); ours composes each independently down its own
  subtree, so two CanvasModulates in one layer can differ from Godot.
- **The 2D colour lift above** applies whenever the scene carries no `WorldEnvironment`.
