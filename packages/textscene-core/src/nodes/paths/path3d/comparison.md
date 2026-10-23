---
type: Path3D
category: 3D
status: done
fixture: unit-path3d.tscn
image: unit-path3d
renders_as: a curve gizmo for every node
---

# Path3D

Holds a `Curve3D` that its descendants can ride. Its only visual is the curve polyline, an editor gizmo drawn for every node, faint while unselected (ADR-0056). A capture keeps the Gizmos toggle off, so a plain capture draws nothing for the path itself. The fixture's marker spheres trace the arch in both frames.

## Linting

<!-- lint:begin Path3D -->
Strict parsing format-checks these `Path3D` properties, plus 17 inherited from Node3D, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `curve` | null, SubResource("id"), ExtResource("id") or Resource("path") |  |
| `debug_custom_color` | Color(r, g, b, a), or the colour string or int it converts |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error |
| `valid-path3d` | `path3d-requires-curve` | info |
|  | `curve3d-loadable` | error |
<!-- lint:end -->

`curve` is the only property, and the lenient parser copies the raw resource-reference string through with no format check. Absent, it stays unset with no default and no warning.

## Known limitations

- **Editor only** The curve polyline draws with the Gizmos toggle on, and Godot draws no path line while running.
