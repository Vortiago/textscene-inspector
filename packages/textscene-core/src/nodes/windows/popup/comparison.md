---
type: Popup
category: Other
status: unimplemented
fixture: unit-popup.tscn
# image: unit-popup
renders_as: nothing yet — not implemented
---

# Popup

The previewer parses and validates this node but does not draw it yet, so it renders as an invisible transform-only fallback and its children still show.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |

## Divergences

Not captured yet.

## Linting

<!-- lint:begin Popup -->
Strict parsing format-checks the inherited set (45 inherited from Window, 9 inherited from Viewport); `Popup` declares none of its own. Every validator failure is an **error**.

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
<!-- lint:end -->

Popup registers no validators or semantic rules of its own yet, so the strict
and lenient parsers agree on every property: whatever `parser.ts` reads it reads
without substitution. Replace this once `linterParser.ts` has validators, naming
the property and the value the lenient parser falls back to.
