---
type: VisibleOnScreenNotifier2D
category: 2D
status: linter-only
fixture: unit-visible-on-screen-notifier-2d.tscn
# image: unit-visible-on-screen-notifier-2d
visual: false
renders_as: nothing (a transform-only group)
---

# VisibleOnScreenNotifier2D

VisibleOnScreenNotifier2D reports whether its `rect` is visible on screen via
`screen_entered`/`screen_exited` signals and draws nothing else at runtime, so the
previewer renders it as a transform-only group (ADR-0008): its children still show,
and that absence is the whole story. `rect` itself is an editor-only gizmo — Godot
fills it with translucent magenta when `show_rect` is true, only while
`Engine.is_editor_hint()` — which is exactly the runtime-invisible/editor-visible
split ADR-0018 already draws for Marker3D/Path3D/PathFollow3D, so neither the
previewer nor a running Godot game ever draws it.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `rect` | `Rect2(-32, -32, 64, 64)` | the screen-visibility bounding rectangle; invisible here since the node draws nothing itself |
| `show_rect` | `false` | disables the rect's editor-only magenta fill; no runtime effect either way |

## Divergences

None visible in this fixture — the node draws nothing in either engine.

## Linting

<!-- lint:begin VisibleOnScreenNotifier2D -->
Strict parsing format-checks these `VisibleOnScreenNotifier2D` properties, plus 12 inherited from Node2D, 15 inherited from CanvasItem. Every validator failure is an **error**.

| Property | Accepts |
| --- | --- |
| `rect` | Rect2(x, y, w, h) |
| `show_rect` | true or false |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
<!-- lint:end -->

A malformed `rect` (not a `Rect2(...)` literal) or `show_rect` (not `true`/`false`)
fails strict validation, but the lenient parser (`parseNode2D`) never reads either
property at all — neither one affects rendering, since the node draws nothing — so
a bad value is silently ignored rather than substituted or reported.
