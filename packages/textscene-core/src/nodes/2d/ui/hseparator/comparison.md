---
type: HSeparator
category: 2D
status: unimplemented
fixture: unit-h-separator.tscn
# image: unit-h-separator
renders_as: invisible transform-only fallback
---

# HSeparator

HSeparator is a horizontal line between vertically stacked controls, drawn from a
`StyleBoxLine` sized by the `separation` constant. The previewer parses and validates it
but does not draw it, so it renders as a transform-only fallback and its children still
show.

## Linting

<!-- lint:begin HSeparator -->
Strict parsing format-checks the inherited set (53 inherited from Control, 16 inherited from CanvasItem, 10 inherited from Node); `HSeparator` declares none of its own. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
| `valid-control-properties` (type-family match) | `control-tooltip-ignored-by-mouse-filter` | warning |
|  | `control-property-order` | warning |
<!-- lint:end -->

HSeparator binds no property of its own, only theme items, so `linterParser.ts` declares
nothing for it. The strict and lenient parsers agree on every key, since `index.ts`
reuses `parseControl` unchanged.

## Known limitations

- **Not drawn** Godot draws the separator line. The previewer draws nothing for this
  node.
