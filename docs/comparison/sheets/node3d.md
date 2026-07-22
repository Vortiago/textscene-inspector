---
type: Node3D
category: 3D
fixture: unit-node3d-basic.tscn
image: unit-node3d-basic
renders_as: an invisible transform group
---

# Node3D

Node3D is the base 3D node — a pure transform with no geometry of its own. The
previewer renders it as a `<group>` that positions its children and draws nothing
itself, decomposing each `Transform3D` into position/rotation/scale.

The fixture nests a root with two children and a grandchild, then parents two
Label3D captions high above origin (y = 4 and y = 3). Both are framed out by the
shared editor camera, so each capture shows only the editor preview sky — a
light blue-grey band fading to the procedural ground colour, with no visible
geometry or text.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `transform` | translation offsets on Child1 / Child2 / GrandChild | repositions invisible containers; nothing is drawn |

## Divergences

None visible in this fixture.
