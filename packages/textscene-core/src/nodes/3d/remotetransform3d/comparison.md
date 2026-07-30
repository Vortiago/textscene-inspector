---
type: RemoteTransform3D
category: 3D
status: linter-only
fixture: unit-remote-transform-3d.tscn
image: unit-remote-transform-3d
renders_as: nothing (a transform-only group that drives its target)
---

# RemoteTransform3D

A RemoteTransform3D pushes its own transform onto the node its `remote_path`
names; it has no visual of its own. The previewer draws nothing for the relay and
applies the drive statically at load, so the visible cube is the driven target
sitting at the relay's position, not the relay itself.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `remote_path` | `../TargetCube` | names the node the relay drives |
| `transform` origin | `(2, 0, 0)` | copied onto TargetCube, moving it from its authored `x = -2` to `x = 2` |

## Divergences

None visible in this fixture.

## Linting

<!-- lint:begin RemoteTransform3D -->
Strict parsing format-checks these `RemoteTransform3D` properties, plus 16 inherited from Node3D. Every validator failure is an **error**.

| Property |
| --- |
| `remote_path` |
| `update_position` |
| `update_rotation` |
| `update_scale` |
| `use_global_coordinates` |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error, warning |
<!-- lint:end -->

`remote_path` is copied verbatim onto the result when present, with no
NodePath validation, so a malformed literal that strict rejects as an error
still parses through unchanged and drives whatever target string was
written. The four flags (`update_position`, `update_rotation`, `update_scale`,
`use_global_coordinates`) use `parseOptionalBool`: an absent flag leaves the
property unset, and a present-but-invalid value (anything besides the
literal `"true"`) becomes `false` silently, with no warning.

## Known limitations

The relay copies its transform onto its `remote_path` target once on load, not
per frame. Three cases are not fully reproduced (static `use_global_coordinates`,
cross-instance paths, relay chains); see "What a RemoteTransform relay does not
reproduce" in docs/comparison/README.md.
