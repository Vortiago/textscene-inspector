---
type: AnimationTree
category: 3D
fixture: unit-animationtree-blend.tscn
image: unit-animationtree-blend
renders_as: an empty group (a non-visual driver)
---

# AnimationTree

AnimationTree is a non-visual node — it drives another node's clips through a
blend tree but draws no geometry of its own. The previewer mounts it as an empty
group, so the only thing on screen is the `Mesh` box at its authored transform.
A static preview never ticks the tree, and the reference harness deactivates it,
so both images show the same authored rest pose: an upright, axis-aligned box.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `tree_root` | `AnimationNodeBlendTree` | the blend program (spin + bob); reshapes the Mesh only during playback |
| `anim_player` | `NodePath("../AnimationPlayer")` | the driver whose clips it blends; no static effect |
| `active` | `true` | tree may process, but a static preview never runs it; no visual |
| `parameters/blend/blend_amount` | `0.5` | 50/50 spin+bob mix, applied only while playing |

## Divergences

None visible in this fixture.

## Linting

<!-- lint:begin AnimationTree -->
Strict parsing format-checks these `AnimationTree` properties. Every validator failure is an **error**.

| Property |
| --- |
| `active` |
| `advance_expression_base_node` |
| `anim_player` |
| `audio_max_polyphony` |
| `callback_mode_discrete` |
| `callback_mode_method` |
| `callback_mode_process` |
| `deterministic` |
| `process_callback` |
| `reset_on_save` |
| `root_motion_local` |
| `root_motion_track` |
| `root_node` |
| `tree_root` |

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
|  | `animationtree-low-audio-polyphony` | warning |
|  | `animationtree-high-audio-polyphony` | warning |
<!-- lint:end -->

`active`, `deterministic`, and `reset_on_save` fall back to `true` on an
unparseable bool (warning first), and `root_motion_local` falls back to
`false`. `process_callback`, `callback_mode_process`, `callback_mode_method`,
and `callback_mode_discrete` are the enums: `enumOr` re-checks strict's
membership, warning and substituting `IDLE` (1), `IDLE` (1), `DEFERRED` (0),
and `FORCE_CONTINUOUS` (2) respectively for any out-of-range value.
`audio_max_polyphony` falls back to `32` on a parse failure, but strict's
`1`-`512` bounds have no lenient counterpart, so an out-of-range integer
passes through unwarned. `anim_player`, `root_motion_track`,
`advance_expression_base_node`, and `root_node` default to fixed `NodePath`
literals when absent, but when present the raw string is stored verbatim with
no NodePath-grammar check, unlike strict's regex validator. `tree_root` has no
fallback at all: absent, it stays unset entirely; present, its value is
stored as-is with no resource-reference format check.
