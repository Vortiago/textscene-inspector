---
type: Skeleton2D
category: 2D
status: linter-only
fixture: unit-skeleton-2d.tscn
# image: unit-skeleton-2d
visual: false
renders_as: nothing of its own; a transform-only group whose Bone2D children keep their space
---

# Skeleton2D

Skeleton2D is the root of a Bone2D hierarchy and a single point of access to their rest
poses. It has no drawing of its own at runtime: its only `NOTIFICATION_DRAW` handler sits
inside `#ifdef TOOLS_ENABLED` and behind `Engine::is_editor_hint()`
(`skeleton_2d.cpp:720-727`), where it forwards to `modification_stack->draw_editor_gizmos()`.
That makes it an editor gizmo, not scene content, so the previewer renders it as a
transform-only group (ADR-0008) and its absence is the whole story. Everything visible under
a Skeleton2D belongs to the children it parents.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `modification_stack` | `SubResource SkeletonModificationStack2D` | the IK stack the skeleton runs each frame in Godot; inert here |
| `position` | `Vector2(10, 20)` | inherited from Node2D, the group offset its children are drawn under |

## Divergences

Nothing is drawn in either engine at runtime, so there is no image to compare. The one
behavioural gap is the modification stack: Godot executes it every `_process` and
`_physics_process` frame (`skeleton_2d.cpp:697-710`), which moves the Bone2D children before
they are drawn. The previewer runs no per-frame solve, so bones stay at the transforms the
scene file gives them. For a scene saved with the stack at rest the two agree; for one whose
bones only reach their pose through IK, ours shows the authored pose instead of the solved
one.

## Linting

<!-- lint:begin Skeleton2D -->
Strict parsing format-checks these `Skeleton2D` properties, plus 12 inherited from Node2D, 15 inherited from CanvasItem, 10 inherited from Node. Every validator failure is an **error**.

| Property | Accepts |
| --- | --- |
| `modification_stack` | SubResource("id") or ExtResource("id") |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
<!-- lint:end -->

Skeleton2D serialises exactly one key of its own, and it is easy to miss: `_bind_methods`
(`skeleton_2d.cpp:817-831`) binds no `ADD_PROPERTY` at all, and `doc/classes/Skeleton2D.xml`
lists no members. `modification_stack` reaches the `.tscn` through a hand-rolled property-list
override instead (`_set`/`_get`/`_get_property_list`, `skeleton_2d.cpp:514/522/530`). Strict
checks its format only: `set_modification_stack` (`skeleton_2d.cpp:748-763`) releases the
previous stack and assigns the new one with no `ERR_FAIL`, no clamp and no null guard, so
under ADR-0032 there is no bound to ground. The `PROPERTY_HINT_RESOURCE_TYPE` narrowing to
`SkeletonModificationStack2D` is deliberately unchecked here, because resolving a reference
to a declared type needs the scene a per-property validator never sees. The lenient parser
reads Skeleton2D through `parseNode2D` and never looks at `modification_stack`, so a malformed
value flows into rendering untouched rather than falling back to anything.

## Known limitations

- **The modification stack is parsed, never executed.** `SkeletonModificationStack2D` and its
  modifications are not implemented, so no IK solve runs and the bones render at their
  authored transforms.
- **The editor gizmo is absent by design.** Godot only draws it under `is_editor_hint()`, so
  a runtime capture of either engine is empty.
