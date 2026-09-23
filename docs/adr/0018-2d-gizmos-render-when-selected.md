# Transform/path nodes (2D and 3D) draw editor gizmos, gated on selection

- Status: Accepted
- **Amends ADR-0008** for `Marker3D`/`Path3D`/`PathFollow3D`, which are no longer fully invisible
  (see below). The rest of the transform-only set of ADR-0008 (physics bodies, `Skeleton3D`,
  unsupported types) is unchanged.
- Related: ADR-0006 (viewport-mode seam) and the light-gizmo selection gate.

## Context

**Marker2D**, **Path2D**, **PathFollow2D** and their 3D twins **Marker3D**, **Path3D**,
**PathFollow3D** draw editor gizmos. ADR-0008 made the 3D types deliberately **invisible**
transform-only groups, because always-on gizmos in the 3D viewport are clutter that shows nothing
meaningful.

### What Godot does (from the engine source)

The Godot editor draws these gizmos **always**, not only for the selection:

- **Marker2D / Marker3D**: the cross is drawn for *every* marker in the open scene, always.
  `marker_2d.cpp` draws it in `NOTIFICATION_DRAW` under `is_editor_hint()`. `Marker3D.xml` states it
  "displays as a cross in the 3D editor at all times" (its gizmo plugin draws it for all instances).
- **Path2D / Path3D**: the curve **line** is drawn always for every path. `path_2d.cpp`'s
  `_debug_update` has no selection check, and the Path3D gizmo plugin draws the spline plus
  "fishbones" for all instances. Only the editable Bézier **control-point handles** are scoped to the
  selected or edited node.
- **PathFollow2D / PathFollow3D**: **no gizmo of their own**. What shows is the curve of the parent
  path.

So the selection gate here is a **deliberate divergence** from Godot, against the clutter ADR-0008
fought. A field with many markers or paths otherwise fills the viewport.

## Decision

The 2D and 3D transform/path nodes render editor gizmos, each **gated on selection**: visible only while
its owning node is the `SelectionContext.selectedNodePath`.

- **Marker2D**: a "+" cross sized by `gizmo_extents`. **Marker3D**: a 3-axis cross (X red, Y green,
  Z blue) sized by `gizmo_extents`.
- **Path2D / Path3D**: the tessellated Curve2D/Curve3D as a polyline.
- **PathFollow2D / PathFollow3D**: a small handle at the follow point. Godot draws nothing for the
  follower itself, but the handle marks where the follower is when you inspect the node.

This reuses the mechanism of the 3D light, camera and audio gizmos: the `useGizmoVisible()` hook
(`useNodePath()` === `selectedNodePath`), in `r3f/hooks/useGizmoVisible.ts` so both 2D and 3D slices
share it.

Two behaviours are **not** gated, because they are real scene state rather than editor decoration:

- **PathFollow child placement.** The follower positions its children along the parent curve at
  `progress`/`progress_ratio` (with offsets and tangent orientation) whether or not anything is selected.
  Path2D/Path3D therefore always provide their curve to descendants through `Path2DCurveContext` /
  `Path3DCurveContext`, independent of selection. With no curve in scope, the follower falls back to its
  authored transform.
- The nodes always render a transform group that positions their children (the ADR-0008 guarantee).

Rejected: a viewport toolbar toggle (the `showNavigation`/`showCollisions`/`showLabels` pattern). The
toolbar is already busy, and "show only what you inspect" keeps the default view clean without another
switch.

## Consequences

- The default view (2D and 3D) stays clean. Gizmos appear only for the inspected node, a conscious
  divergence from the always-on Godot editor.
- ADR-0008 is amended: `Marker3D`/`Path3D`/`PathFollow3D` have real render components instead of
  reusing `Node3D`. They still position children identically (the transform-only guarantee holds). They
  also draw a selection-gated gizmo and, for PathFollow3D, follow the curve. The selection gate, not
  invisibility, answers the clutter concern of ADR-0008.
- 3D follow orientation is an approximation. It aligns the model-front axis (−Z, or +Z with
  `use_model_front`) to the curve tangent for any non-`NONE` `rotation_mode` (the Y/XY/XYZ/ORIENTED modes
  are not distinguished) and ignores per-point curve tilt. That is sufficient for a static preview.
- The headless visual-regression harness drives no selection, so no golden capture shows the marker
  crosses or path polylines. The PathFollow **child placement** is visible, so `unit-pathfollow2d.tscn`
  (and the 3D follow fixture) carry the visual coverage for curve following. Component tests that drive
  `SelectionContext` (the `lightHelpers.test.tsx` approach) cover the gizmos.
