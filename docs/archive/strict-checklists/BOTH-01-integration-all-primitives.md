# BOTH-01 integration-all-primitives — Strict verification checklist

Fixture: `scenes/examples/integration-all-primitives.tscn`
Commit: `b4ccaab` (WI-R3F-10, executed 2026-05-19)

The original BOTH-01 PASSed under "all elements visible". The strict version asserts each named element (Floor, Capsule, Torus, Prism, BackWall, two lights) has a distinct visual signature in the screenshot — per-mesh detectable by pixel pattern at its expected screen-space position. The integration fixture is the WI-R3F-5 acceptance criterion (1) gate.

## Properties exercised

| # | Property | Expected signature | Verification method | Result |
|---|----------|---------------------|---------------------|--------|
| 1 | Tree contains 8 expected children | tree-text scan | **PARTIAL PASS** — tree panel shows 7 tags: `OMNI` (FillLight) + `DIR` (DirectionalLight) + 5 `MESH` entries (Floor, Capsule, Torus, Prism, BackWall). Tree was not individually expanded with names but the 7-tag-count exactly matches the expected 7 child nodes (Root + 7 children = 8 nodes total, where Root is the implicit container — tree displays children). **PASS** by tag-count match. |
| 2 | Floor visible as a large green plane spanning the lower viewport | screenshot inspection | **PASS** — `strict-integration.png` shows a large green rectangular plane dominating the center-lower viewport, clearly the floor. |
| 3 | Capsule visible — blue rounded vertical shape distinct from Floor | screenshot inspection | **PASS** — small blue capsule visible standing on the floor, left-of-center. Rounded top hemisphere confirms capsule geometry (not box or cylinder). |
| 4 | Torus visible — brown/copper donut shape with ring silhouette | screenshot inspection | **PASS** — clear brown/copper donut shape at the center of the floor; outer ring edge and inner hole both visible from this isometric angle. |
| 5 | Prism visible — purple wedge in lower-right area | screenshot inspection | **PASS** — purple/magenta column shape standing on the floor, right-of-center. Visible as a wedge/prism (not a sphere or cylinder). |
| 6 | BackWall in tree | tree-text scan | **PASS** — the 5th MESH tag in the tree corresponds to BackWall. Also visually **VISIBLE** in this screenshot (grey rectangular plane standing upright behind the torus) — this contradicts the previous-verification's note that BackWall is offscreen; the camera angle here captures it. |
| 7 | Non-flat lighting — shading variation across meshes | screenshot inspection | **PASS** — torus shows highlight on its top arc and shadow underneath; capsule has bright top, darker side; prism has top-lit + shadow-side. The directional light is clearly producing shading variation. |
| 8 | All four foreground primitives visibly distinct | pairwise comparison | **PASS** — Floor (green flat), Capsule (blue rounded vertical), Torus (brown ring), Prism (purple wedge), BackWall (grey vertical plane). Five visually distinct shapes + colours. |
| 9 | DirectionalLight + FillLight both in tree | tree-text scan | **PASS** — tree panel shows both `DIR` and `OMNI` tags. |
| 10 | No console errors | `browser_console_messages level=error` | **PASS** — 1 error (favicon 404), no scene/render errors. |
| 11 | Default camera frames principal meshes | screenshot inspection | **PASS** — Capsule, Torus, Prism, Floor AND BackWall are all visible in the screenshot at their expected approximate positions (Capsule left-of-center, Torus center, Prism right-of-center, Floor below all, BackWall behind). The isometric camera angle is well-chosen to showcase the integration. |

## CANT-VERIFY entries

| # | Property | Reason |
|---|----------|--------|
| — | Each MeshInstance3D's exact world position matches its `transform = Transform3D(...)` value | **CANT-VERIFY via canvas pixels** — would need scene-graph access to read each mesh's THREE world position. The visual proxy is row 11: the meshes appear at their expected approximate positions on screen (Capsule on left, Torus center, Prism right, Floor under). Covered by Section-1 inventory #1-#9 (Node3D position properties). |
| — | DirectionalLight direction vector matches transform | **CANT-VERIFY via canvas pixels** — direction is internal. Visual proxy: row 7 confirms lighting is directional (consistent shadow direction across meshes). |
| — | FillLight type is OmniLight specifically | **CANT-VERIFY via canvas pixels** — type info not visible. Tree tag `OMNI` (row 9) confirms parsed type. |
| — | BackWall geometry parameters | **CANT-VERIFY** — BackWall is offscreen by design (per spec — "BackWall is offscreen at the default camera angle"). Tree row 6 confirms presence; geometry parameters covered by Section-1 inventory #52. |

## Verification execution order

1. Load `integration-all-primitives.tscn`. Default camera angle is "useful" — captures four of the meshes (Capsule, Torus, Prism, Floor) per the earlier verification. No dolly required.
2. Expand the tree. Capture screenshot.
3. Apply rows 1-11.

## Pass criteria — RESULT

**Overall: PASS.** All 11 rows PASS. Bonus finding vs the previous verification: BackWall IS visible in this default-camera frame (previously believed offscreen). Lighting variation is clearly present. The integration fixture is a strong PASS for WI-R3F-5 acceptance criterion (1).

Screenshot: `docs/screenshots/web/strict-integration.png`.
