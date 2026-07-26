---
type: Node3D
category: 3D
fixture: unit-node3d-basic.tscn
image: unit-node3d-basic
visual: false
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

## Linting

<!-- lint:begin Node3D -->
Strict parsing format-checks these `Node3D` properties. Every validator failure is an **error**.

| Property |
| --- |
| `basis` |
| `global_basis` |
| `global_position` |
| `global_rotation` |
| `global_rotation_degrees` |
| `global_transform` |
| `position` |
| `quaternion` |
| `rotation` |
| `rotation_degrees` |
| `rotation_order` |
| `scale` |
| `top_level` |
| `transform` |
| `visibility_parent` |
| `visible` |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error, warning |
<!-- lint:end -->

Node3D's lenient parser reads exactly two properties: `transform` and
`visible`. An absent `transform` stays `undefined`; a malformed one warns and
falls back to the identity `Transform3D`, matching neither strict's rejection
nor any authored value. `visible` resolves via plain string equality
(`!== 'false'`) with no warning for a malformed value, and stays `undefined`
when absent rather than defaulting to `true`. Every other validated property,
including `position`, `rotation`, `rotation_degrees`, `scale`, `basis`,
`quaternion`, `rotation_order`, `top_level`, `visibility_parent`, and the four
`global_*` fields, is never read by the lenient parser at all: only the
composite `Transform3D` literal is parsed, not Godot's discrete transform
alternatives.

## Known limitations

- **top_level** — with `top_level = true` a Node3D ignores ancestor transforms, but our renderer nests every node in its parent's group, so the parent transform is always inherited. No corpus fixture sets it.
