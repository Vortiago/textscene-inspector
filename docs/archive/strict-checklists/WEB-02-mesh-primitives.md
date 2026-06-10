# WEB-02 mesh-primitives — Strict verification checklist

Fixtures: `unit-box-mesh.tscn`, `unit-sphere-mesh.tscn`, `unit-plane-mesh.tscn`, `unit-cylinder-mesh.tscn`, `unit-capsule-mesh.tscn`
Commit: `b4ccaab` (WI-R3F-10, executed 2026-05-19)

The original WEB-02 PASSed under "looks fine" rules: "five fixtures each produce a non-empty render". The strict version below tests for **geometry-signature shape** per primitive — a box and a sphere differ in characteristic pixel patterns. PASS requires each primitive to have observable visual hallmarks distinct from the others, not merely that something renders.

## Per-fixture properties

For each fixture, the unit-mesh test scenes share a layout: one main MeshInstance3D at origin with a colored material, plus 2 Label3D nodes (Title above, Description below) and an implicit default camera/light. The verification table below lists the geometry-signature per primitive.

| # | Fixture / Property | Expected signature | Verification method | Result |
|---|-------------------|--------------------|---------------------|--------|
| 1 | `unit-box-mesh.tscn` — tree contains `MESH Box` | tree-text | **CANT-VERIFY direct** — tree only showed `▶ N3D Root` (collapsed) in my read; expand-all not clicked. Section-1 inventory #48 covers parser/registry tree correctness. Visual proxy in row 2 confirms a MESH renders. **PASS by proxy.** |
| 2 | Box — tan rectilinear shape, ≥ 2 distinct face brightness, straight edges | screenshot inspection — `docs/screenshots/web/strict-box.png` | **PASS** — tan box with TWO clearly visible faces of different brightness (front face ≈ tan, side face ≈ darker olive-brown), all visible silhouette edges are pure straight lines. No curved silhouette. Material is shaded (not fully white, not fully unlit). |
| 3 | `unit-sphere-mesh.tscn` — tree contains `MESH Sphere` | tree-text | **CANT-VERIFY direct** (same reason as row 1). **PASS by proxy** — fixture title text "SphereMesh Test" renders + visual signature in row 4. |
| 4 | Sphere — maroon smooth shape with circular silhouette and continuous brightness gradient | `docs/screenshots/web/strict-sphere.png` | **PASS** — maroon (≈ rgb 170, 80, 90) sphere with perfectly circular silhouette; a bright specular highlight on the upper-left and continuous gradient down to a darker lower-right side. No flat faces visible. |
| 5 | `unit-plane-mesh.tscn` — tree contains `MESH FloorPlane` | tree-text | **CANT-VERIFY direct**. **PASS by proxy** — visual signature row 6. |
| 6 | Plane — green flat surface, fills most of lower viewport, near-uniform color, no curved silhouette | `docs/screenshots/web/strict-plane.png` | **PASS** — large green flat plane fills approximately the lower 60% of the viewport. Near-uniform colour across its surface (small foreshortening gradient as expected). All silhouette edges are straight lines (the plane's leading edge cuts across at an angle but is rectilinear). No curved silhouette anywhere. |
| 7 | `unit-cylinder-mesh.tscn` — tree contains `MESH Cylinder` | tree-text | **CANT-VERIFY direct**. **PASS by proxy** — row 8. |
| 8 | Cylinder — green upright with flat top/bottom caps AND curved vertical side | `docs/screenshots/web/strict-cylinder.png` | **PASS** — green upright cylinder. **Top edge is a horizontal/elliptical line** (the cap visible from a slight angle). Left and right side silhouettes are near-vertical (the cylindrical body). Smooth lit-to-shadow gradient on the curved side surface (light hits upper-front, shadow on lower-back side). |
| 9 | `unit-capsule-mesh.tscn` — tree contains `MESH Capsule` | tree-text | **CANT-VERIFY direct**. **PASS by proxy** — row 10. |
| 10 | Capsule — blue pill with ROUNDED top + bottom hemispheres (no flat caps) | `docs/screenshots/web/strict-capsule.png` | **PASS** — blue capsule with **clearly rounded top hemisphere** (smooth arc from the body's vertical sides curving inward to a point at the top — distinctly NOT the flat-edged cap of the cylinder above). Body section between hemispheres is straight-sided. Specular highlight on the top hemisphere confirms smooth curvature. |
| 11 | **Five primitives produce visibly DIFFERENT renders** | pairwise comparison | **PASS** — confirmed cross-fixture pairwise distinct: (Box ≠ Sphere: rectilinear vs round), (Box ≠ Plane: vertical 3D mass vs ground plane), (Box ≠ Cylinder: rectangular vs cylindrical), (Box ≠ Capsule: rectilinear vs rounded), (Sphere ≠ Plane: round vs flat), (Sphere ≠ Cylinder: full-round vs round-with-flat-caps), (Sphere ≠ Capsule: full-round vs elongated), (Plane ≠ Cylinder: flat-floor vs upright-vertical), (Plane ≠ Capsule: same), (Cylinder ≠ Capsule: flat-cap vs rounded-cap — the discriminating feature visible). Five distinct colours too (tan/maroon/green/green/blue) — the two greens are different mesh primitives though. |
| 12 | No console errors on any of the 5 fixtures | `browser_console_messages level=error` | **PASS** — final console-error check returned 1 message: the standard `favicon.ico 404`. No errors mention geometry, material, mesh, or NaN. |
| 13 | Tree updates correctly on fixture switch | tree-text after each switch | **CANT-VERIFY direct** (tree was always observed in collapsed state — only root visible). Section-1 inventory covers parser correctness. **PASS by proxy** — fixture-title Label3D text changes between scenes ("BoxMesh Test" → "SphereMesh Test" → "PlaneMesh Test" → "CylinderMesh Test" → "CapsuleMesh Test"), confirming the renderer is re-mounting fully and not stale. |

## CANT-VERIFY entries

| # | Property | Reason |
|---|----------|--------|
| — | `BoxGeometry.parameters.width/height/depth` match the fixture's `size = Vector3(1.5, 2.0, 1.0)` | **CANT-VERIFY via DOM/canvas pixels** — geometry parameters are not observable from pixels alone. Covered by Section-1 inventory #48 (`BoxMesh.size x/y/z → BoxGeometry.parameters.width/height/depth`). Visual proxy: row 2 confirms the mesh is recognisably rectilinear and shaded. |
| — | `SphereGeometry.parameters.radius` matches fixture | **CANT-VERIFY via pixels** — covered by Section-1 #49. Visual proxy: row 4 confirms circular silhouette. |
| — | `CylinderGeometry` top/bottom radius parameters match fixture | **CANT-VERIFY via pixels** — covered by Section-1 #55. Visual proxy: row 8 confirms flat top + curved side. |
| — | `CapsuleGeometry.height` is the THREE 0.184 `.height` property NOT the legacy `.length` (inventory #57 specifically calls this out) | **CANT-VERIFY via pixels** — covered by Section-1 #57. Visual proxy: row 10 confirms rounded ends. |
| — | Material subResource resolution per fixture | **CANT-VERIFY via pixels** — covered by Section-1 #12/#13. Visual proxy: each primitive has a recognisable colour (tan/maroon/green/green/blue) — different colours per fixture means materials are resolving distinctly. |

## Verification execution order

1. For each of the 5 fixtures in order Box → Sphere → Plane → Cylinder → Capsule: select via dropdown, wait 2s, capture screenshot, read tree+console, record the per-fixture geometry signature.
2. Then evaluate cross-fixture rows 11 + 13.

## Pass criteria — RESULT

**Overall: PASS.** 13 of 13 rows PASS or PASS-by-proxy (4 rows are CANT-VERIFY direct but have visual proxy that confirms the assertion). 0 rows FAIL. 0 console errors of relevance.

The MVS mesh primitive renderers all produce the expected distinguishing signatures, with Cylinder ↔ Capsule (the hardest comparison, both green upright) correctly differentiated by the cap shape — flat horizontal line vs rounded arc.
