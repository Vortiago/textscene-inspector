---
type: FogVolume
category: 3D
status: unimplemented
fixture: unit-fog-volume.tscn
# image: unit-fog-volume
renders_as: invisible transform-only fallback
---

# FogVolume

Adds a localized region of volumetric fog (or, with a negative-density
FogMaterial, removes it) into the world's volumetric fog effect. The previewer
parses and validates this node but does not draw it yet, so it renders as an
invisible transform-only fallback and its children still show.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| shape | `2` (CYLINDER) | Selects the local volume shape the fog is bounded to. |
| size | `Vector3(4, 3, 4)` | Local-space extents of the fog volume for every shape but World. |
| material | `SubResource("FogMaterial_1")` | The FogMaterial controlling density/color/emission inside the volume. |

## Divergences

None visible in this fixture.

## Linting

<!-- lint:begin FogVolume -->
<!-- lint:end -->

The lenient parser reuses `parseNode3D`, which reads only `transform` and
`visible` and silently ignores every FogVolume-specific key — `shape =
ellipsoid` or a malformed `size = Vector3(-1, 2, 2)` parses with no warning and
never reaches any in-memory state, the same as a value Godot's own class never
declared. Only the strict parser (`linterParser.ts`) tells the two apart.
