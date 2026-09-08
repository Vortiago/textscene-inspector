---
type: ConvertTransformModifier3D
category: 3D
status: linter-only
fixture: unit-convert-transform-modifier-3d.tscn
# image: unit-convert-transform-modifier-3d
visual: false
renders_as: nothing (a transform-only group)
---

# ConvertTransformModifier3D

Reads one scalar off a reference bone or node: a position, a roll or a scale. It remaps that value from the reference range onto the apply range and writes it back as a different kind of transform on the apply bone. It draws nothing at runtime, so the previewer renders it as a transform-only group (ADR-0008) and its children still show.

## Linting

<!-- lint:begin ConvertTransformModifier3D -->
Strict parsing format-checks these `ConvertTransformModifier3D` properties, plus 1 inherited from BoneConstraint3D, 2 inherited from SkeletonModifier3D, 17 inherited from Node3D, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `setting_count` | integer >= 0 | error below |
| `settings/*` | per-setting apply/ and reference/ transform_mode, axis, range_min, range_max, plus relative, additive and the BoneConstraint3D leaves |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error |
| `valid-skeletonmodifier3d-parent` (type-family match) | `skeletonmodifier3d-parent-not-skeleton3d` | warning |
| `valid-converttransformmodifier3d-ranges` (type-family match) | `converttransformmodifier3d-range-outside-mode-hint` | warning |
<!-- lint:end -->

ConvertTransformModifier3D registers `parseNode3D` directly, so `setting_count` and every `settings/<i>/` leaf is validated but never read into the scene tree. An out-of-range `range_min` is reported as a warning and then dropped rather than substituted.
