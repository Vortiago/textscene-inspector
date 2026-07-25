---
type: AreaLight3D
category: 3D
group: Lighting
fixture: unit-area-light3d.tscn
image: unit-area-light3d
renders_as: a THREE.RectAreaLight
---

# AreaLight3D

Godot's rectangular area lamp. The previewer renders it as a `THREE.RectAreaLight`
sized from `area_size` and emitting `light_color` at `light_energy`, mounted here
above the box and aimed straight down at the ground. RectAreaLight has no shadow or
range control in three.js, so `shadow_enabled` and `area_range` are parsed but never
drawn.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `light_color` | `Color(0.5, 0.6, 0.7, 1)` | cool tint of the overhead fill our light adds |
| `light_energy` | `4.0` | strength of that fill — lifts the box's shadowed face and top |
| `area_size` | `Vector2(2, 1)` | width × height of the emitter rectangle |
| `area_range` | `2.0` | not represented — RectAreaLight has no range control |
| `shadow_enabled` | `true` | not represented — RectAreaLight casts no shadow |

## Divergences

Godot 4.6.3 parses `AreaLight3D` but emits nothing from it — the node postdates that
build — so its reference is lit by the editor preview sun alone: the box's front face
is a dark blue-gray and the sun's cast shadow is a deep, solid parallelogram. Our
render adds the light from overhead, which lifts that front face to a medium gray,
brightens the top, and fills the cast shadow to a washed, lighter patch. Parity is
unverified — nothing in this repo can compare our AreaLight3D against the engine until
a 4.7 binary sits beside the 4.6 one.
