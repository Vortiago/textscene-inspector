# Non-visual nodes render as invisible transform-only groups; no viewport placeholder

- Status: Accepted (2026-06-02); **partially amended by ADR-0018 (2026-06-24), by the
  Label3D parity amendment (2026-07-22), and by the render-intent split (2026-07-30)**.
- Generalises ADR-0005 (physics bodies as transform-only groups).
- Related: ADR-0006 (viewport-mode seam, `showCollisions` toggle).
- Supersedes the WI-R3F-7 "visible grey-box placeholder" behaviour of `GenericNodeFallback`.

## Context

The 3D viewport drew clutter. Node types with no registered render component fell through to
`GenericNodeFallback`, which rendered a semi-transparent grey cube **plus** a floating `Type: Name`
text label for every such node (`r3f/internal/generic-node-fallback/Component.tsx`). The unregistered
3D types were `CharacterBody3D`, `RigidBody3D`, `Skeleton3D`, `Path3D`, `PathFollow3D` and
`GPUParticles3D`. None of them drew anything in this previewer, so a scene with several of them filled
with grey boxes and overlapping labels. ADR-0005 already *declared* `RigidBody3D`/`CharacterBody3D`
transform-only, but only `StaticBody3D`/`Area3D` were registered that way, so reality contradicted the
record. `Label3D` separately rasterises text onto a plane drawn into the 3D scene, adding to the noise.

## Decision

The render contract has exactly **two outcomes**, and "renders nothing" becomes an explicit render
intent rather than an accident of missing registration:

1. **Visible renderer**, or **invisible transform-only group**: a `<group>` that positions its children
   and draws nothing itself. There is no third "placeholder" outcome. The grey cube and its always-on
   label are removed.
2. **Known non-visual types**, whose runtime output is empty by nature: physics bodies (`StaticBody3D`,
   `RigidBody3D`, `CharacterBody3D`, `Area3D`), `Skeleton3D`, `Path3D` and `PathFollow3D`. They render
   as transform-only groups, reusing the Node3D transform parse (per ADR-0005), joining
   `Node3D`/`Node2D`. The physics bodies and `Skeleton3D` register `renderIntent: 'transform-only'`
   (see the 2026-07-30 amendment). `Path3D` and `PathFollow3D` gained selection-gated gizmos in
   ADR-0018.
3. **Not-implemented types** also render as invisible transform-only groups: children still show, and
   the node itself draws nothing. `GPUParticles3D` is one. Godot rasterises a particle cloud at
   runtime and the previewer draws nothing, so it registers `renderIntent: 'pending'`, never
   `'transform-only'` (the vocabulary of the 2026-07-30 amendment). Discoverability of unsupported types moves to the `SceneTreeViewer`, which
   lists every node with its type. The viewport stays clean.
4. **In-viewport text** (`Label3D` and any node-drawn text) is gated behind a new `showLabels` flag on
   `ViewportModeContext`, **off by default** (flipped to on by the 2026-07-22 amendment below),
   surfaced in `ViewportToolbar` next to `showCollisions` (ADR-0006). With the flag off, `Label3D`
   renders an invisible marker group.

## Consequences

- The 3D view no longer signals an unsupported node type. The scene tree is the place that does. A
  "not rendered" affordance in the tree is a possible follow-up, not part of this decision.
- A transform-only group must still position its children correctly, so every non-visual type needs at
  least the Node3D-level `transform` parsed, and `GenericNodeFallback` reads the transform defensively
  (identity when absent). Children of an unparsed unknown type therefore land at their parent's origin.
  That is acceptable, since the alternative was a mis-placed grey box.

Recorded because an architecture review naturally re-suggests "wire up the unregistered node types so
they render" (this project's own deepening review did exactly that). The invisibility is deliberate,
not an omission, and the next reader should not undo it.

> **Amendment (ADR-0018, 2026-06-24):** `Marker3D`, `Path3D`, and `PathFollow3D` are no longer fully
> invisible. They draw a **selection-gated** gizmo (marker cross, curve polyline, follow handle) and
> PathFollow3D follows the parent curve. The gizmo is visible only while the node is selected, so the
> clutter this ADR fought does not return. They still position their children identically (the
> transform-only guarantee above still holds). The physics bodies, `Skeleton3D` and the
> not-implemented types are unchanged by that amendment.

> **Amendment (Label3D parity, 2026-07-22):** Point 4's "**off by default**" is superseded.
> `showLabels` defaults **ON** (context default plus provider `initialShowLabels`). Godot always
> rasterises `Label3D` text at runtime, so a viewport that hides it reads as "unsupported" rather than
> "parity". The `showLabels` flag and its `ViewportToolbar` toggle are unchanged. A user who finds the
> text cluttered turns it OFF, exactly like the collision gizmo. With the flag off, `Label3D` still
> renders an invisible marker group (the rest of point 4 holds).

> **Amendment (ADR-0027, 2026-07-25):** a **geometry contributor** (a CSG node inside a CSG root's
> subtree) draws nothing itself, yet unlike every other transform-only type it *has* geometry of its
> own. Its solid is consumed by its CSG root's boolean result instead of being drawn where it sits.
> This does **not** add a third outcome. It is a role layered onto the second one, exactly as
> `AnimationPlayer` is a transform-only group that is also an animation driver (ADR-0011). The
> two-outcome contract above is unchanged. "Draws nothing itself" continues to mean what it says. A
> contributor also mounts an *invisible* bounds-proxy mesh so per-node selection and `F`-to-frame keep
> working. That draws nothing either: three's raycaster skips invisible objects, while `bounds.ts` keys
> on `.geometry` alone.

> **Amendment (render-intent split, 2026-07-30):** This ADR describes the render MECHANISM, an
> invisible group that positions its children, and originally applied it to two groups at once: nodes
> that draw nothing by nature, and nodes nobody had implemented. Broad node coverage made that
> conflation visible, so intent is recorded separately from mechanism.
> `NodeComponentRegistration.renderIntent: 'transform-only'` means finished-and-invisible (sheet
> status `linter-only`). `renderIntent: 'pending'` means not-implemented (sheet status
> `unimplemented`), and the base component still mounts so the node keeps its `visible` flag and its
> workspace. No registration at all is also not-implemented. All three render as an invisible
> transform-only group. `GenericNodeFallback` applies the Node3D transform, so nothing about the
> mechanism changes. `GPUParticles3D` is in the second group: Godot rasterises a particle cloud at
> runtime (`unit-gpuparticles3d-godot.png`) and the previewer draws nothing, so it is a gap, not a
> node that draws nothing by nature. The physics bodies and `Skeleton3D` stay in the first, as do
> `Path3D` and `PathFollow3D` at runtime. Their runtime output is empty, and what an editor draws for
> them is ADR-0018's business, not this one's.
