---
type: RemoteTransform2D
category: 2D
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

- **The blue pentagon reads paler and less saturated in ours.** Godot writes the
  authored 2D colour straight to the framebuffer (`0.2, 0.7, 0.9` → `51, 178, 229`
  exactly); ours renders it lifted and desaturated (`95, 191, 217`). The scene has
  no `WorldEnvironment`, so the previewer mounts Godot's editor preview environment
  (ADR-0025), whose FILMIC tonemapping is set on the whole canvas — the unlit 2D
  polygons included — whereas Godot tonemaps only the 3D pass, never the 2D canvas.
  The semi-transparent ghost carries the same lift faintly (`93` → `98`).

## Known limitations

The relay copies its transform onto its `remote_path` target once on load (the static enter-tree effect, not per-frame). Three cases are not fully reproduced:

- **`use_global_coordinates = false`** — a no-op on a static load; only the default global-coordinate drive repositions the target (measured against Godot 4.6.3).
- **Cross-instance `remote_path`** — a path crossing into or out of an instanced sub-scene is left unresolved; in-scene resolution (the common case) works.
- **Relay chains** — resolve in document (pre-order) order; a feedback loop is not iterated to a fixed point.
