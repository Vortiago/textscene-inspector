---
type: PopupPanel
category: 2D
fixture: unit-popuppanel-embedded.tscn
renders_as: a panel StyleBox under its Controls, drawn by its embedder with no frame
---

# PopupPanel

A popup with a themed panel background that stretches its children to fit. The previewer draws the
`panel` StyleBox across the window and fits every child Control into the panel's content rect.

## Panel
<!-- compare: image=unit-popuppanel-embedded status=done fixture=unit-popuppanel-embedded.tscn -->

The default panel fills the window, and the child fills the panel inside its content margins.

## Shadow
<!-- compare: image=unit-popuppanel-shadow status=done fixture=unit-popuppanel-shadow.tscn -->

A `panel` StyleBoxFlat with a shadow insets the panel so that the shadow fits inside the window. The
child moves in with the panel.

## Linting

<!-- lint:begin PopupPanel -->
Strict parsing format-checks the inherited set (45 inherited from Window, 47 inherited from Viewport, 10 inherited from Node); `PopupPanel` declares none of its own. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-window-properties` (type-family match) | `window-max-size-below-min-size` | info |
|  | `window-size-clamped-by-limits` | warning |
|  | `window-content-scale-factor-floored` | warning |
<!-- lint:end -->

The lenient parser reads the Window keys with the PopupPanel class defaults: hidden, borderless,
transparent and `wrap_controls` on. A malformed value takes that default.

## Known limitations

- **Needs runtime** A PopupPanel closes when its parent window takes the focus, which only a running
  game shows.
