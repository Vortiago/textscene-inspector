---
type: XRAnchor3D
category: 3D
status: linter-only
fixture: unit-xr-anchor-3d.tscn
# image: unit-xr-anchor-3d
visual: false
renders_as: nothing (a transform-only group)
---

# XRAnchor3D

An AR anchor mapping a real-world location into the game world. It draws nothing at
runtime, so the previewer renders it as a transform-only group (ADR-0008): its
children still show, and that absence is the whole story.

## Properties exercised

XRAnchor3D declares no property of its own — `xr_nodes.cpp:660-663`'s
`_bind_methods` binds only the two getters `get_size`/`get_plane`, no
`ADD_PROPERTY` — so the fixture exercises the inherited XRNode3D key below. The
fixture also parents the anchor under an XROrigin3D with an XRCamera3D sibling,
satisfying XRNode3D's own parent rule (see Linting below) rather than a
serialised property.

| Property | Value | Effect |
| --- | --- | --- |
| `tracker` | `&"left_hand"` | none — inherited from XRNode3D; the tracker binding has no visual and no XR runtime moves this node |

## Divergences

None visible in this fixture.

## Linting

<!-- lint:begin XRAnchor3D -->
Strict parsing format-checks the inherited set (3 inherited from XRNode3D, 16 inherited from Node3D, 10 inherited from Node); `XRAnchor3D` declares none of its own. Every validator failure is an **error**.

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error, warning |
| `valid-xrnode3d` (type-family match) | `xrnode3d-parent-not-xrorigin3d` | warning |
|  | `xrnode3d-no-pose-set` | warning |
<!-- lint:end -->

XRAnchor3D reuses `parseNode3D` (the Node3D base parser), which only reads
`transform` and `visible`. A malformed inherited `tracker` — say, the quotes
dropped — parses through completely silently: nothing downstream of parsing ever
looks at the key, valid or not, since nothing substitutes a fallback for it.
