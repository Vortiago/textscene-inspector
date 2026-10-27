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
`r3f/gizmo/gizmoVariant.ts` is the one place that holds the factor, and no node computes it.

`useGizmoState(drawnFor)` gives each gizmo part one of three states: hidden, unselected or selected.
A part declares whether Godot draws it for every node (`'every-node'`) or only for the selected node
(`'selected-only'`).

`<PluginGizmo drawnFor>` is the one gate of a Godot gizmo-plugin gizmo. It is the only caller of
`useGizmoState` for such a gizmo. It mounts its children for a visible state and hands them the
look of their node through a context, so `GizmoLine` and `GizmoMesh` take no `variant` prop. A part
that is no plugin material, such as the 2D helpers, the follower handles and Marker3D, draws outside
every gate and keeps its own colour. A part that Godot draws for the selected node only, inside a
gizmo that is drawn for every node, sits in `<SelectedOnly>`.

### The split

| Draws | Nodes |
| --- | --- |
| Every node, faint when unselected | CPUParticles3D box and centre axes, Path3D curve, SpringArm3D line, VehicleWheel3D, Camera3D frustum, Decal box, VisibleOnScreenNotifier3D and Enabler edges and axes, FogVolume box |
| Every node, full colour | Marker3D (one material with no variants, `marker_3d_gizmo_plugin.cpp:80-92,115`), Marker2D, Path2D, LightOccluder2D |
| Selected node only | Light helpers, the range and cone of AudioStreamPlayer3D, GPUParticles3D box, CPUParticles3D solid box, every emission shape, ReflectionProbe, VoxelGI, PathFollow2D and PathFollow3D handle |

The Notifier, Enabler and FogVolume rows follow their gizmo plugins
(`visible_on_screen_notifier_3d_gizmo_plugin.cpp:149-194`, `fog_volume_gizmo_plugin.cpp:92-125`),
which have no `is_selected()` gate on the lines. A solid fill stays selected-only, because Godot
gates it on `is_selected()`.

SpringArm3D and VehicleWheel3D draw in the collision colour at its alpha of 0.42 (`scene_tree.cpp:2028`),
so their unselected lines draw at 0.126.

The Camera3D and Decal gizmos draw Godot's own lines in the colours of `editor_settings.cpp:883-884`.
The camera lines take the aspect of the viewport that holds the camera, which is the nearest
SubViewport or else the project's window size (`node_3d_editor_plugin.cpp:10445`), and they sit on the
node, not on the camera that `h_offset` and `v_offset` move. The PathFollow handle is a previewer addition, since
Godot draws no gizmo for a follower.

### The instantiated look

Godot gives a gizmo material four variants: selected or not, editable or not
(`node_3d_editor_gizmos.cpp:43-60`). A node is editable when the edited scene owns it. A node that
comes from an instanced sub-scene is not editable, unless an `[editable path="..."]` line of the
scene file lists it. The non-editable variants replace the plugin colour and alpha with
rgba(0.7, 0.7, 0.7, 0.6) (`node_3d_editor_gizmos.cpp:907-917`, `editor_settings.cpp:879`). The
unselected variant then multiplies the alpha by 0.3 as before.

The parser reads each `[editable]` heading into `TscnScene.editableInstances`
(`resource_format_text.cpp:400`). The file stores the paths in the simplified form. Any scene file
along an instantiation chain can set the flag, with paths relative to its own root
(`packed_scene.cpp:691-695`). `r3f/instanceOwners.ts` keeps this as a stack of owners, and
`InstanceOwnerProvider` pushes one for each instance. `useIsInstantiated` answers for the node in
scope. `PluginGizmo` reads it once for its node, and `useGizmoLook` turns that and the variant into
the colour and opacity of a part.

A part inside a gate wears the grey. A part outside every gate keeps its own colour, because its
Godot material is not a plugin material: the 2D helpers, PathFollow2D and PathFollow3D, and Marker3D
(`marker_3d_gizmo_plugin.cpp:80-92`) never turn grey.

A node that the edited scene authors under an instanced GLB takes the level of the scene that
instances the GLB, not the GLB's, so its gizmo keeps its colour. `GlbInstanceProvider` holds that
level for `GlbAttachedChildren`. The GLB code draws no gizmo of its own.

Value check, over a flat 0.3 clear, on the same camera. A Godot scene replicates each gizmo with the
gizmo material: unshaded, alpha blend, no culling, albedo rgb(0.7, 0.7, 0.7). `ref:godot` renders it,
and the previewer renders the locked node through the Godot comparison browser, with the selection
highlight off. Both are neutral grey, so the three channels are equal.

