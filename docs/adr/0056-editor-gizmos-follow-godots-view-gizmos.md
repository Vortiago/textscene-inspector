# Editor gizmos follow Godot's View Gizmos

- Status: Accepted
- Supersedes ADR-0018. It replaces the rule that every gizmo draws only for the selected node.
- Related: ADR-0006 (viewport-mode seam), ADR-0008 (invisible render intent).

## Context

ADR-0018 mounted each editor gizmo only while its node was selected, to keep the viewport clean.
Godot does not work this way. Its gizmo plugins draw each part for every node or for the selected
node only, and a View Gizmos switch hides all of them. A scene with a particle emitter, a path or a
spring arm showed nothing for that node until the user selected it, and no switch hid a gizmo.

## Decision

The previewer follows Godot's split, and the Gizmos toggle replaces the selection gate.

### The toggle

`ViewportModeContext` holds `showGizmos`, on by default, saved under `tsi.showGizmos`. The Display
menu lists it as "Gizmos". `TscnPreviewShell` reads it once, and the toolbar writes it on a user
choice, as it does for the grid. The web previewer and the VS Code extension share this shell.
Godot's View Gizmos is on by default and saved with the viewport state
(`node_3d_editor_plugin.cpp:6255,6266,4853`).

With the toggle off, no gizmo draws, 2D helpers included. Collision shapes follow only the
Collisions toggle.

### The two variants

A Godot gizmo material has a selected and an unselected variant. The unselected variant multiplies
the colour alpha by 0.3 (`node_3d_editor_gizmos.cpp:919-920`). `gizmoAlpha` in
`r3f/gizmo/gizmoVariant.ts` is the one place that holds the factor. `GizmoLine` and the box
gizmos take a `variant`, and no node computes the factor.

`useGizmoState(drawnFor)` gives each gizmo part one of three states: hidden, unselected or selected.
A part declares whether Godot draws it for every node (`'every-node'`) or only for the selected node
(`'selected-only'`).

### The split

| Draws | Nodes |
| --- | --- |
| Every node, faint when unselected | CPUParticles3D box and centre axes, Path3D curve, SpringArm3D line, VehicleWheel3D, Decal box, VisibleOnScreenNotifier3D and Enabler edges and axes, FogVolume box |
| Every node, full colour | Marker3D (one material with no variants, `marker_3d_gizmo_plugin.cpp:80-92,115`), Marker2D, Path2D, LightOccluder2D |
| Selected node only | Light helpers, AudioStreamPlayer3D, GPUParticles3D box, CPUParticles3D solid box, every emission shape, ReflectionProbe, VoxelGI, Camera3D frustum, PathFollow2D and PathFollow3D handle |

The Notifier, Enabler and FogVolume rows follow their gizmo plugins
(`visible_on_screen_notifier_3d_gizmo_plugin.cpp:149-194`, `fog_volume_gizmo_plugin.cpp:92-125`),
which have no `is_selected()` gate on the lines. A solid fill stays selected-only, because Godot
gates it on `is_selected()`.

The Camera3D frustum stays selected-only until its Godot pyramid lands (#908). The
PathFollow handle is a previewer addition, since Godot draws no gizmo for a follower.

### What the toggle and the selection do not change

PathFollow child placement is scene state. Path2D and Path3D always provide their curve to
descendants through `Path2DCurveContext` and `Path3DCurveContext`, whatever the toggle and the
selection hold.

The visual harness seeds the toggle off. A scene that shows gizmos sets `gizmos: true` in its
manifest entry. Every capture without that field is unchanged.

## Consequences

An always-drawn gizmo enlarges the hover and selection box of its node. It also counts in the
frame-on-open fallback for a scene with no mesh, so a scene that holds only a Marker3D frames on its
cross. A faint fill would count as a mesh in `frameSceneBounds`, and all fills are selected-only, so
no gizmo needs `tscnFrameExcluded`.

Value check, over the 0.3 grey clear: the CPUParticles3D box draws rgb(204, 179, 102) selected and
rgb(132, 119, 85) unselected. The runtime replica gives rgb(204, 178, 102) and rgb(132, 119, 85).
The green channel differs by one level, where 0.7 × 255 = 178.5 rounds the other way.

Open divergences:

- Godot colours the gizmos of a node inside an instanced sub-scene grey. The parser does not read
  `[editable]`, so the previewer cannot tell which nodes it is.
- Godot draws edit handles for the selected, editable node (`node_3d_editor_gizmos.cpp:405`). The
  previewer edits nothing and draws none.
- 3D follow orientation of a PathFollow3D is an approximation: ADR-0018 aligned the model-front
  axis to the curve tangent for every `rotation_mode` except `NONE` and ignored curve tilt. Issue
  #743 holds the fix.
