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

An OS notification-area icon with no in-scene geometry to draw. The previewer renders it as a transform-only group (ADR-0008) and its children still show.

## Linting

<!-- lint:begin StatusIndicator -->
Strict parsing format-checks these `StatusIndicator` properties, plus 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `icon` | null, SubResource("id") or ExtResource("id") |  |
| `menu` | NodePath("path/to/node") |  |
| `tooltip` | quoted string, or the &"…" StringName jacket |  |
| `visible` | true or false |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
<!-- lint:end -->

`index.ts` registers the plain `parseNode` reader, which never looks at `tooltip`, `icon`, `menu` or `visible`. Every value, well-formed or not, is carried as inert text with no effect on what the previewer draws.
