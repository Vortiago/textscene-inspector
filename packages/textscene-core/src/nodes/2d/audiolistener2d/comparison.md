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

This node draws nothing at runtime, so the previewer renders it as a transform-only group (ADR-0008): its children still show, and that absence is the whole story.

## Properties exercised

`_bind_methods` (audio_listener_2d.cpp:110-114) binds only `make_current`/`clear_current`/`is_current` and no `ADD_PROPERTY`, and the class reference lists no members — yet the node does serialise one property. `current` is pushed by the hand-rolled `_get_property_list` (audio_listener_2d.cpp:61-63) with a `_set`/`_get` pair behind it, which is the one route neither an `ADD_PROPERTY` search nor the class reference reveals.

| Property | Value | Effect |
| --- | --- | --- |
| `current` | `true` | makes this the active 2D audio listener; no visible effect |
| `position` | `Vector2(10, 20)` | inherited from Node2D; positions the (invisible) listener, no visible effect |

## Divergences

There is no runtime output to compare — the node draws nothing in either Godot or here, by design. Audio is out of scope for this previewer, so which listener is `current` changes nothing on screen.

## Linting

<!-- lint:begin AudioListener2D -->
Strict parsing format-checks these `AudioListener2D` properties, plus 12 inherited from Node2D, 16 inherited from CanvasItem, 10 inherited from Node. Every validator failure is an **error**.

| Property | Accepts |
| --- | --- |
| `current` | true or false |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
<!-- lint:end -->

The strict parser checks `current` as a bool and inherits the rest from the Node2D base.
A malformed `position` (anything that is not `Vector2(x, y)` with two numbers) is a
strict-parser error, while the lenient parser's `vec2Or` logs a console warning and
substitutes Godot's own default, `Vector2(0, 0)`, rather than reporting a lint
diagnostic.
