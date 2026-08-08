---
type: XRHandModifier3D
category: 3D
status: linter-only
fixture: unit-xr-hand-modifier-3d.tscn
# image: unit-xr-hand-modifier-3d
visual: false
renders_as: nothing (a transform-only group)
---

# XRHandModifier3D

XRHandModifier3D poses the bones of its parent Skeleton3D from an XRHandTracker's
joint data. It draws nothing of its own, so the previewer renders it as a
transform-only group (ADR-0008): its children still show, and that absence is the
whole story.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `hand_tracker` | `&"/user/hand_tracker/right"` | none: names which XRHandTracker to read, and no XR runtime registers one here |
| `bone_update` | `1` | none: BONE_UPDATE_ROTATION_ONLY would rotate the bones without moving them, but nothing poses the skeleton |
| `influence` | `0.75` | none: SkeletonModifier3D's blend weight, and there is no modification to blend |

## Divergences

A previewer has no XR runtime, so no tracker ever supplies joint data, the modifier
never runs, and nothing in the scene moves.

## Linting

<!-- lint:begin XRHandModifier3D -->
Strict parsing format-checks these `XRHandModifier3D` properties, plus 2 inherited from SkeletonModifier3D, 16 inherited from Node3D, 10 inherited from Node. Every validator failure is an **error**.

| Property | Accepts |
| --- | --- |
| `bone_update` | enum 0-1 (FULL/ROTATION_ONLY) |
| `hand_tracker` | quoted string or &"name" |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error |
| `valid-skeletonmodifier3d-parent` (type-family match) | `skeletonmodifier3d-parent-not-skeleton3d` | warning |
<!-- lint:end -->

XRHandModifier3D reuses `parseNode3D` (the Node3D base parser) rather than a parser
of its own, and that parser only reads `transform` and `visible`. It never looks at
`hand_tracker` or `bone_update`, so where strict linting rejects a value the lenient
parser substitutes nothing: there is no fallback because it never records the key.
`bone_update = 2` is the sharpest case. Godot's `set_bone_update` refuses the value
outright and keeps the previous mode, while the previewer simply carries on with a
node it never asked to pose anything.
