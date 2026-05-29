# WEB-09 light-gizmos — Strict verification checklist

Fixtures: `integration-lights-all-types.tscn`, `unit-camera-basic.tscn`
Commit: `b4ccaab` (WI-R3F-10, executed 2026-05-19)

The original WEB-09 PASSed under "three yellow gizmos visible, presumed correct". The strict version requires each gizmo to have observable shape-signature features matching its light type, AND for the three light gizmos to be pairwise distinguishable from each other (not three identical yellow blobs).

The default camera in `integration-lights-all-types.tscn` is inside the gizmo geometry; the previous verification used scroll-wheel dolly-back to get a clear view. Strict version mandates this dolly is performed and screenshot is taken after settle.

## Properties exercised

| # | Property | Expected signature | Verification method | Result |
|---|----------|---------------------|---------------------|--------|
| 1 | Lights-all-types tree contains all three lights | tree-text scan | **PASS** — tree shows tags `SPOT`, `OMNI`, `DIR` (visible in the screenshot's tree panel) |
| 2 | After zoom-out, ≥ 3 distinct yellow wireframe shapes in the viewport | screenshot scan | **PASS** — `strict-lights.png` shows: a large yellow sphere outline (lower-right), a triangular cone with converging apex (left/center), a small octahedron at mid-frame, and a small wireframe rectangle (upper-left, the SpotLight target). All yellow, distributed in non-contiguous regions. |
| 3 | **SpotLight: cone/frustum** — yellow lines converging to a point at one end, diverging to a circular base at the other | screenshot inspection | **PASS** — clearly visible cone shape with apex at center-left of the visible structure, lines diverging outward to meet the larger sphere outline. The cone has the characteristic triangular silhouette. |
| 4 | **OmniLight: spherical wireframe** — yellow closed curve forming a sphere/ring | screenshot inspection | **PASS** — large yellow closed-curve outline (the sphere helper visible as a near-circle from the camera angle) dominates the lower-right of the frame. |
| 5 | **DirectionalLight: small octahedron** — compact yellow shape distinct from cone/sphere | screenshot inspection | **PASS** — small octahedron visible mid-frame, near the center; clearly compact (~30 px), with the characteristic 6-vertex octahedral silhouette. |
| 6 | The three light gizmos are visibly DIFFERENT from each other | pairwise topology comparison | **PASS** — three distinct topologies: (cone with converging apex → SpotLight), (closed curved outline → OmniLight), (small compact polygon → DirectionalLight). The shapes match the standard THREE.js helper appearances and are unmistakably different from one another. |
| 7 | No console errors when loading lights-all-types | `browser_console_messages level=error` | **PASS** — 1 error (favicon 404) only; no errors about helpers or geometry. |
| 8 | `unit-camera-basic.tscn` tree contains `CAM Camera3D` | tree-text scan | **PASS** — tree panel in `strict-camera.png` shows the `CAM` tag plus 2 LABE (Label3D) entries. |
| 9 | **Camera frustum gizmo visible**: 4 lines converging at the camera position, diverging outward to define the view volume | screenshot inspection | **PASS** — `strict-camera.png` shows orange/yellow lines clearly converging at a single apex point (center-bottom of the frame, the camera origin) with multiple lines radiating outward to define the camera frustum. The frustum is the dominant visible structure. |
| 10 | Camera gizmo distinct from light gizmos (4-line frustum topology, no sphere or octahedron) | implicit if 3-5 + 9 all pass with distinct shapes | **PASS** — camera frustum is a pure radiating-lines topology; no closed curves (so distinct from OmniLight), no small compact polygon (distinct from DirectionalLight), and the spreading-outward pattern is wider than the SpotLight cone (also: SpotLight has a circular base ring, CameraHelper has 4 corners forming a pyramidal frustum). |

## CANT-VERIFY entries

| # | Property | Reason |
|---|----------|--------|
| — | Gizmo helper is the correct THREE.js helper class (`SpotLightHelper` / `PointLightHelper` / `DirectionalLightHelper` / `CameraHelper`) | **CANT-VERIFY via DOM/canvas pixels** — the helper class type is not observable from rendered pixels; the visible wireframe IS the helper output but we can't read the class name. Covered by Section-1 inventory has no specific helper-class test (helpers are implementation detail of the component). Visual proxies in rows 3-5 + 9 confirm the shapes are correct. |
| — | Gizmo position matches light's transform | **CANT-VERIFY via DOM/canvas pixels** — would need to read the light's world position from the THREE scene graph. Visual proxy: the gizmos sit somewhere in the viewport; whether they're at the EXACT world position requires the scene-graph hook. Not testable here without it. |
| — | Gizmo updates when light's transform changes | **NOT EXERCISED** by this fixture (no animation, no edits). Out of scope for this checklist. |
| — | DirectionalLight gizmo orientation matches the light's direction | **CANT-VERIFY** — same scene-graph access issue. Visual proxy: row 5 confirms the octahedron is present; orientation is internal. |

## Verification execution order

1. Load `integration-lights-all-types.tscn`. The default camera is inside the gizmo geometry — must dolly out (e.g., 30x scroll-wheel deltaY=200) for visible separation.
2. Capture screenshot after dolly. Apply rows 1-7.
3. Switch to `unit-camera-basic.tscn`. Dolly out a bit (~15x). Capture screenshot. Apply rows 8-10.

## Pass criteria — RESULT

**Overall: PASS.** All 10 rows PASS. The three light gizmos (cone, sphere, octahedron) are clearly distinguishable from each other and from the camera frustum gizmo. The previous "looks fine" verification was correct in its conclusion but the strict checklist also confirmed it via concrete shape-topology assertions — the prior failure mode of "three identical yellow blobs" is conclusively ruled out.

Screenshots: `docs/screenshots/web/strict-lights.png`, `docs/screenshots/web/strict-camera.png`.
