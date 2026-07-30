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

| Property | Value | Effect |
| --- | --- | --- |
| `tracker` | `&"left_hand"` | none — the tracker binding has no visual, and no XR runtime moves this node |
| `pose` | `&"grip"` | none — the pose to read from the tracker has no visual |
| `show_when_tracked` | `true` | none — the tracking-driven visibility toggle never fires without an XR runtime |

## Divergences

A previewer has no XR runtime, so the tracker never moves it.

## Linting

<!-- lint:begin XRNode3D -->
Strict parsing format-checks these `XRNode3D` properties, plus 16 inherited from Node3D. Every validator failure is an **error**.

| Property |
| --- |
| `pose` |
| `show_when_tracked` |
| `tracker` |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error, warning |
<!-- lint:end -->

XRNode3D reuses `parseNode3D` (the Node3D base parser) rather than a parser of its
own, and that parser only reads `transform` and `visible`. It never looks at
`tracker`, `pose`, or `show_when_tracked` at all, so a malformed value — say
`tracker = left_hand` with the quotes dropped — parses through completely
silently: the parsed node carries no record of the property, valid or not, since
nothing ever reads the key to substitute a fallback.
