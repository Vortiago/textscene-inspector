---
type: RemoteTransform3D
category: 3D
status: linter-only
fixture: unit-remote-transform-3d.tscn
image: unit-remote-transform-3d
renders_as: nothing (a transform-only group that drives its target)
---

# RemoteTransform3D

Pushes its own transform onto the node its `remote_path` names and has no visual of its own. The previewer applies the drive once at load, so the visible cube is the driven target sitting at the relay's position.

## Linting

<!-- lint:begin RemoteTransform3D -->
Strict parsing format-checks these `RemoteTransform3D` properties, plus 17 inherited from Node3D, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

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
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error |
| `valid-remotetransform3d-remote-path` | `remotetransform3d-invalid-remote-path` | warning |
<!-- lint:end -->

`remote_path` is copied verbatim when present, with no NodePath validation, so a malformed literal strict rejects still parses through and drives whatever target string was written. The `update_*` and `use_global_coordinates` flags use `parseOptionalBool`, so anything but the literal `"true"` becomes `false` silently.

## Known limitations

- **Approximated** The relay copies its transform onto the target once at load, so a static `use_global_coordinates`, a cross-instance path or a relay chain is not fully reproduced.
