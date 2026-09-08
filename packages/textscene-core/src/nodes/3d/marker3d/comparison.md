---
type: Marker3D
category: 3D
status: unreviewed
fixture: unit-marker-3d.tscn
image: unit-marker-3d
visual: false
renders_as: a selection-gated axis-cross gizmo
---

# Marker3D

A Node3D anchor that positions its children and shows a three-axis cross at its origin in the editor. The previewer draws that cross only when the node is selected (ADR-0018), so a plain capture shows nothing for it.

## Linting

<!-- lint:begin Marker3D -->
Strict parsing format-checks these `Marker3D` properties, plus 17 inherited from Node3D, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `gizmo_extents` | float >= 0 | warning below |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error |
<!-- lint:end -->

The lenient parser reads `gizmo_extents` through `floatOr`, so a non-numeric value warns and falls back to Godot's default of `0.25`. An absent key gets the same `0.25` silently.

## Known limitations

- **Editor only** The axis cross appears only in Godot's editor. Here it is selection-gated.
