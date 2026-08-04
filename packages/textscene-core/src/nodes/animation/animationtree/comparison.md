---
type: AnimationTree
category: 3D
status: limitation
fixture: unit-animationtree-blend.tscn
image: unit-animationtree-blend
renders_as: no geometry of its own; a working blend-tree driver
---

# AnimationTree

AnimationTree drives another node's clips through a blend tree and draws no
geometry of its own. The previewer really evaluates it: selecting the node and
playing runs the blend program, so two clips from the `AnimationPlayer` it
points at are mixed and applied at once (ADR-0019).

The images here are stills and show only the authored rest pose — the reference
harness sets `active = false` before every capture, so a frozen frame says
nothing about playback either way. Unlike AnimationPlayer, no animated capture
exists yet to compare frame by frame: `capture-animation.mjs` can only drive an
`AnimationPlayer`, so the blending below is verified by unit tests and by hand,
not by a Godot-vs-ours GIF.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `tree_root` | `AnimationNodeBlendTree` | the blend program: spin and bob, mixed and applied together during playback |
| `anim_player` | `NodePath("../AnimationPlayer")` | the driver whose clips it blends |
| `active` | `true` | the tree processes; the still capture deactivates it |
| `parameters/blend/blend_amount` | `0.5` | 50/50 spin+bob mix, applied while playing |

## Divergences

Nothing visible in this still — it is a rest pose by construction. The known
gaps are in the blend program rather than the frame, so they are listed:

- **Blend weights are per clip, not per bone.** `AnimationNodeBlend2`'s filter
  set is not applied, so a tree that blends one clip into a subset of bones
  affects the whole skeleton here (ADR-0019).
- **`AnimationNodeTransition` always takes input 0.** Selecting another input
  is a runtime state change the previewer does not model.
- **State machines do not travel.** A `StateMachine` root evaluates its current
  state; `travel()` and transition timing are not simulated.

An animated capture would settle the rest: `capture-animation.mjs` currently
hardcodes `AnimationPlayer` as the driver, so it cannot select an
`AnimationTree` or set `active = true` on one.

## Linting

<!-- lint:begin AnimationTree -->
Strict parsing format-checks these `AnimationTree` properties, plus 10 inherited from Node. Every validator failure is an **error**.

| Property | Accepts |
| --- | --- |
| `active` | true or false |
| `advance_expression_base_node` | NodePath("path/to/node") |
| `anim_player` | NodePath("path/to/node") |
| `audio_max_polyphony` | integer 0-128 |
| `callback_mode_discrete` | enum 0-2 (DOMINANT/RECESSIVE/FORCE_CONTINUOUS) |
| `callback_mode_method` | enum 0-1 (DEFERRED/IMMEDIATE) |
| `callback_mode_process` | enum 0-2 (PHYSICS/IDLE/MANUAL) |
| `deterministic` | true or false |
| `process_callback` | enum 0-2 (PHYSICS/IDLE/MANUAL) |
| `reset_on_save` | true or false |
| `root_motion_local` | true or false |
| `root_motion_track` | NodePath("path/to/node") |
| `root_node` | NodePath("path/to/node") |
| `tree_root` | SubResource("id") or ExtResource("id") |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-animationtree-properties` | `animationtree-missing-tree-root` | warning |
|  | `animationtree-tree-root-not-found` | error |
|  | `animationtree-missing-anim-player` | warning |
|  | `animationtree-anim-player-not-found` | warning |
|  | `animationtree-anim-player-wrong-type` | warning |
|  | `animationtree-active-but-incomplete` | warning |
|  | `animationtree-inactive` | warning |
<!-- lint:end -->

`active`, `deterministic`, and `reset_on_save` fall back to `true` on an
unparseable bool (warning first), and `root_motion_local` falls back to
`false`. `process_callback`, `callback_mode_process`, `callback_mode_method`,
and `callback_mode_discrete` are the enums: `enumOr` re-checks strict's
membership, warning and substituting `IDLE` (1), `IDLE` (1), `DEFERRED` (0),
and `FORCE_CONTINUOUS` (2) respectively for any out-of-range value.
`audio_max_polyphony` falls back to `32` on a parse failure, but strict's
`0`-`128` bound (animation_mixer.cpp:542, `ERR_FAIL_COND(p_audio_max_polyphony
< 0 || ... > 128)`) has no lenient counterpart, so an out-of-range integer
passes through unwarned. `anim_player`, `root_motion_track`,
`advance_expression_base_node`, and `root_node` default to fixed `NodePath`
literals when absent, but when present the raw string is stored verbatim with
no NodePath-grammar check, unlike strict's regex validator. `tree_root` has no
fallback at all: absent, it stays unset entirely; present, its value is
stored as-is with no resource-reference format check.
