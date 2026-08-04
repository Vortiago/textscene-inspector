---
type: BoxContainer
category: 2D
status: unimplemented
fixture: unit-box-container.tscn
# image: unit-box-container
renders_as: invisible transform-only fallback
---

# BoxContainer

BoxContainer is Godot's abstract base for a Control that stacks its children
along one axis — the shared plumbing behind `HBoxContainer` and
`VBoxContainer`. It is a Control (ADR-0003 routes Controls through the 2D DOM
overlay, not the WebGL scene), so the previewer parses and validates every
member below but does not draw it yet: it renders as an invisible
transform-only fallback and its children still show.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `alignment` | `1` | packs children toward the centre of the main axis (`ALIGNMENT_CENTER`) |
| `vertical` | `true` | stacks children top-to-bottom instead of left-to-right |

## Divergences

Not captured yet — nothing renders, so there is nothing to compare pixels against.

## Linting

<!-- lint:begin BoxContainer -->
Strict parsing format-checks these `BoxContainer` properties, plus 27 inherited from Control, 15 inherited from CanvasItem, 10 inherited from Node. Every validator failure is an **error**.

| Property | Accepts |
| --- | --- |
| `alignment` | enum 0-2 (ALIGNMENT_BEGIN/ALIGNMENT_CENTER/ALIGNMENT_END) |
| `vertical` | true or false |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
<!-- lint:end -->

`linterParser.ts` format-checks both of BoxContainer's own members. Neither
affects the rendered fallback today: `index.ts` reuses `parseControl`
unchanged (ADR-0003 — the node draws nothing), which reads neither key, so
the strict and lenient parsers agree on every property here. `vertical`
still earns a validator despite that: `is_fixed`, the flag `HBoxContainer`
and `VBoxContainer` set true in their own constructors to hide the property
(`box_container.cpp`'s `_validate_property`), defaults to false on a plain
`BoxContainer` (`box_container.h`), so Godot serialises the key on this type
alone. `alignment` is already read for rendering, but by `HBoxContainer`/
`VBoxContainer` through the shared `parseBoxContainer` helper
(`nodes/2d/ui/shared/boxContainer.ts`) — that parser, not this node's own, is
where a malformed value resolves to `ALIGNMENT_BEGIN`/`flex-start` today.
