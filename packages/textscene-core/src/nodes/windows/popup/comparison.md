---
type: Popup
category: 2D
status: done
fixture: unit-popup-embedded.tscn
image: unit-popup-embedded
renders_as: its viewport's target, drawn by its embedder with no frame
---

# Popup

The base of every popup window. A Popup is a Window that is hidden and borderless by default. The
previewer draws a visible Popup's Controls into its target, and its embedder draws the target with no
frame (ADR-0033).

## Linting

<!-- lint:begin Popup -->
Strict parsing format-checks the inherited set (45 inherited from Window, 47 inherited from Viewport, 10 inherited from Node); `Popup` declares none of its own. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-window-properties` (type-family match) | `window-max-size-below-min-size` | info |
|  | `window-size-clamped-by-limits` | warning |
|  | `window-content-scale-factor-floored` | warning |
|  | `window-force-native-refused-while-visible` | error |
<!-- lint:end -->

The lenient parser reads the Window keys with the Popup class defaults: hidden, borderless and
`wrap_controls` on. A malformed value takes that default.

## Known limitations

- **Needs runtime** A Popup closes when its parent window takes the focus, which only a running game
  shows.
