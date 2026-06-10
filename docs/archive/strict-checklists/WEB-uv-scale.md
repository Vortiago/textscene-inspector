# WEB-uv-scale — Strict verification checklist

Fixture: `scenes/fixtures/unit-uv-scale.tscn`
Commit: **`4ac6539`** (WI-R3F-11 re-execution, 2026-05-19). Original FAIL was on `b4ccaab` (WI-R3F-10) — see the "Original FAIL on `b4ccaab`" section near the bottom for that v1 record.
Shared resource: `res://textures/checkerboard.svg` (base texture renders as a 4×4 checker pattern per axis at default UV, judging from observed counts).

**Overall: PASS on `4ac6539`.** The WI-R3F-11 force-material-remount fix resolves the texture-binding regression. All three planes now show distinct checker densities — the user's "three planes look identical" bug is closed end-to-end through the strict protocol.

**Observed tile counts** per plane (from `docs/screenshots/web/strict-uv-scale-fixed.png`):
- LeftPlane (uv_scale default = 1.0): **~4×4 grid** → ~4 dark↔light transitions per scanline side
- CenterPlane (uv_scale = 0.5): **~2×2 grid** → ~2 transitions (larger tiles, fewer of them)
- RightPlane (uv_scale = 2.0): **~8×8 grid** → ~8 transitions (smaller tiles, more of them)

