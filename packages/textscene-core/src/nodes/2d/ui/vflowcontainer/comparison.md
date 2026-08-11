---
type: VFlowContainer
category: 2D
status: unimplemented
fixture: unit-v-flow-container.tscn
# image: unit-v-flow-container
renders_as: an invisible transform-only fallback
---

# VFlowContainer

The previewer parses and validates this node but does not draw it yet, so it renders as an invisible transform-only fallback and its children still show.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `alignment` | `1` (`ALIGNMENT_CENTER`) | Format-checked only; the previewer draws nothing regardless. |
| `last_wrap_alignment` | `3` (`LAST_WRAP_ALIGNMENT_END`) | Format-checked only. |
| `reverse_fill` | `true` | Format-checked only. |

## Divergences

Not captured yet.

## Linting

<!-- lint:begin VFlowContainer -->
Strict parsing format-checks the inherited set (3 inherited from FlowContainer, 53 inherited from Control, 16 inherited from CanvasItem, 10 inherited from Node); `VFlowContainer` declares none of its own. Every validator failure is an **error**. `VFlowContainer` also REFUSES `vertical`, which its base declares but this class cannot carry.

| Property | Accepts |
| --- | --- |
| `vertical` | **not available on this type** |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
| `valid-control-tooltip-mouse-filter` (type-family match) | `control-tooltip-ignored-by-mouse-filter` | warning |
<!-- lint:end -->

`VFlowContainer` declares no member of its own; every property in the table
above is FlowContainer's, inherited through the base-walk. The one thing this
class does on its own is REMOVE `vertical`: its orientation is fixed vertical
by the C++ constructor and `set_vertical` refuses any write, so a scene
carrying that key is one Godot could not have written. The lenient parser
reuses `parseControl` (same as `FlowContainer`), which never reads `vertical`
by name, so a hand-edited scene carrying it here parses silently: no error,
no stored value, no visible difference, since `VFlowContainer` draws nothing
regardless of what a scene author writes there.
