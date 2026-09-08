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

This node draws nothing at runtime, so the previewer renders it as a transform-only group (ADR-0008): its children still show, and that absence is the whole story. `doppler_tracking` only changes Doppler-shifted audio at runtime, which has no visual counterpart either.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `transform` | `Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0)` | inherited from Node3D; positions the (invisible) listener, no visible effect |
| `doppler_tracking` | `1` (IDLE_STEP) | AudioListener3D's own member; audio-only, no visible effect |

## Divergences

There is no runtime output to compare — the node draws nothing in either Godot or here, by design.

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

`doppler_tracking` is the node's only own property, and it plays no part in what the
lenient parser renders (the node is transform-only, so nothing reads it for drawing):
an out-of-range or non-numeric value here has no fallback to speak of, it is never consulted. Strict parsing still format-checks it, and treats an out-of-range int
as a warning rather than an error, since `set_doppler_tracking` (audio_listener_3d.cpp:146-158)
assigns without a guard — only the property's own `PROPERTY_HINT_ENUM` grounds the check.
