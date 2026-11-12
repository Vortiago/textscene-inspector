---
type: RemoteTransform2D
category: 2D
status: limitation
fixture: unit-remote-transform-2d.tscn
image: unit-remote-transform-2d
renders_as: nothing itself, it copies its transform onto its remote_path target
---

# RemoteTransform2D

RemoteTransform2D draws nothing and copies its transform onto the node `remote_path`
names. The previewer applies that over the live scene tree, so the target jumps to the
relay's position, also across an instanced scene boundary.

A relay below a Control composes the Control where its offsets state its position, with its rotation and scale. A relay below a Bone2D that a modification stack moves pushes the pose the stack solves.
Godot's Skeleton2D sets the bone before the relay pushes.

A relay pushes again each time its own global transform changes, so a relay chain
settles as in Godot, whatever its order in the file. A relay cycle draws the
frame that `pnpm ref:godot` captures, as `docs/comparison/README.md` explains, and the
linter warns on each relay of the cycle.

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
|  | `remotetransform2d-relay-cycle` | warning |
<!-- lint:end -->

`remote_path` is stored as whatever string is present, with no NodePath check.
`update_position`, `update_rotation`, `update_scale` and `use_global_coordinates` stay
`undefined` when absent and otherwise become `false` for any value that does not read as
`true`, with no warning.

## Known limitations

- **Needs runtime** A relay cycle moves on every frame in Godot, and the previewer shows one frame of that motion.
- **Approximated** A relay in global coordinates pushes nothing below a Control with a pivot offset or one that a Container lays out.
