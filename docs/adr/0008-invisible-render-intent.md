# Non-visual nodes render as invisible transform-only groups; no viewport placeholder

- Status: Accepted. Partly amended by ADR-0018, by the Label3D parity amendment, by the
  render-intent split amendment and by the parent-space amendment (all below).
- Generalises ADR-0005 (physics bodies as transform-only groups).
- Related: ADR-0006 (viewport-mode seam, `showCollisions` toggle).
- Supersedes the visible grey-box placeholder of `GenericNodeFallback`.

## Context

`GenericNodeFallback` (`r3f/internal/generic-node-fallback/Component.tsx`) drew a
semi-transparent grey cube **plus** a floating `Type: Name` text label for every node type with
no registered render component. The unregistered 3D types were `CharacterBody3D`, `RigidBody3D`,
`Skeleton3D`, `Path3D`, `PathFollow3D` and `GPUParticles3D`. None of them draw anything in this
previewer, so a scene with several of them filled with grey boxes and overlapping labels. ADR-0005
declared `RigidBody3D`/`CharacterBody3D` transform-only, but only `StaticBody3D`/`Area3D` were
registered that way. `Label3D` rasterises text onto a plane in the 3D scene, which adds to the noise.

## Decision

The render contract has **two outcomes**, and "renders nothing" is an explicit render intent, not an
accident of a missing registration:

1. **Visible renderer**, or **invisible transform-only group**: a `<group>` that positions its children
   and draws nothing itself. There is no third "placeholder" outcome. The grey cube and its always-on
   label are removed.
2. **Known non-visual types**, whose runtime output is empty by nature: physics bodies (`StaticBody3D`,
   `RigidBody3D`, `CharacterBody3D`, `Area3D`), `Skeleton3D`, `Path3D` and `PathFollow3D`. They render
   as transform-only groups that reuse the Node3D transform parse (per ADR-0005), beside
   `Node3D`/`Node2D`. The physics bodies and `Skeleton3D` register `renderIntent: 'transform-only'`
   (see the render-intent split amendment). `Path3D` and `PathFollow3D` have selection-gated gizmos
   (ADR-0018).
3. **Not-implemented types** also render as invisible transform-only groups: children still show, and
   the node itself draws nothing. `GPUParticles3D` is one. Godot rasterises a particle cloud at runtime
   and the previewer draws nothing, so it registers `renderIntent: 'pending'`, never
   `'transform-only'`. The `SceneTreeViewer`, which lists every node with its type, is where an
   unsupported type is discoverable. The viewport stays clean.
4. **In-viewport text** (`Label3D` and any node-drawn text) is gated behind a `showLabels` flag on
   `ViewportModeContext`, surfaced in `ViewportToolbar` next to `showCollisions` (ADR-0006). The flag
   was off by default. The Label3D parity amendment makes it on by default. With the flag off,
   `Label3D` renders an invisible marker group.

Do not wire up the unregistered node types so that they render. The invisibility is deliberate, not an
omission.

## Consequences

- The 3D view does not signal an unsupported node type. The scene tree does. A "not rendered"
  affordance in the tree is a possible follow-up, not part of this decision.
- A transform-only group must still position its children, so every non-visual type needs at least
  the Node3D-level `transform` parsed. `GenericNodeFallback` reads the transform defensively (identity
  when absent). Children of an unparsed unknown type therefore land at the origin of their parent.
  That is acceptable: the alternative was a misplaced grey box.

> **Amendment (ADR-0018):** `Marker3D`, `Path3D` and `PathFollow3D` draw a **selection-gated** gizmo
> (marker cross, curve polyline, follow handle), and PathFollow3D follows the parent curve. The gizmo
> shows only while the node is selected, so the clutter this ADR fought does not return. They still
> position their children identically (the transform-only guarantee holds). The physics bodies,
> `Skeleton3D` and the not-implemented types are unchanged.

