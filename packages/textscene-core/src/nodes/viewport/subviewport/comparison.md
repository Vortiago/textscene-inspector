---
type: SubViewport
category: 3D
status: unreviewed
fixture: unit-sub-viewport.tscn
# image: unit-sub-viewport
renders_as: TBD — one short noun phrase
---

# SubViewport

One or two sentences: what the node is, and what the previewer draws for it.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |

## Divergences

Not captured yet.

## Linting

<!-- lint:begin SubViewport -->
Strict parsing format-checks nothing on this node: no validators are registered for `SubViewport`, and it inherits none.

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
<!-- lint:end -->

SubViewport registers no validators or semantic rules of its own yet, so the strict
and lenient parsers agree on every property: whatever `parser.ts` reads it reads
without substitution. Replace this once `linterParser.ts` has validators, naming
the property and the value the lenient parser falls back to.
