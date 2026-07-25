---
type: Sprite3D
category: 3D
fixture: unit-sprite3d.tscn
image: unit-sprite3d
renders_as: an unlit textured THREE.Mesh quad
---

# Sprite3D

Sprite3D draws a 2D texture on a quad in 3D space. The previewer renders it as an
unlit textured plane (`meshBasicMaterial`), sized by `pixel_size` × the texture,
with `modulate` driving colour and opacity and `billboard` applied as a per-frame
look-at. The fixture shows three "F" markers over the preview sky: a plain blue
one, an orange-tinted billboard that faces the camera, and a semi-transparent
blue-tinted one.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `texture` | `ExtResource` (96×96 "F" marker) | the image drawn on each quad |
| `pixel_size` | `0.01` | quad size — 96 px × 0.01 ≈ 0.96 units square |
| `billboard` | `1` (middle) | quad turns to face the camera — seen flat and frontal, not foreshortened like its neighbours |
| `modulate` | `Color(1, 0.7, 0.4, 1)` (middle) | orange tint multiplies the texture — dark square with an orange F |
| `modulate` | `Color(0.4, 0.7, 1, 0.6)` (right) | blue tint at 0.6 alpha — a semi-transparent blue quad |

## Divergences

None visible in this fixture.