> **Amendment (Label3D parity):** `showLabels` defaults **on** (context default plus provider
> `initialShowLabels`). Godot always rasterises `Label3D` text at runtime, so a viewport that hides it
> reads as "unsupported" rather than "parity". The flag and its `ViewportToolbar` toggle are
> unchanged. A user who finds the text cluttered turns it off, like the collision gizmo. With the flag
> off, `Label3D` still renders an invisible marker group.

> **Amendment (ADR-0027):** a **geometry contributor** (a CSG node inside the subtree of a CSG root)
> draws nothing itself, yet unlike every other transform-only type it *has* geometry of its own. The
> boolean result of its CSG root consumes its solid instead of drawing it where it sits. This adds no
> third outcome. It is a role on top of the second one, as `AnimationPlayer` is a transform-only group
> that is also an animation driver (ADR-0011). "Draws nothing itself" keeps its meaning. A contributor
> also mounts an *invisible* bounds-proxy mesh so per-node selection and `F`-to-frame work. That draws
> nothing either: the three.js raycaster skips invisible objects, while `bounds.ts` keys on `.geometry`
> alone.

> **Amendment (render-intent split):** this ADR describes the render mechanism, an invisible group
> that positions its children. Intent is recorded apart from mechanism, because the mechanism serves
> both nodes that draw nothing by nature and nodes nobody has implemented.
> `NodeComponentRegistration.renderIntent: 'transform-only'` means finished-and-invisible (sheet
> status `linter-only`). `renderIntent: 'pending'` means not-implemented (sheet status
> `unimplemented`), and the base component still mounts so the node keeps its `visible` flag and its
> workspace. No registration at all is also not-implemented. All three render as an invisible
> transform-only group, and `GenericNodeFallback` applies the Node3D transform. `GPUParticles3D` is in
> the second group: Godot rasterises a particle cloud at runtime (`unit-gpuparticles3d-godot.png`)
> and the previewer draws nothing, so it is a gap, not a node that draws nothing by nature. The
> physics bodies and `Skeleton3D` stay in the first, as do `Path3D` and `PathFollow3D` at runtime.
> Their runtime output is empty, and what an editor draws for them is the business of ADR-0018.

> **Amendment (parent space):** a transform-only group positions its children only where Godot
> links them to it. Godot links a Node3D to its parent only when the parent is a Node3D
> (`node_3d.cpp:150`). It composes both the global transform (`:656-660`) and the visibility
> (`:1132-1143`) through that link alone. A CanvasItem links only to a CanvasItem parent, and
> otherwise reads its visibility from a CanvasLayer parent or the Window (`canvas_item.cpp:309-348`).
> So a Node3D under a plain `Node` (Timer, AnimationPlayer, an organising `Node`) takes nothing from
> the Node3D above that `Node`.
>
> - `godot/parentSpace.ts` states the rule: a child escapes a parent in the Node3D or CanvasItem
>   family when it is not of that family. `<ParentSpaceScope>` moves such a child's three object
>   to the viewport's world root, outside every ancestor group, because three hides a whole subtree
>   below one invisible object. The eye toggle follows the same rule, as the editor's does.
> - Rejected: an R3F `createPortal`. It gives every component inside a scene of its own, and
>   WorldEnvironment, Decal and the light helpers write to `useThree().scene`. Only the three
>   object moves, so the React tree, `useThree()` and every context stay as they were.
> - A type-less `instance=` node stays in its parent's group until it merges (ADR-0013). Its class is the
>   sub-scene root's, unknown until the sub-scene loads, and a `.glb` root is a Node3D.
> - A `top_level` Node3D keeps its parent link, so it stays in place and still hides with its
>   parent. `<TopLevelScope>` composes its world matrix from the world root instead of its parent.
>   The editor and a loaded game agree, since Godot sets the flag before the node enters the tree
>   (`node_3d.cpp:1044-1058`).
> - `globalMatrix3D` applies the same rule for the passes that run before anything mounts.