- The locked SpringArm3D length line, unselected (alpha 0.18): 189 pixels read rgb(105) in both.
- The same line, selected (alpha 0.6): 189 pixels read rgb(148) and 11 read rgb(145) in both.
- The fill of the selected locked CPUParticles3D, two faces at alpha 0.6: 310 125 interior pixels
  read rgb(167) in both. The previewer's own box edges, at alpha 0.6 over the fill, read rgb(174).

The clear is rgb(76) in Godot and rgb(77) here. Godot truncates 0.3 × 255 = 76.5, and this previewer
rounds it. The blend gives 148.36 over 76 and 148.53 over 77, so the line reads 148 in both.

Godot draws 61 more pixels along the line than the previewer, where the line steps to the next row.
The other 189 pixels match in position and value, so the line differs in coverage, not in colour.
The visual baselines carry a ring of about 6 % outside a hard top and left edge, from the software
compositor (`launchGodotComparisonBrowser`). A line on a golden reads about 103 beside a faint 78,
and the comparison browser reads 105.

Marker2D and Marker3D draw an axis cross, not one colour: a red x axis, a green y axis and, in 3D,
a blue z axis, with each negative arm darkened by 0.5 (`marker_2d.cpp:47-59`,
`marker_3d_gizmo_plugin.cpp:60-79`, `theme_classic.cpp:197-199`). `axisCross` builds both. Over the
same camera, the 2D cross draws rgb(245, 51, 82), rgb(122, 26, 41), rgb(135, 214, 3) and
rgb(68, 107, 1) in Godot and here. The 3D cross differs by one level in a channel, for example
rgb(244, 51, 81) in Godot against rgb(245, 51, 82) here. Godot stores a vertex colour as eight bits
and truncates (`rendering_server.cpp:712-717`), so 0.96 × 255 = 244.8 reads 244.

The editable sibling of the particles emitter draws rgb(132, 119, 85), the plain unselected
particles colour. The fill of the selected locked emitter draws rgb(167), two faces at alpha 0.6.
The goldens `cpuparticles3d-instanced-unselected` and `cpuparticles3d-instanced-selected` show both cases.

The Light helpers are three.js helpers, not Godot gizmo materials, and #908 rebuilds them through
`GizmoLine`. They keep their colour until then.

### The node icon

Godot's gizmo plugins add a billboard icon to a light, a camera, an emitter, a probe, a decal, a fog
volume and an audio node, outside any selection check (`node_3d_editor_gizmos.cpp:949-989`). A node
type declares it as `editorIcon` in its registration, and the dispatcher mounts it inside the node's
transform for every render intent, so a transform-only or pending type keeps its status.

The icon is a plugin gizmo that draws for every node, so `PluginGizmo` gates it and gives it the
unselected and instantiated looks of the other parts. The quad ignores the scale of the node and keeps
one size on screen: its basis is the camera rotation times the factor of `FLAG_FIXED_SIZE`
(`material.cpp:1357-1381`), which `fixedSizeFactor` holds for every fixed-size draw. A light passes its
colour at full HSV value as the tint (`light_3d_gizmo_plugin.cpp:150-155`). A FogVolume with the WORLD
shape draws no icon, as in Godot.

A click on the icon selects its node, because the icon sits under the node group that the delegated
pointer root resolves. The raycast hits the icon square, as Godot's does. The icon is no geometry for
`frameSceneBounds` or the hover and selection boxes, so it changes no frame and no box. The icon files
are Godot's own SVGs, listed in THIRD-PARTY-NOTICES.md.

A SubViewport pass hides every editor chrome subtree, since Godot's gizmos live in the editor viewport alone,
and an icon aligned to the editor camera would draw skewed through the camera of the viewport.

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

The Camera3D and Decal gizmo colours match `ref:godot` over the same clear. Their line geometry has no
render to measure, so the tests in `camera3d/gizmoLines.test.ts` and `decal/gizmoLines.test.ts` pin
vertices that a GDScript port of the `redraw` functions produced in Godot.

Open divergences:

- Godot draws edit handles for the selected, editable node (`node_3d_editor_gizmos.cpp:405`). The
  previewer edits nothing and draws none.
- 3D follow orientation of a PathFollow3D is an approximation: ADR-0018 aligned the model-front
  axis to the curve tangent for every `rotation_mode` except `NONE` and ignored curve tilt. Issue
  #743 holds the fix.
