---
type: Container
category: 2D
status: unimplemented
fixture: unit-container.tscn
# image: unit-container
renders_as: nothing yet — not implemented
---

# Container

The previewer parses and validates this node but does not draw it yet, so it renders as an invisible transform-only fallback and its children still show.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |

## Divergences

Not captured yet.

## Linting

<!-- lint:begin Container -->
Strict parsing format-checks the inherited set (28 inherited from Control, 15 inherited from CanvasItem, 10 inherited from Node); `Container` declares none of its own. Every validator failure is an **error**.

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
| `valid-control-tooltip-mouse-filter` (type-family match) | `control-tooltip-ignored-by-mouse-filter` | warning |
| `valid-container-script` | `container-no-script` | warning |
<!-- lint:end -->

Container registers no validators or semantic rules of its own yet, so the strict
and lenient parsers agree on every property: whatever `parser.ts` reads it reads
without substitution. Replace this once `linterParser.ts` has validators, naming
the property and the value the lenient parser falls back to.
