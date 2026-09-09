---
type: FogVolume
category: 3D
status: unimplemented
fixture: unit-fog-volume.tscn
# image: unit-fog-volume
renders_as: invisible transform-only fallback
---

# FogVolume

Adds a local region of volumetric fog to the world's fog effect, or removes fog from it with a negative-density `FogMaterial`. The previewer does not draw it yet, so the node is an invisible transform-only fallback and its children still show.

## Linting

<!-- lint:begin FogVolume -->
Strict parsing format-checks these `FogVolume` properties, plus 1 inherited from VisualInstance3D, 17 inherited from Node3D, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `material` | null, SubResource("id") or ExtResource("id") |  |
| `shape` | enum 0-4 (ELLIPSOID/CONE/CYLINDER/BOX/WORLD) | warning |
| `size` | Vector3(x, y, z), each >= 0 (>= 0.01 recommended; 1024 ceiling is or_greater, so unbounded above) | warning below |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error |
| `valid-fogvolume-size` | `fogvolume-size-ignored-for-world-shape` | info |
<!-- lint:end -->

The lenient parser reuses `parseNode3D`, which reads only `transform` and `visible`. A `shape = ellipsoid` or a malformed `size = Vector3(-1, 2, 2)` parses with no warning and reaches no in-memory state.

## Known limitations

- **Not drawn** Godot fills the volume with fog. Here the region is empty.
