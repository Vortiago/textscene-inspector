---
type: Path3D
category: 3D
fixture: unit-path3d.tscn
image: unit-path3d
renders_as: a selection-gated curve gizmo
---

# Path3D

`Path3D` holds a `Curve3D` that its descendants can ride. Its only visual is the
curve polyline, a selection-gated editor gizmo (ADR-0018), so a plain capture
draws nothing for the path itself — exactly as Godot draws no path line while
running. The fixture parents an orange marker sphere at each of the four curve
points, so the arch shape reads even though the line is absent.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `curve` | `Curve3D`, 4 points `(-1.7,0.3,0) → (-0.7,1.35,0) → (0.7,1.35,0) → (1.7,0.3,0)` | defines a symmetric arch; the polyline is a selection-gated gizmo, so nothing is drawn for it here — the four marker spheres trace where the points sit |

## Divergences

Shadow filtering differs. In Godot the marker spheres and the reference cube cast
smooth, soft grey shadows onto the ground, including distinct discs beneath the
markers. In this previewer the cube's ground shadow is dithered and speckled and
the marker shadow discs are faint to absent — the injected preview sun's shadow
map has a lower resolution and coarser filter than Godot's, so its edges alias
where Godot's stay soft. The arch of markers, the reference cube, and the ground
plane match in both frames; the path line is gated off in both, a match rather
than a divergence.

## Linting

<!-- lint:begin Path3D -->
Strict parsing format-checks these `Path3D` properties, plus 16 inherited from Node3D. Every validator failure is an **error**.

| Property | Accepts |
| --- | --- |
| `curve` | SubResource("id") or ExtResource("id") |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error, warning |
| `valid-path3d` | `path3d-requires-curve` | error |
|  | `valid-path3d-resources` | error |
|  | `path3d-unused` | warning |
|  | `curve3d-loadable` | error |
<!-- lint:end -->

`curve` is the only property, and the lenient parser does no substitution: it
copies the raw resource-reference string through when present, performs no
format check on it, and leaves the property unset when absent: no default
value, no warning either way.
