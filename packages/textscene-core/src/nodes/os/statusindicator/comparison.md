---
type: StatusIndicator
category: Other
status: linter-only
fixture: unit-status-indicator.tscn
# image: unit-status-indicator
visual: false
renders_as: nothing (a transform-only group)
---

# StatusIndicator

An OS-level notification-area icon (macOS/Windows only in Godot); it has no in-scene geometry to draw. The previewer renders it as a transform-only group (ADR-0008): its children still show, and that absence is the whole story.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `tooltip` | `"Server status"` | OS tray tooltip text |
| `icon` | `ExtResource("1_icon")` | OS tray icon image |
| `menu` | `NodePath("../TrayMenu")` | native popup menu shown on click |
| `visible` | `true` | whether the OS tray icon is shown |

## Divergences

None visible in this fixture.

## Linting

<!-- lint:begin StatusIndicator -->
Strict parsing format-checks these `StatusIndicator` properties, plus 10 inherited from Node. Every validator failure is an **error**.

| Property | Accepts |
| --- | --- |
| `icon` | null, SubResource("id") or ExtResource("id") |
| `menu` | NodePath("path/to/node") |
| `tooltip` | quoted string |
| `visible` | true or false |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
<!-- lint:end -->

`parser.ts` reuses the plain `parseNode` reader, which never looks at tooltip,
icon, menu or visible — every value, well-formed or not, is carried as inert
text and has no effect on what the previewer draws, since none of this node's
behavior is inside the render surface this previewer covers.
