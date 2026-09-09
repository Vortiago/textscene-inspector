# Transform/path nodes (2D and 3D) draw editor gizmos, gated on selection

- Status: Accepted (2026-06-24)
- **Amends ADR-0008** for `Marker3D`/`Path3D`/`PathFollow3D` (they are no longer fully invisible, see
  below). The rest of ADR-0008's transform-only set (physics bodies, `Skeleton3D`,
  genuinely-unsupported types) is unchanged.
- Relates to ADR-0006 (viewport-mode seam) and the WI-UX-14 light-gizmo selection gate.

## Context

Issue #129 added **Marker2D**, **Path2D**, **PathFollow2D**. A follow-up extended the same treatment to
their 3D twins **Marker3D**, **Path3D**, **PathFollow3D**. ADR-0008 had made the 3D types deliberately
**invisible** transform-only groups and warned the next reader not to "wire up these node types so they
render". In the 3D viewport always-on gizmos are clutter that depicts nothing meaningful.

### What Godot actually does (verified against engine source)

The Godot editor is **always-on**, not selection-scoped, for these gizmos:

- **Marker2D / Marker3D**: the cross is drawn for *every* marker in the open scene, always.
  `marker_2d.cpp` draws it in `NOTIFICATION_DRAW` under `is_editor_hint()`. `Marker3D.xml` states it
  "displays as a cross in the 3D editor at all times" (drawn by its gizmo plugin for all instances).
- **Path2D / Path3D**: the curve **line** is drawn always for every path. `path_2d.cpp`'s
  `_debug_update` has no selection check, and Path3D's gizmo plugin draws the spline plus "fishbones"
  for all instances. Only the editable Bézier **control-point handles** are scoped to the selected or
  edited node.
- **PathFollow2D / PathFollow3D**: **no gizmo of their own**. What you see is the parent path's curve.

So our previewer's selection-gating is a **deliberate divergence** from Godot, made to avoid the very
clutter ADR-0008 fought. A field with many markers or paths would otherwise fill the viewport.

## Decision

The 2D and 3D transform/path nodes render editor gizmos, each **gated on selection**: visible only while
its owning node is the `SelectionContext.selectedNodePath`.

- **Marker2D**: a "+" cross sized by `gizmo_extents`. **Marker3D**: a 3-axis cross (X red, Y green,
  Z blue) sized by `gizmo_extents`.
- **Path2D / Path3D**: the tessellated Curve2D/Curve3D as a polyline.
- **PathFollow2D / PathFollow3D**: a small handle at the follow point. This handle has no Godot
  equivalent (Godot draws nothing for the follower itself), but it usefully marks "the follower is
  here" when you inspect the node.

This reuses the mechanism already established for 3D light, camera and audio gizmos (WI-UX-14): the
`useGizmoVisible()` hook (`useNodePath()` === `selectedNodePath`), promoted from the lights slice to
`r3f/hooks/useGizmoVisible.ts` so both 2D and 3D slices share it.

Two behaviours are **not** gated, because they are real scene state rather than editor decoration:

- **PathFollow child placement.** The follower positions its children along the parent curve at
  `progress`/`progress_ratio` (with offsets and tangent orientation) whether or not anything is selected.
  Path2D/Path3D therefore always provide their curve to descendants through `Path2DCurveContext` /
  `Path3DCurveContext`, independent of selection. With no curve in scope, the follower falls back to its
  authored transform.
- The nodes always render a transform group that positions their children (the ADR-0008 guarantee).

We chose selection-gating over a viewport toolbar toggle (the `showNavigation`/`showCollisions`/
`showLabels` pattern) deliberately. The toolbar is already busy, and "show only what you are inspecting"
keeps the default view clean without another switch.

## Consequences

- The default view (2D and 3D) stays clean. Gizmos appear only for the inspected node, a conscious
  divergence from Godot's always-on editor.
- ADR-0008 is amended: `Marker3D`/`Path3D`/`PathFollow3D` have real render components instead of
  reusing `Node3D`. They still position children identically (the transform-only guarantee holds). They
  additionally draw a selection-gated gizmo and, for PathFollow3D, follow the curve. The clutter concern
  that motivated ADR-0008's invisibility is resolved by the selection gate, not by reverting to always-on.
- 3D follow orientation is an approximation. It aligns the model-front axis (−Z, or +Z with
  `use_model_front`) to the curve tangent for any non-`NONE` `rotation_mode` (the Y/XY/XYZ/ORIENTED modes
  are not distinguished) and ignores per-point curve tilt. Sufficient for a static preview.
- Gizmos are selection-gated and the headless visual-regression harness drives no selection, so the
  marker crosses and path polylines are not visible in a golden capture. The PathFollow **child
  placement** is, so `unit-pathfollow2d.tscn` (and the 3D follow fixture) carry the visual coverage for
  the curve-following behaviour. The gizmos themselves are covered by component tests that drive
  `SelectionContext` (the `lightHelpers.test.tsx` approach).
- Recorded because an architecture review will re-encounter ADR-0008 and ask why these path and marker
  nodes draw when ADR-0008 said they should not. The answer: selection-gating resolves the clutter
  objection, so the nodes draw when inspected. This was verified against Godot's (always-on) behaviour
  and chosen as a divergence.
