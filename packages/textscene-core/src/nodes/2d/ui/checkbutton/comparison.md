---
type: CheckButton
category: 2D
status: unreviewed
fixture: unit-check-button.tscn
# image: unit-check-button
renders_as: a toggle-switch icon followed by a text run
---

# CheckButton

CheckButton is a labelled on-off switch. The previewer draws the theme's
toggle-switch icon flush against the right edge and the label to its left, with no
StyleBox chrome (CheckButton's own StyleBoxes are all a `StyleBoxEmpty`).

## Linting

<!-- lint:begin CheckButton -->
Strict parsing format-checks the inherited set (13 inherited from Button, 10 inherited from BaseButton, 53 inherited from Control, 16 inherited from CanvasItem, 10 inherited from Node); `CheckButton` declares none of its own. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
| `valid-control-properties` (type-family match) | `control-tooltip-ignored-by-mouse-filter` | warning |
|  | `control-property-order` | warning |
| `valid-button-group` (type-family match) | `button-group-without-toggle-mode` | warning |
<!-- lint:end -->

CheckButton binds no new property beyond Button's, only theme items, so the strict and
lenient parsers agree on every key Button's parser reads. The lenient parser also reads
`button_pressed` (a BaseButton property) for the on/off state of the switch.

## Known limitations

- **Not drawn** Button's inherited `icon` property (distinct from the toggle glyph) is
  parsed but never drawn.
- **Approximated** The label's paragraph direction is not applied, so under
  `layout_direction = 3` or `text_direction = 2` a right-to-left script, or a label
  ending in punctuation, keeps left-to-right glyph order. Which side the label, the
  icon and the chrome sit on does follow the layout direction.