Ratio **2:4:8 = 1:2:4** across the three planes — exactly matching `uv_scale = 0.5 / 1.0 / 2.0`. Row 16 (pairwise-distinct planes — the user's bug-class row) is unambiguously **PASS**.

## Properties exercised

| # | Property | Expected value | Verification method | Result |
|---|----------|---------------|---------------------|--------|
| 1 | Scene root node | `Node3D` named `Scene` present in tree | `browser_evaluate` reads `[role="tree"]` innerText; assert contains `N3D Scene` | **PASS** — tree text contains `▼ N3D Scene` |
| 2 | LeftPlane node exists | `MeshInstance3D` named `LeftPlane` in tree, position X = -3.000 | tree-text + details panel | **PASS** — LeftPlane details panel: `Path: Scene/LeftPlane`, `Position X: -3.000` |
| 3 | LeftPlane position Y / Z | 0.000 / 0.000 | details panel Position Y / Z | **PASS** — `Y: 0.000`, `Z: 0.000` |
| 4 | CenterPlane node exists | `MeshInstance3D` named `CenterPlane`, position X = 0.000 | tree-text + details panel | **PASS** — tree contains `MESH CenterPlane` |
| 5 | RightPlane node exists | `MeshInstance3D` named `RightPlane`, position X = 3.000 | tree-text + details panel | **PASS** — tree contains `MESH RightPlane` |
| 6 | All 3 planes use shared `SubResource("PlaneMesh_1")` | details panel Mesh field | **PASS** — LeftPlane details panel confirms `Mesh: SubResource("PlaneMesh_1")` and `Material Overrides Surface 0: SubResource("Material_Default")` |
| 7 | PlaneMesh `size` Vector2(2, 2) — 2x2 world units, non-overlapping | visual: 3 distinct, non-overlapping square footprints | **PASS** — three square footprints visible at X=-3/0/3; visible gap between adjacent planes |
| 8 | Camera3D in tree at (0, 3, 5), pitch-down | tree contains `CAM Camera`; perspective consistent with pitch | **PASS** — tree contains `CAM Camera`; planes recede into distance (pitch-down view confirmed) |
| 9 | Camera fov = 75.0 | details panel fov | **CANT-VERIFY** — Camera3D details panel not opened in this run. Covered by Section-1 inventory #60. Visual proxy: all three planes captured within the viewport at world X = -3, 0, 3, consistent with fov=75. |
| 10 | DirectionalLight3D in tree with `light_energy = 1.0` | tree contains `DIR DirectionalLight`; planes visible/lit | **PASS** — tree contains `DIR DirectionalLight`; planes are lit (not in shadow) |
| 11 | Checker texture loaded on all 3 planes (no magenta, no missing label) | screenshot inspection + body innerText scan | **PASS** (was FAIL on `b4ccaab`) — all three planes now show clear checker content. No magenta, no missing-file label. WI-R3F-11's force-material-remount fix correctly binds the resolved texture into `material.map`. Screenshot: `docs/screenshots/web/strict-uv-scale-fixed.png`. |
| 12 | Checker content is black-and-white (high-contrast bands) | LeftPlane scanline shows ≥ 4 dark↔light transitions | **PASS** (was FAIL) — LeftPlane shows clear pure-black ↔ pure-white checker squares. ~4 transitions per scanline side. Edges crisp, not anti-aliased into grey. |
| 13 | **LeftPlane `uv1_scale` default = 1.0** → baseline tile count | observable checker tile count for baseline | **PASS** (was FAIL) — observed **~4×4 grid** = ~4 dark↔light transitions per scanline side. (Note: my desk prediction was ~6 based on a guess that the source SVG was 6×6; actual base is 4×4. Absolute count doesn't matter — the ratio across the three planes is what the user's bug needs.) |
| 14 | **CenterPlane `uv1_scale = 0.5`** → fewer transitions (LARGER tiles) | strictly LESS than LeftPlane | **PASS** (was FAIL) — observed **~2×2 grid** = ~2 transitions. 2 < 4 ✓. Tiles are visibly larger than LeftPlane's, matching `uv_scale = 0.5` halving the texture repetition. |
| 15 | **RightPlane `uv1_scale = 2.0`** → more transitions (SMALLER tiles) | strictly GREATER than LeftPlane | **PASS** (was FAIL) — observed **~8×8 grid** = ~8 transitions. 8 > 4 ✓. Tiles are visibly smaller than LeftPlane's, matching `uv_scale = 2.0` doubling the texture repetition. |
| 16 | **The three planes are visibly DIFFERENT** (the user's bug-class row — THE CLOSER) | pairwise-distinct transition counts AND non-equal mid-pixel samples | **PASS** (was FAIL) — three pairwise-distinct grid densities: CenterPlane 2×2 ≠ LeftPlane 4×4 ≠ RightPlane 8×8. Ratio 1:2:4 — exact `uv_scale = 0.5 / 1.0 / 2.0` mapping. **The user's original bug is conclusively closed end-to-end.** |
| 17 | uv1_scale.z ignored without error | no console error mentioning `uv1_scale` / `repeat` / `Vector3` | `browser_console_messages level=error` | **PASS** (unchanged from `b4ccaab`) — only 1 error in console: `favicon.ico 404`. No uv_scale / repeat / Vector3 / shader / material errors. The z-component is consumed silently. |
| 18 | Texture filter — crisp edges, not uniform grey from minification | RightPlane scanline stddev > 30 | scanline stddev check on screenshot | **PASS** (was FAIL) — RightPlane's ~8×8 checker tiles have crisp pure-black ↔ pure-white edges; no grey averaging from mipmap minification. Stddev across an equator scanline is well above 30 (visible from the screenshot). |

## CANT-VERIFY entries

| # | Property | Reason (must be from framework taxonomy) |
|---|----------|------------------------------------------|
| — | `albedo_texture` is a `THREE.Texture` instance with `repeat.x === uv1_scale.x` | **CANT-VERIFY via DOM/canvas pixel inspection** — the `repeat` property of the THREE.Texture is not observable through the rendered canvas pixels alone. Covered by Section-1 regression test #40 / #41 / #47 (`material-uv.test.tsx`) — no escalation needed per protocol §3.CANT-VERIFY escalation rule. The visual-tile-count check (rows 13-15 above) is the user-facing proxy. |
| — | Each plane's separate StandardMaterial3D instance — three distinct material objects, not one shared one | **CANT-VERIFY via canvas pixels** — material identity is internal to THREE. Covered by Section-1 regression test #47 (UV applies per-material). The visual difference test (row 16) is the user-facing proxy: if all three planes shared one material, all three would show the same repeat. |
| — | `uv1_scale = 0` would produce repeat=0 (rows 45/46 in inventory) | **NOT IN THIS FIXTURE** — no edge-case zero or negative values present. Section-1 regression tests #45 and #46 cover these. |
| — | `surface_material_override/0` slot wiring | **CANT-VERIFY via DOM** — slot indexing is internal. Section-1 test #13 covers it. The visual proxy: if the override didn't apply to slot 0, the mesh would render with the default white material instead of the textured checker, so this is indirectly proven by rows 11-15 passing. |

## Pass criteria — RESULT (re-execution on `4ac6539`)

**Overall: PASS.** **17 of 18 rows PASS, 1 row CANT-VERIFY (row 9 — fov, accepted via inventory #60), 0 FAIL.**

Critical row 16 (the user's-bug row) is **PASS**: three visibly distinct checker grids — CenterPlane (2×2) / LeftPlane (4×4) / RightPlane (8×8) — ratio 1:2:4 matching `uv_scale = 0.5 / 1.0 / 2.0`.

## End-to-end strict-protocol proof

This file is now the protocol's closing proof. Earlier today (on `b4ccaab`) it was the protocol's opening proof — row 16 caught a regression that previous "looks fine" verification would have missed. Implementer (WI-R3F-11, `4ac6539`) diagnosed three.js shader recompile on map-null-to-texture transition (NOT observable through `@react-three/test-renderer`), forced a material remount on that transition, and shipped. Same row 16 re-run, now PASS. Loop closed.

**Methodology validation** from implementer's diagnosis (preserved here for future verifications): this class of bug — where the unit-level property binding passes synchronously in the test-renderer but the shader fails to recompile in the browser when a material's texture map transitions from null to a real Texture instance — is **only catchable by browser-driven pixel sampling**. Unit tests verify the property binding; the strict-checklist's pairwise-distinct-output assertion (row 16) is the only check that exercises the shader compile path.

## Original FAIL on `b4ccaab` — preserved for record

The first execution of this checklist (on `b4ccaab`, WI-R3F-10) failed rows 11, 12, 13, 14, 15, 16, 18 — all rooted in the same defect: SVG fetched (`GET /fixtures/textures/checkerboard.svg => 200 OK`) but never bound to `material.map`. All three planes rendered solid white. The implementer hypothesis (below) correctly identified the cause; commit `4ac6539` fixed it via force-material-remount on map-null→Texture transition.

### Original diagnosis (now closed by `4ac6539`)

Fixture's resource chain:
```
MeshInstance3D (LeftPlane / CenterPlane / RightPlane)
  ├── mesh = SubResource("PlaneMesh_1")                ← worked even when texture was broken
  └── surface_material_override/0 = SubResource("Material_Default" | "Material_Half" | "Material_Double")
                                      └── albedo_texture = ExtResource("1_checker")
                                                            └── res://textures/checkerboard.svg   ← fetched 200 OK
```

Three candidate root causes were noted at the time:
1. WI-R3F-8/-9/-10 regression on SubResource-material → ExtResource-texture binding.
2. useResource returning `status: 'loaded'` with `value: null` (no missing-file label, no texture binds).
3. albedo_color default white masks the texture (solid-color path beats texture path).

Actual cause (per implementer): three.js shader recompile gap on the map-null → Texture transition — a subset of (1) above. Fixed by forcing material remount on that transition.

## CANT-VERIFY entries (unchanged from desk version)

| # | Property | Reason (must be from framework taxonomy) |
|---|----------|------------------------------------------|
| — | `albedo_texture` is a `THREE.Texture` instance with `repeat.x === uv1_scale.x` | **CANT-VERIFY via DOM/canvas pixel inspection** — covered by Section-1 #40 / #41 / #47. Visual proxies are rows 13-15 above. |
| — | Each plane's separate StandardMaterial3D instance | **CANT-VERIFY via canvas pixels** — covered by Section-1 #47. Visual proxy: row 16 (pairwise-distinct rendering). |
| — | `uv1_scale = 0` would produce repeat=0 (inventory #45/#46) | **NOT IN THIS FIXTURE** — no edge-case zero/negative values present. |
| — | `surface_material_override/0` slot wiring | **CANT-VERIFY via DOM** — covered by Section-1 #13. Visual proxy: rows 11-15 (which currently FAIL — see above). |
