---
type: Popup
category: Other
status: unimplemented
fixture: unit-popup.tscn
# image: unit-popup
renders_as: nothing yet, not implemented
---

# Popup

The base of every popup window. The previewer parses and validates it but does not draw it, so it mounts as an invisible transform-only group and its children still show.

## Linting

<!-- lint:begin Popup -->
Strict parsing format-checks the inherited set (45 inherited from Window, 47 inherited from Viewport, 10 inherited from Node); `Popup` declares none of its own. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-window-properties` (type-family match) | `window-max-size-below-min-size` | info |
|  | `window-size-clamped-by-limits` | warning |
|  | `window-content-scale-factor-floored` | warning |
<!-- lint:end -->

Popup declares no property of its own. The lenient parser registers the plain `Node` reader, which reads only the heading attributes and an optional `transform`. An inherited Window key such as `size` is never read or substituted.

## Known limitations

- **Not drawn** Godot displays the popup once shown. The previewer draws nothing for it.
