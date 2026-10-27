---
type: AnimationPlayer
category: 3D
status: limitation
fixture: unit-animation-player.tscn
image: unit-animation-player
renders_as: no geometry of its own, a working driver of other nodes' properties
---

# AnimationPlayer

Godot's keyframe animation driver. It has no geometry of its own, but the previewer plays its clips through a `THREE.AnimationMixer` (ADR-0011). The animated pair above steps through one loop of the `spin` clip, and the box turns in both.

## Linting

<!-- lint:begin AnimationPlayer -->
Strict parsing format-checks these `AnimationPlayer` properties, plus 13 inherited from AnimationMixer, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `autoplay` | quoted string or &"name" |  |
| `blend_times` | Array literal of (from, to, time) triples |  |
| `current_animation` | any value (no format constraint) |  |
| `method_call_mode` | enum 0-1 (DEFERRED/IMMEDIATE) | warning |
| `movie_quit_on_finish` | true or false |  |
| `next/*` | quoted string or &"name" |  |
| `playback/play` | any value (no format constraint) |  |
| `playback_active` | true or false |  |
| `playback_auto_capture` | true or false |  |
| `playback_auto_capture_duration` | float |  |
| `playback_auto_capture_ease_type` | enum 0-3 (IN/OUT/IN_OUT/OUT_IN) | warning |
| `playback_auto_capture_transition_type` | enum 0-11 (LINEAR/SINE/QUINT/QUART/QUAD/EXPO/ELASTIC/CUBIC/CIRC/BOUNCE/BACK/SPRING) | warning |
| `playback_default_blend_time` | float 0-4096 | warning |
| `playback_process_mode` | enum 0-2 (PHYSICS/IDLE/MANUAL) | warning |
| `speed_scale` | float |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-animationplayer-properties` | `animationplayer-autoplay-missing` | warning |
|  | `animationplayer-current-animation-missing` | error |
|  | `animationplayer-inactive` | info |
<!-- lint:end -->

`speed_scale` and `playback_default_blend_time` fall back to `1.0` and `0.0` only when the value fails to parse as a float. `callback_mode_process` and `callback_mode_method` re-check the enum through `enumOr` and fall back to `IDLE` (1) and `DEFERRED` (0). Each has a deprecated 3.x spelling that Godot forwards to the same setter, so the parser reads both spellings into one field. `root_node` defaults to `NodePath("..")` when absent.

A track that names a node of an instanced `.glb` uses the path Godot's importer gives the node (ADR-0058). A transform track on a node that Godot makes a bone composes onto its rest pose. A transform track on a `Skeleton3D` moves its bones and the nodes below it. A track on a `BoneAttachment3D` binds nothing, since the bone sets its transform. A track on a path that names no node binds nothing and logs a warning. A `visible` value track hides the node and what is below it. It plays on a `Node3D`, a `CanvasItem` that is not a `Control`, a GLB node, a `Skeleton3D` and a `BoneAttachment3D`.

## Known limitations

- **Not drawn** Only transform and value tracks play, so `bezier`, `method`, `audio` and nested `animation` tracks are parsed and ignored (ADR-0011).
- **Approximated** Cubic interpolation plays as a smooth spline on transform tracks and as linear on `modulate` and `size` tracks (ADR-0017).
- **Approximated** Per-key `transition` easing plays as linear, so an eased clip reaches the same poses on a different curve (ADR-0017).
- **Not drawn** A `visible` value track on a `Control` plays nothing, since a hidden `Control` also leaves the layout solve, which reads the authored value.
