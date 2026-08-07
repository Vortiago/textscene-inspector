---
type: HFlowContainer
category: 2D
status: unimplemented
fixture: unit-h-flow-container.tscn
# image: unit-h-flow-container
renders_as: an invisible transform-only fallback
---

# HFlowContainer

The previewer parses and validates this node but does not draw it yet, so it renders as an invisible transform-only fallback and its children still show.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `alignment` | `1` (`ALIGNMENT_CENTER`) | inherited from FlowContainer; format-checked only, the previewer draws nothing regardless |
| `last_wrap_alignment` | `3` (`LAST_WRAP_ALIGNMENT_END`) | inherited from FlowContainer; format-checked only |
| `reverse_fill` | `true` | inherited from FlowContainer; format-checked only |

The interesting fact here is what is absent: HFlowContainer declares no member
of its own (`doc/classes/HFlowContainer.xml` has no members section at all),
and it REMOVES `vertical` from the set FlowContainer would otherwise offer, so
that key cannot appear in the table above or in the fixture.

## Divergences

Not captured yet.

## Linting

<!-- lint:begin HFlowContainer -->
Strict parsing format-checks the inherited set (3 inherited from FlowContainer, 28 inherited from Control, 15 inherited from CanvasItem, 10 inherited from Node); `HFlowContainer` declares none of its own. Every validator failure is an **error**. `HFlowContainer` also REFUSES `vertical`, which its base declares but this class cannot carry.

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

The lenient parser reuses `parseControl` unchanged and never reads `vertical`
by name, so a `.tscn` carrying it on an HFlowContainer parses and renders the
same as one without it; only the strict parser rejects the key outright, as
one Godot's editor could never have written to this class.
