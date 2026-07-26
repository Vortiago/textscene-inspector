---
type: Node
category: Other
visual: false
renders_as: nothing — a non-spatial base node
---

# Node

The base of every Godot node. A plain `Node` has no transform and no visual of its
own; the previewer mounts it as an empty group and draws nothing. Its role is to
parent other nodes, which render on their own.

## Divergences

None — a `Node` draws nothing in either engine. That absence is the useful fact.

## Linting

<!-- lint:begin Node -->
Strict parsing format-checks nothing on this node: no validators are registered for `Node`, and it inherits none.

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
<!-- lint:end -->

There is no registered validator here, so nothing for the lenient parser to
diverge from. Its `parser.ts` nonetheless reads a `transform` property the
same way Node3D does: absent, it stays `undefined`; malformed, it warns and
falls back to the identity `Transform3D`. A plain `Node` never carries this
key in an authored `.tscn`, so in practice the fallback is unreachable.
