---
type: PopupPanel
category: Other
status: unimplemented
fixture: unit-popup-panel.tscn
# image: unit-popup-panel
renders_as: nothing yet, not implemented
---

# PopupPanel

A popup with a themed panel background that stretches its children to fit. The previewer parses and validates it but does not draw it, so it mounts as an invisible transform-only group.

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

PopupPanel declares no property of its own. The lenient parser registers the plain `Node` reader. A negative inherited `size` component or an unquoted `title` is never read, substituted or reported on the lenient path.

## Known limitations

- **Not drawn** Godot displays the panel once shown. The previewer draws nothing for it.
