# 2D transform/path nodes draw editor gizmos, gated on selection

- Status: Accepted (2026-06-24)
- Relates to / narrows ADR-0008 (non-visual nodes render as invisible transform-only groups).
- Relates to ADR-0006 (viewport-mode seam) and the WI-UX-14 light-gizmo selection gate.

## Context

Issue #129 adds **Marker2D**, **Path2D**, and **PathFollow2D** — the 2D twins of
`Marker3D`/`Path3D`/`PathFollow3D`. ADR-0008 made those 3D types deliberately **invisible**
transform-only groups and explicitly warned the next reader not to "wire up these node types so they
render", because in the **3D** viewport they are clutter that depicts nothing meaningful in a static
preview.

But ADR-0008's reasoning is scoped to the 3D viewport. The 2D workspace (`Canvas2DStage`, ADR-0006) is
already an editor-like surface: it draws an origin cross and a frame boundary as non-scene decorations,
and Godot's own 2D editor draws a Marker2D cross, a Path2D curve polyline, and a PathFollow2D handle for
these node types. Issue #129's acceptance criteria explicitly ask for the marker gizmo, the path curve,
and the follow offset to be visible. So the 2D twins genuinely need to draw something — yet a previewer
that draws every marker/curve unconditionally reproduces exactly the clutter ADR-0008 fought (a scene
with many `Marker2D` anchors becomes a field of crosses).

## Decision

The 2D transform/path nodes render their editor gizmos, but each gizmo is **gated on selection** —
visible only while its owning node is the `SelectionContext.selectedNodePath`:

- **Marker2D** draws a small "+" cross sized by `gizmo_extents`.
- **Path2D** draws its tessellated Curve2D as a white polyline.
- **PathFollow2D** draws a small follow-point handle.

This reuses the **exact mechanism already established for 3D light/camera/audio gizmos** (WI-UX-14):
the `useGizmoVisible()` hook (`useNodePath()` === `selectedNodePath`). That hook was promoted from the
lights slice to `r3f/hooks/useGizmoVisible.ts` so 2D slices share it.

Two behaviours are **not** gated, because they are real scene state rather than editor decoration:

- **PathFollow2D child placement.** The follower positions its children along the parent curve at
  `progress`/`progress_ratio` (with `h_offset`/`v_offset`/`rotates`) whether or not anything is
  selected — that is where the nodes actually are. Path2D therefore always provides its curve to
  descendants via `Path2DCurveContext`, independent of selection. With no curve in scope, PathFollow2D
  falls back to its authored transform (matching PathFollow3D / ADR-0008).
- The nodes always render a transform group that positions their children (the ADR-0008 guarantee).

We chose selection-gating over a viewport toolbar toggle (the `showNavigation`/`showCollisions`/
`showLabels` pattern) deliberately: the toolbar is already busy, and "show only what you're inspecting"
keeps the default view clean without another switch.

## Consequences

- The default 2D view stays clean; gizmos appear only for the inspected node. This is a **conscious
  divergence** from Godot (which draws these gizmos always) chosen for a viewer rather than an editor.
- A new `useGizmoVisible` home (`r3f/hooks`) is shared by 3D and 2D gizmos; `lightHelpers.tsx`
  re-exports it for its existing importers.
- Because the gizmos are selection-gated and the headless visual-regression harness drives no
  selection, the marker cross and path polyline are not directly visible in a golden capture; the
  PathFollow2D **child placement** is, so `unit-pathfollow2d.tscn` carries the visual coverage for the
  curve-following behaviour. The gizmos themselves are covered by component tests that drive
  `SelectionContext` (the same approach as `lightHelpers.test.tsx`).
- Recorded because an architecture review will re-encounter ADR-0008 and ask why the 2D path nodes draw
  when the 3D ones don't. The answer is: viewer-vs-editor surface + selection-gating, not an oversight.
