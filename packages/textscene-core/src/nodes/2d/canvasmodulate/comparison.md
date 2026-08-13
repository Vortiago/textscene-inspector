---
type: CanvasModulate
category: 2D
status: unreviewed
fixture: unit-canvas-modulate.tscn
image: unit-canvas-modulate
group: Canvas effects
renders_as: a colour multiply applied to the whole canvas
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

The multiply is faithful and the frame matches to a mean channel error of
0.43/255: white squares tint blue and black squares stay black on both sides, in
the same places, and white `× (0.5, 0.5, 1)` lands on Godot's exact
`[128, 128, 255]`.

An earlier revision of this sheet measured `[149, 143, 226]` there and blamed the
ADR-0025 preview environment. That was wrong on both counts — the 2D stage never
mounts a preview environment — and the real cause, react-three-fiber's default
ACES tone mapping on the stage's own `<Canvas>`, is now switched off. See
"Why 2D colours used to read paler in our captures" in the comparison README.

## Known limitations

Two consequences of Godot applying the colour to the CANVAS
(`RS::canvas_set_modulate` on ENTER_CANVAS) rather than to a subtree:

- The colour is collected by walking the AUTHORED node tree, so a CanvasModulate
  living inside an instanced sub-scene is not found. Godot would apply it.
- Godot multiplies the composited canvas; the previewer multiplies each canvas
  item as it draws. The two agree wherever content is opaque, and differ
  marginally where alpha-blended items overlap each other.

## Linting

<!-- lint:begin CanvasModulate -->
Strict parsing format-checks these `CanvasModulate` properties, plus 12 inherited from Node2D, 16 inherited from CanvasItem, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `color` | Color(r, g, b, a) |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
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
