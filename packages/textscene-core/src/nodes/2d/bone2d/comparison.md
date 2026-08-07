---
type: Bone2D
category: 2D
status: linter-only
fixture: unit-bone-2d.tscn
# image: unit-bone-2d
visual: false
renders_as: nothing (a transform-only group; the bone gizmo is editor-only)
---

# Bone2D

Bone2D's only drawing is the bone gizmo, and its `NOTIFICATION_DRAW` handler
returns immediately unless `Engine::is_editor_hint()`
(`skeleton_2d.cpp:191-195`), so at runtime the node contributes nothing but a
transform. The previewer therefore renders it as a transform-only group
(ADR-0008): its children still show, in the right space, and that absence is the
whole story.

Bone2D reaches a `.tscn` by two routes. `rest` is the class's single
`ADD_PROPERTY` (`skeleton_2d.cpp:380`); the other four properties are pushed by a
hand-rolled `_get_property_list` (`skeleton_2d.cpp:85-95`) and round-tripped
through `_set`/`_get`, which is why `doc/classes/Bone2D.xml` lists them as
methods and names only `rest` as a member.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `rest` | `Transform2D(1, 0, 0, 1, 10, 20)` | The bone's rest pose, relative to its parent bone. Not applied to the node transform until `apply_rest()` runs, so it changes nothing on screen. |
| `auto_calculate_length_and_angle` | `false` | Stops Godot recomputing length and angle from the first child Bone2D. It is what makes the next two properties serialise at all (`skeleton_2d.cpp:87`). |
| `length` | `24.0` | Gizmo length in pixels. Editor-only geometry. |
| `bone_angle` | `45.0` | Gizmo direction, in DEGREES: `_set` converts with `deg_to_rad` (`skeleton_2d.cpp:47`) and `_get` back with `rad_to_deg` (`:69`), so the stored literal is degrees even though the field is radians. Editor-only geometry. |
| `editor_settings/show_bone_gizmo` | `false` | Hides the gizmo in the Godot editor. TOOLS_ENABLED-only, but stored, so real scenes carry it. |
| `position` (Node2D) | `Vector2(10, 20)` | Inherited; the transform the children inherit. |

The fixture puts the bone under a Skeleton2D, and gives it a child Bone2D,
because that is the only arrangement Godot itself accepts: a bone finds its
skeleton by walking up through Bone2D parents, and one that finds none is never
registered as a bone at all.

## Divergences

None known. Everything Bone2D draws is gated on the editor hint, and the
previewer is not the editor, so there is no runtime geometry to diverge on.

## Linting

<!-- lint:begin Bone2D -->
Strict parsing format-checks these `Bone2D` properties, plus 12 inherited from Node2D, 16 inherited from CanvasItem, 10 inherited from Node. Every validator failure is an **error**.

| Property | Accepts |
| --- | --- |
| `auto_calculate_length_and_angle` | true or false |
| `bone_angle` | float -360-360 |
| `default_length` | float 1-1024 |
| `editor_settings/show_bone_gizmo` | true or false |
| `length` | float 1-1024 |
| `rest` | Transform2D(6 floats) |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
| `valid-bone2d-ancestry` | `bone2d-chain-does-not-terminate` | warning |
|  | `bone2d-invalid-parent` | warning |
|  | `bone2d-missing-rest-pose` | warning |
<!-- lint:end -->

Nothing here is a rendering breaker, so the two parsers part company quietly.
The lenient parser reuses `parseNode2D`, which reads none of these five keys: a
`length` of `2048` or a `bone_angle` of `900` is carried into the scene tree
untouched and changes nothing on screen, because the node draws nothing either
way. Strict lint reports both as WARNINGS rather than errors, since Godot's
setters assign them straight through and only the inspector's
`PROPERTY_HINT_RANGE` objects. A malformed literal, a three-component
`Transform2D` for `rest` or a `1` for `auto_calculate_length_and_angle`, is an
error on both sides: Godot's own variant parser cannot read it either. `default_length` is the one key the
linter deliberately ignores: `_set`/`_get` still answer to it
(`skeleton_2d.cpp:48`, `:70`) but `_get_property_list` never pushes it, so it
cannot be written by the engine and an old scene carrying it lints clean.
