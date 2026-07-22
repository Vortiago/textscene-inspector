---
type: RemoteTransform3D
category: 3D
fixture: unit-remote-transform-3d.tscn
image: unit-remote-transform-3d
visual: false
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
