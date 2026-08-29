---
type: PopupPanel
category: Other
status: unimplemented
fixture: unit-popup-panel.tscn
# image: unit-popup-panel
renders_as: nothing yet, not implemented
---

# PopupPanel

A popup with a themed panel background that stretches its children to fit, like
`PanelContainer`. The previewer parses and validates this node but does not draw
it yet, so it renders as an invisible transform-only fallback and its children
still show.

## Properties exercised

PopupPanel declares no serialisable property of its own: `_bind_methods`
(popup.cpp:427-428) binds only a ThemeDB theme-cache item, not an `ADD_PROPERTY`,
and `PopupPanel.xml`'s two `<member>`s are both `overrides=` default values, not
own properties. That absence is itself the fact this sheet records. Every row
below is a property inherited from `Popup`/`Window`, exercised at a value that is
legal for a PopupPanel to carry.

| Property | Value | Effect |
| --- | --- | --- |
| `title` | `"Sample Popup"` | not drawn yet, inherited from Window |
| `size` | `Vector2i(320, 240)` | not drawn yet, inherited from Window |
| `visible` | `true` | not drawn yet, inherited from Window |
| `transient` | `true` | not drawn yet, inherited from Window |
| `theme_override_styles/panel` | `SubResource("StyleBoxFlat_1")` | not drawn yet, inherited from Window's dynamic theme-override property list, generated for this class because PopupPanel alone binds a "panel" stylebox item |

## Divergences

Not captured yet.

## Linting

<!-- lint:begin PopupPanel -->
Strict parsing format-checks the inherited set (45 inherited from Window, 47 inherited from Viewport, 10 inherited from Node); `PopupPanel` declares none of its own. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-window-properties` (type-family match) | `window-max-size-below-min-size` | warning |
<!-- lint:end -->

The lenient parser (`parser.ts`) reuses the plain `Node` parse: it reads only the
`[node]` heading's `name`/`parent`/`instance`/`index` attributes plus an optional
`transform`, and never looks at `size`, `title`, or any other PopupPanel/Window
property at all. A malformed value the strict linter above rejects, such as a
negative `size` component or an unquoted `title`, is never read, substituted, or
reported on the lenient path; the node still renders as the same empty
transform-only group either way.
