---
type: RemoteTransform2D
category: 2D
status: linter-only
fixture: unit-remote-transform-2d.tscn
image: unit-remote-transform-2d
renders_as: nothing itself; it copies its transform onto its remote_path target
---

# RemoteTransform2D

Godot's transform relay: it draws nothing of its own but writes its own transform
onto the node its `remote_path` names. The previewer resolves this once over the
authored tree on load — the static enter-tree effect, not per-frame — so the relay
is invisible and its target jumps to the relay's position. Here two identical
pentagons are authored at the same spot; the relay at `(760, 210)` drags
`TargetPolygon` up to the right while `AuthoredGhost` stays behind to mark where it
was authored.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `Relay.position` | `Vector2(760, 210)` | the transform copied onto the target — where the blue pentagon lands |
| `Relay.remote_path` | `NodePath("../TargetPolygon")` | the node the relay drives, default global coordinates |
| `TargetPolygon.color` | `Color(0.2, 0.7, 0.9, 1)` | the driven, blue pentagon |
| `AuthoredGhost.color` | `Color(0.5, 0.5, 0.5, 0.35)` | the undriven ghost left at the authored `(320, 440)` |

## Divergences

The relay itself is faithful — the blue pentagon lands at the same upper-right spot
in both images, so the default global-coordinate drive is reproduced.
One visible difference remains, in the polygon fill rather than its placement:

- **The blue pentagon reads paler and less saturated in ours.** Godot writes
  `0.2, 0.7, 0.9` as exactly `51, 178, 229`; ours renders `95, 191, 217`, and the
  semi-transparent ghost carries the same lift faintly (`93` to `98`).
  See "Why 2D colours read paler in our captures" in docs/comparison/README.md.

## Linting

<!-- lint:begin RemoteTransform2D -->
Strict parsing format-checks these `RemoteTransform2D` properties, plus 12 inherited from Node2D, 16 inherited from CanvasItem, 10 inherited from Node. Every validator failure is an **error**.

| Property | Accepts |
| --- | --- |
| `remote_path` | NodePath("path/to/node") |
| `update_position` | true or false |
| `update_rotation` | true or false |
| `update_scale` | true or false |
| `use_global_coordinates` | true or false |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
| `valid-remotetransform2d-remote-path` | `remotetransform2d-invalid-remote-path` | warning |
<!-- lint:end -->

`remote_path` is stored as whatever string is present, with no NodePath-format
check. `update_position`, `update_rotation`, `update_scale`, and
`use_global_coordinates` stay `undefined` when absent, but once present resolve to
`value === 'true'` with no warning, so any string other than the literal `true`
(including `false`, `1`, or a typo) silently becomes `false` rather than staying
unset.

## Known limitations

The relay copies its transform onto its `remote_path` target once on load, not
per frame. Three cases are not fully reproduced (static `use_global_coordinates`,
cross-instance paths, relay chains); see "What a RemoteTransform relay does not
reproduce" in docs/comparison/README.md.
