---
type: RemoteTransform2D
category: 2D
status: linter-only
fixture: unit-remote-transform-2d.tscn
image: unit-remote-transform-2d
renders_as: nothing itself, it copies its transform onto its remote_path target
---

# RemoteTransform2D

RemoteTransform2D draws nothing and copies its transform onto the node `remote_path`
names. The previewer applies that once on load, the static enter-tree effect, so the
target jumps to the relay's position.

## Linting

<!-- lint:begin RemoteTransform2D -->
Strict parsing format-checks these `RemoteTransform2D` properties, plus 12 inherited from Node2D, 16 inherited from CanvasItem, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `remote_path` | NodePath("path/to/node") |  |
| `update_position` | true or false |  |
| `update_rotation` | true or false |  |
| `update_scale` | true or false |  |
| `use_global_coordinates` | true or false |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
| `valid-remotetransform2d-remote-path` | `remotetransform2d-invalid-remote-path` | warning |
<!-- lint:end -->

`remote_path` is stored as whatever string is present, with no NodePath check.
`update_position`, `update_rotation`, `update_scale` and `use_global_coordinates` stay
`undefined` when absent and otherwise become `false` for any value that does not read as
`true`, with no warning.

## Known limitations

- **Approximated** `use_global_coordinates = false` is a no-op on a static load. Only
  the default global drive repositions the target.
- **Approximated** A `remote_path` crossing into or out of an instanced sub-scene is
  left unresolved.
- **Approximated** Relay chains resolve in document order, and a feedback loop is not
  iterated to a fixed point.
