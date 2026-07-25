# Non-visual nodes render as invisible transform-only groups; no viewport placeholder

- Status: Accepted (2026-06-02); **partially amended by ADR-0018 (2026-06-24) and by the
  Label3D parity amendment (2026-07-22)**.
- Generalizes ADR-0005 (physics bodies as transform-only groups).
- Related: ADR-0006 (viewport-mode seam; `showCollisions` toggle).
- Supersedes the WI-R3F-7 "visible gray-box placeholder" behaviour of `GenericNodeFallback`.

> **Amendment (Label3D parity, 2026-07-22):** Point 4's "**off by default**" is superseded.
> `showLabels` now defaults **ON** (context default + provider `initialShowLabels`), because Godot
> always rasterises `Label3D` text at runtime, so a viewport that hides it reads as "unsupported"
> rather than "parity." The `showLabels` flag and its `ViewportToolbar` toggle are unchanged — a user
> who finds the text cluttered turns it OFF, exactly like the collision gizmo. With the flag off,
> `Label3D` still renders an invisible marker group (the rest of point 4 holds).

> **Amendment (ADR-0026, real CSG boolean evaluation):** a **geometry contributor** (a CSG node
> inside a CSG root's subtree) draws nothing itself, yet unlike every other transform-only type it
> *has* geometry of its own: its solid is consumed by its CSG root's boolean result instead of being
> drawn where it sits. This does **not** add a third outcome. It is a role layered onto the second
> one, exactly as `AnimationPlayer` is a transform-only group that is also an animation driver
> (ADR-0011). The two-outcome contract below is unchanged; "draws nothing itself" continues to mean
> what it says. A contributor also mounts an *invisible* bounds-proxy mesh so per-node selection and
> `F`-to-frame keep working, which draws nothing either (three's raycaster skips invisible objects,
> while `bounds.ts` keys on `.geometry` alone).

> **Amendment (ADR-0018):** `Marker3D`, `Path3D`, and `PathFollow3D` are no longer fully invisible.
> They now draw a **selection-gated** gizmo (marker cross / curve polyline / follow handle) and
> PathFollow3D follows the parent curve — visible only while the node is selected, so the clutter this
> ADR fought does not return. They still position their children identically (the transform-only
> guarantee below still holds). The rest of the transform-only set — physics bodies, `Skeleton3D`,
> `GPUParticles3D`, and genuinely-unsupported types — is unchanged by that amendment.

## Context

The 3D viewport drew clutter. Node types with no registered render component fell through to
`GenericNodeFallback`, which rendered a semi-transparent gray cube **plus** a floating `Type: Name`
text label for every such node (`r3f/internal/generic-node-fallback/Component.tsx`). The unregistered
3D types are `CharacterBody3D`, `RigidBody3D`, `Skeleton3D`, `Path3D`, `PathFollow3D`, `GPUParticles3D`
— none of which depict anything meaningful in a static previewer, so a scene with several of them filled
with gray boxes and overlapping labels. ADR-0005 already *declared* `RigidBody3D`/`CharacterBody3D`
transform-only, but only `StaticBody3D`/`Area3D` were registered that way, so reality contradicted the
record. `Label3D` separately rasterises text onto a plane drawn into the 3D scene, adding to the noise.

## Decision

The render contract has exactly **two outcomes**, and "renders nothing" becomes an explicit render
intent rather than an accident of missing registration:

1. **Visible renderer**, or **invisible transform-only group** — a `<group>` that positions its children
   and draws nothing itself. There is no third "placeholder" outcome; the gray cube and its always-on
   label are removed.
2. **Known non-visual types** — physics bodies (`StaticBody3D`, `RigidBody3D`, `CharacterBody3D`,
   `Area3D`), `Skeleton3D`, `Path3D`, `PathFollow3D`, `GPUParticles3D` — render as transform-only groups,
   reusing the Node3D transform parse (per ADR-0005), joining `Node3D`/`Node2D`.
3. **Genuinely-unsupported types** (no registration in any registry) also render as invisible
   transform-only groups — children still show, the node itself draws nothing. Discoverability of
   unsupported types moves to the `SceneTreeViewer`, which lists every node with its type; the viewport
   stays clean.
4. **In-viewport text** (`Label3D` and any node-drawn text) is gated behind a new `showLabels` flag on
   `ViewportModeContext`, **off by default**, surfaced in `ViewportToolbar` next to `showCollisions`
   (ADR-0006). With the flag off, `Label3D` renders an invisible marker group.

## Consequences

- The 3D view no longer signals an unsupported node type; the scene tree is the place that does. A
  "not rendered" affordance in the tree is a possible follow-up, not part of this decision.
- A transform-only group must still position its children correctly, so every non-visual type needs at
  least the Node3D-level `transform` parsed, and `GenericNodeFallback` reads the transform defensively
  (identity when absent). Children of an unparsed unknown type therefore land at their parent's origin —
  acceptable, since the alternative was a mis-placed gray box.
- Tests asserting the placeholder cube/label are **replaced**, not layered, with assertions that the
  fallback is an invisible group that still positions children (per the replace-don't-layer rule).
- Reality is realigned with ADR-0005: `RigidBody3D`/`CharacterBody3D` now actually render transform-only.

Recorded because an architecture review naturally re-suggests "wire up the unregistered node types so
they render" (this project's own deepening review did exactly that) — the invisibility is deliberate, not
an omission, and the next reader should not undo it.
