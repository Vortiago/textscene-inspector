---
type: XRNode3D
category: 3D
status: linter-only
fixture: unit-xr-node-3d.tscn
# image: unit-xr-node-3d
visual: false
renders_as: nothing (a transform-only group)
---

# XRNode3D

XRNode3D is the base for XR-tracked nodes: its transform is driven by a tracker at
runtime and it draws nothing itself, so the previewer renders it as a
transform-only group (ADR-0008) — its children still show, and that absence is the
whole story.

## Properties exercised

The fixture parents the node under an XROrigin3D with an XRCamera3D sibling, satisfying
its own `xrnode3d-parent-not-xrorigin3d` rule (see Linting below) rather than a
serialised property.

| Property | Value | Effect |
| --- | --- | --- |
| `tracker` | `&"left_hand"` | none — the tracker binding has no visual, and no XR runtime moves this node |
| `pose` | `&"grip"` | none — the pose to read from the tracker has no visual |
| `show_when_tracked` | `true` | none — the tracking-driven visibility toggle never fires without an XR runtime |

## Divergences

A previewer has no XR runtime, so the tracker never moves it.

## Linting

<!-- lint:begin XRNode3D -->
Strict parsing format-checks these `XRNode3D` properties, plus 16 inherited from Node3D, 10 inherited from Node. Every validator failure is an **error**.

| Property | Accepts |
| --- | --- |
| `pose` | quoted string or &"name" |
| `show_when_tracked` | true or false |
| `tracker` | quoted string or &"name" |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error, warning |
| `valid-xrnode3d` (type-family match) | `xrnode3d-parent-not-xrorigin3d` | warning |
|  | `xrnode3d-no-pose-set` | warning |
<!-- lint:end -->

XRNode3D reuses `parseNode3D` (the Node3D base parser) rather than a parser of its
own, and that parser only reads `transform` and `visible`. It never looks at
`tracker`, `pose`, or `show_when_tracked` at all, so a malformed value — say
`tracker = left_hand` with the quotes dropped — parses through completely
silently: the parsed node carries no record of the property, valid or not, since
nothing ever reads the key to substitute a fallback.

`linter.ts` also mirrors two of Godot's own `XRNode3D::get_configuration_warnings()`
checks (`xr_nodes.cpp:495-520`): a warning when a visible XRNode3D — or an
XRAnchor3D/XRController3D, which inherit the check unmodified — sits under
anything other than an XROrigin3D, and a warning when `pose` is explicitly
cleared to an empty string (its default is `&"default"`, not empty, so this is a
real state rather than the property's own default). The other two of Godot's
four warnings are not modelled: "No tracker name is set" fires exactly when
`tracker` sits at ITS OWN default (`&""`), which a `.tscn` never serialises, so
the only way to flag it would be to treat a missing key as the trigger — the
same "absence is Godot's default form" reasoning this linter applies elsewhere;
and the physics-interpolation warning needs a project setting
(`SceneTree::is_fti_enabled_in_project()`) no `.tscn` carries.
