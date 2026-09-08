---
type: BoneTwistDisperser3D
category: 3D
status: linter-only
fixture: unit-bone-twist-disperser-3d.tscn
# image: unit-bone-twist-disperser-3d
visual: false
renders_as: nothing (a transform-only group)
---

# BoneTwistDisperser3D

Spreads one bone's twist back up its parent chain, so a wrist rotation becomes a smooth spiral through the forearm. It changes only the twist about each joint's axis and draws nothing at runtime, so the previewer renders it as a transform-only group (ADR-0008) and its children still show.

## Linting

<!-- lint:begin BoneTwistDisperser3D -->
Strict parsing format-checks these `BoneTwistDisperser3D` properties, plus 2 inherited from SkeletonModifier3D, 17 inherited from Node3D, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `mutable_bone_axes` | true or false |  |
| `setting_count` | integer >= 0 | error below |
| `settings/*` | settings/<i>/<leaf> and settings/<i>/joints/<j>/<leaf> |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error |
| `valid-skeletonmodifier3d-parent` (type-family match) | `skeletonmodifier3d-parent-not-skeleton3d` | warning |
| `valid-bonetwistdisperser3d-settings` (type-family match) | `bonetwistdisperser3d-setting-index-out-of-range` | error |
|  | `bonetwistdisperser3d-joint-index-out-of-range` | error |
<!-- lint:end -->

The lenient parser reuses `parseNode3D`, so `setting_count` and every `settings/<i>/` value is dropped rather than substituted, with no fallback to name. Strict warns on a `disperse_mode`, `end_bone_direction` or `weight_position` outside its hint, and refuses the read-only `reference_bone_name` and `joints/<j>/bone` keys outright.
