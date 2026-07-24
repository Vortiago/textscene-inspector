---
type: RemoteTransform3D
category: 3D
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

## Known limitations

The relay copies its transform onto its `remote_path` target once on load (the static enter-tree effect, not per-frame). Three cases are not fully reproduced:

- **`use_global_coordinates = false`** — a no-op on a static load; only the default global-coordinate drive repositions the target (measured against Godot 4.6.3).
- **Cross-instance `remote_path`** — a path crossing into or out of an instanced sub-scene is left unresolved; in-scene resolution (the common case) works.
- **Relay chains** — resolve in document (pre-order) order; a feedback loop is not iterated to a fixed point.
