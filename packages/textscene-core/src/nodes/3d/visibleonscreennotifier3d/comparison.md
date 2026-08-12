---
type: VisibleOnScreenNotifier3D
category: 3D
status: linter-only
fixture: unit-visible-on-screen-notifier-3d.tscn
# image: unit-visible-on-screen-notifier-3d
visual: false
renders_as: nothing (a transform-only group)
---

# VisibleOnScreenNotifier3D

VisibleOnScreenNotifier3D reports whether its `aabb` is visible on screen or in a
Camera3D's view via `screen_entered`/`screen_exited` signals and draws nothing else
at runtime, so the previewer renders it as a transform-only group (ADR-0008): its
children still show, and that absence is the whole story. Unlike its 2D sibling —
whose own `NOTIFICATION_DRAW` code fills `rect` under `Engine.is_editor_hint()` —
this class contains no draw call at all, so `aabb` is edit-time-only in the same
runtime-invisible/editor-only sense ADR-0018 already established for
Marker3D/Path3D/PathFollow3D: neither the previewer nor a running Godot game ever
draws it.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `aabb` | `AABB(-2, -2, -2, 4, 4, 4)` | the screen-visibility bounding box; invisible here since the node draws nothing itself |

## Divergences

None visible in this fixture — the node draws nothing in either engine.

## Linting

<!-- lint:begin VisibleOnScreenNotifier3D -->
Strict parsing format-checks these `VisibleOnScreenNotifier3D` properties, plus 1 inherited from VisualInstance3D, 17 inherited from Node3D, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `aabb` | AABB(x, y, z, w, h, d) |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error |
<!-- lint:end -->

A malformed `aabb` (not an `AABB(...)` literal) fails strict validation, but the
lenient parser (`parseNode3D`) never reads it at all — it has no effect on a node
that draws nothing — so a bad value is silently ignored rather than substituted or
reported. `layers` is inherited from VisualInstance3D (see linterParser.ts) and is
covered by that slice's own sheet.
