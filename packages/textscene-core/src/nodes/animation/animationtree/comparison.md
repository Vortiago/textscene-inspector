---
type: AnimationTree
category: 3D
status: limitation
fixture: unit-animationtree-blend.tscn
image: unit-animationtree-blend
renders_as: no geometry of its own, a working blend-tree driver
---

# AnimationTree

AnimationTree drives another node's clips through a blend tree and draws no geometry of its own. The previewer evaluates the tree while playing, so two clips from its `AnimationPlayer` are mixed and applied at once (ADR-0019). The stills show the rest pose only.

## Linting

<!-- lint:begin AnimationTree -->
Strict parsing format-checks these `AnimationTree` properties, plus 13 inherited from AnimationMixer, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `advance_expression_base_node` | NodePath("path/to/node") |  |
| `anim_player` | NodePath("path/to/node") |  |
| `parameters/*` | any Variant — the type comes from the live AnimationNode graph, not the .tscn |  |
| `process_callback` | enum 0-2 (PHYSICS/IDLE/MANUAL) | warning |
| `tree_root` | null, SubResource("id") or ExtResource("id") |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-animationtree-properties` | `animationtree-missing-tree-root` | warning |
|  | `animationtree-anim-player-not-found` | warning |
|  | `animationtree-anim-player-wrong-type` | info |
|  | `animationtree-inactive` | info |
<!-- lint:end -->

`active`, `deterministic` and `reset_on_save` fall back to `true` on an unparseable bool, and `root_motion_local` to `false`. The enums re-check membership through `enumOr` and fall back to `IDLE` (1), `DEFERRED` (0) and `FORCE_CONTINUOUS` (2). `audio_max_polyphony` falls back to `32` on a parse failure, but an out-of-range integer passes through unwarned. `tree_root` has no fallback: absent, it stays unset.

## Known limitations

- **Approximated** Blend weights are per clip, not per bone. `AnimationNodeBlend2`'s filter set is not applied, so a filtered blend moves the whole skeleton.
- **Approximated** `AnimationNodeTransition` always takes input 0.
- **Needs runtime** A `StateMachine` root evaluates its start state only. Travel and transition timing are not simulated.
