---
type: AudioListener3D
category: 3D
status: linter-only
fixture: unit-audio-listener-3d.tscn
# image: unit-audio-listener-3d
visual: false
renders_as: nothing (a transform-only group)
---

# AudioListener3D

Sets the point 3D audio is heard from. It draws nothing at runtime, so the previewer renders it as a transform-only group (ADR-0008) and its children still show.

## Linting

<!-- lint:begin AudioListener3D -->
Strict parsing format-checks these `AudioListener3D` properties, plus 17 inherited from Node3D, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `current` | true or false |  |
| `doppler_tracking` | enum 0-2 (DISABLED/IDLE_STEP/PHYSICS_STEP) | warning |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error |
<!-- lint:end -->

The lenient parser never consults `doppler_tracking`, the node's only own property, since nothing reads it for drawing. An out-of-range or non-numeric value has no fallback and is carried through untouched, while strict warns on it.
