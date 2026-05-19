# VSCODE-06 click-to-select — Strict verification checklist

Fixture: `scenes/examples/integration-three-cubes.tscn`
Commit: `4ac6539` (WI-R3F-11, executed 2026-05-19)

The original VSCODE-06 PASSed under "click tree row, details panel populates". The strict version asserts a full tree→details round-trip on a specific node (CenterCube), with each detail field bound to the source content. The CenterCube's `transform = Transform3D(... 0, 0.5, 0)` — translation X=0, Y=0.5, Z=0 — provides a strict assertion target.

Note: this fixture uses `instance = ExtResource("1_cube")` for the three Cube nodes. Per WEB-06's known gap, PackedScene instancing may not render the inner mesh in the viewport, but the tree representation works. This checklist therefore focuses on tree↔details, not on viewport mesh visibility.

## Properties exercised

| # | Property | Expected value | Verification method | Result |
|---|----------|---------------|---------------------|--------|
| 1 | Preview opens for the fixture | tab `Preview: integration-three-cubes.tscn` mounted | snapshot tab | **PASS** — snapshot line 337: `tab "Preview: integration-three-cubes.tscn, Editor Group 5" [selected] [ref=e2947]`. |
| 2 | Tree shows ThreeCubes root | `treeitem "Expand N3D ThreeCubes"` | snapshot | **PASS** — line 478: `treeitem "Collapse N3D ThreeCubes Hide node" [expanded] [ref=f6e27]`. |
| 3 | After Expand-all, 4 children visible | LeftCube, CenterCube, RightCube (Node3D), DirectionalLight | snapshot tree-row count | **PASS** — children at lines 484 (`Dir Light`), 490 (`N3D RightCube`), 497 (`N3D CenterCube`), 504 (`N3D LeftCube`). 4 children exact match. |
| 4 | Each cube shows external-scene marker | each Node3D cube treeitem includes `📦` | snapshot | **PASS** — lines 495 (`f6e43`), 502 (`f6e51`), 509 (`f6e59`) each carry `generic "External scene: ExtResource(\"1_cube\")"` with content `📦`. |
| 5 | CenterCube has transform marker | tree row contains `⌖` | snapshot | **PASS** — line 501: `generic "Has transform" [ref=f6e50]: ⌖`. |
| 6 | Initial state — no node selected | details region shows `Select a node to see its properties.` | snapshot | **PASS** — line 511 (pre-click): `generic [ref=f6e26]: Select a node to see its properties.` |
| 7 | Click CenterCube tree row | heading "CenterCube" appears in details | click + snapshot | **PASS** — post-click snapshot line 512: `heading "CenterCube" [level=3] [ref=f6e61]`. |
| 8 | CenterCube Type | `Node3D` | details panel | **PASS** — line 516: `Node3D`. Fixture's `type="Node3D"` preserved (instance annotation does NOT change the declared type). |
| 9 | CenterCube Path | `ThreeCubes/CenterCube` | details panel | **PASS** — line 519: `ThreeCubes/CenterCube`. |
| 10 | CenterCube Parent | `.` (root child) | details panel | **PASS** — line 522: `.`. |
| 11 | CenterCube external-scene reference | `External scene: ExtResource("1_cube")` shown | snapshot | **PASS** — lines 524-525 in details: `📦 External:` + `ExtResource("1_cube")`. Plus tree row 502 already exposes the same. |
| 12 | CenterCube Position X | 0.000 | details Position | **PASS** — line 531: `"0.000"`. |
| 13 | CenterCube Position Y | 0.500 | details Position | **PASS** (critical row) — line 534: `"0.500"`. Exact match with fixture line 12 `Transform3D(..., 0, 0.5, 0)`. |
| 14 | CenterCube Position Z | 0.000 | details Position | **PASS** — line 537: `"0.000"`. |
| 15 | CenterCube Rotation = identity | X/Y/Z = 0.00 | details Rotation | **PASS** — lines 542/545/548: all three `"0.00"`. |
| 16 | CenterCube Scale = identity | X/Y/Z = 1.000 | details Scale | **PASS** — lines 553/556/559: all three `"1.000"`. |
| 17 | Click LeftCube row → details switches | heading "LeftCube", Position X = -3.000 | click + snapshot | **PASS** (critical row) — `v06-left.txt` line 512: `heading "LeftCube"`; line 530: Position X `"-3.000"`. Exact match with fixture line 8 `Transform3D(..., -3, 0.5, 0)`. |
| 18 | Click RightCube row → details switches | heading "RightCube", Position X = 3.000 | click + snapshot | **PASS** (critical row) — `v06-right.txt` line 514: `heading "RightCube"`; line 532: Position X `"3.000"`. Exact match with fixture line 16 `Transform3D(..., 3, 0.5, 0)`. |
| 19 | No console errors during interaction | no new ERROR entries | console scan | **PASS** — console state unchanged (1 marketplace 404 + 1 THREE.Clock warning, both pre-existing). |

## CANT-VERIFY entries

| # | Property | Reason |
|---|----------|--------|
| — | Viewport click-to-tree direction (clicking canvas at cube position selects CenterCube in tree) | **CANT-VERIFY from outside the cross-origin webview** — Playwright can't reliably target pixel coordinates inside the webview iframe. The `useViewportSelection` hook (WI-R3F-4) is unit-tested. |
| — | PackedScene inner mesh renders in viewport | **NOT IN VSCODE-06 SCOPE** — PackedScene instancing gap is a separate known issue per WEB-06; the tree-↔-details round-trip works regardless. |

## Verification execution order

1. Quick-open `integration-three-cubes.tscn`. Run preview command.
2. Click webview's "Expand all" button.
3. Apply rows 1-6.
4. Click CenterCube tree row. Apply rows 7-16.
5. Click LeftCube row. Apply row 17.
6. Click RightCube row. Apply row 18.
7. Console scan. Apply row 19.

## Pass criteria — RESULT

**Overall: PASS. 19 of 19 rows PASS, 0 FAIL.**

Critical rows 13 (CenterCube Y=0.500), 17 (LeftCube X=-3.000), and 18 (RightCube X=3.000) all PASS — three distinct X-axis positions captured across three separate tree clicks, proving the SelectionContext correctly maps tree-row clicks to per-node details.

Screenshot: `docs/screenshots/vscode/strict-vscode-06-click-to-select.png`.
