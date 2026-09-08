---
type: AudioListener2D
category: 2D
status: linter-only
fixture: unit-audio-listener-2d.tscn
# image: unit-audio-listener-2d
visual: false
renders_as: nothing (a transform-only group)
---

# AudioListener2D

AudioListener2D is the point 2D audio is panned from. It draws nothing at runtime, so
the previewer renders it as a transform-only group (ADR-0008) and its children still
show.

## Linting

<!-- lint:begin AudioListener2D -->
Strict parsing format-checks these `AudioListener2D` properties, plus 12 inherited from Node2D, 16 inherited from CanvasItem, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `current` | true or false |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
<!-- lint:end -->

Strict checks `current` as a bool. The lenient parser reuses `parseNode2D`, which never
reads `current`, and a malformed `position` warns and falls back to `Vector2(0, 0)`.
