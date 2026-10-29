---
type: XRBodyModifier3D
category: 3D
status: limitation
fixture: unit-xr-body-modifier-3d.tscn
# image: unit-xr-body-modifier-3d
visual: false
renders_as: nothing (a transform-only modifier that has no XR tracker to read)
---

# XRBodyModifier3D

Poses the bones of its parent Skeleton3D from an XRBodyTracker registered with XRServer. With no headset there is no tracker to read, so Godot changes no bone, and nor does the previewer. The Skeleton3D pass reads `active` and `influence` from it and makes no edit.

## Linting

<!-- lint:begin XRBodyModifier3D -->
Strict parsing format-checks these `XRBodyModifier3D` properties, plus 2 inherited from SkeletonModifier3D, 17 inherited from Node3D, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `body_tracker` | quoted string or &"name" |  |
| `body_update` | bit mask of BODY_UPDATE_UPPER_BODY (1) \| BODY_UPDATE_LOWER_BODY (2) \| BODY_UPDATE_HANDS (4) |  |
| `bone_update` | enum 0-1 (BONE_UPDATE_FULL/BONE_UPDATE_ROTATION_ONLY) | error |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error |
| `valid-skeletonmodifier3d-parent` (type-family match) | `skeletonmodifier3d-parent-not-skeleton3d` | warning |
<!-- lint:end -->

The parser reads `active` and `influence`, and leaves `body_tracker`, `body_update` and `bone_update` unread, as no tracker feeds them. Strict errors on `bone_update = 2`, which Godot's setter refuses, and only warns on an unlisted `body_update` bit.

## Known limitations

- **Needs runtime** Godot poses the skeleton from a live XR body tracker, but here no tracker exists, so no bone moves.
