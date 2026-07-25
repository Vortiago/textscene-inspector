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
