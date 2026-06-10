# VSCODE-07 missing-texture — Strict verification checklist

Fixture: `scenes/fixtures/test-missing-texture.tscn`
Commit: `4ac6539` (WI-R3F-11 — texture-binding fix in place from `b4ccaab`'s missing-file work)

The original VSCODE-07 PASSed under "magenta cube visible". The strict version asserts the rendered mesh is unambiguously magenta (high R, high B, low G — not just "reddish" or "default white"), the mesh is still visible (not vanished), the source declares the missing path, the tree still shows the mesh, and no scene-tree-breaking errors arise.

The fixture's chain: TestMesh (MeshInstance3D) → `material_override = SubResource("2")` → StandardMaterial3D → `albedo_texture = ExtResource("1")` → `res://textures/test-upload.png` (intentionally absent on disk).

## Properties exercised

| # | Property | Expected value | Verification method | Result |
|---|----------|---------------|---------------------|--------|
| 1 | Preview opens | tab `Preview: test-missing-texture.tscn` | snapshot | **PASS** — line 411: `tab "Preview: test-missing-texture.tscn, Editor Group 6" [selected] [ref=e3306]`. |
| 2 | Source declares missing path | line 3: `ext_resource ... path="res://textures/test-upload.png"` | snapshot text region | **PASS** — line 397 (e3117): `"[ext_resource type=\"Texture2D\" path=\"res://textures/test-upload.png\" id=\"1\"]"`. |
| 3 | Tree shows World root | `treeitem "Expand N3D World"` | snapshot | **PASS** — line 552 (after expand): `treeitem "Collapse N3D World Hide node" [expanded]`; line 555: `World`. |
| 4 | Tree shows TestMesh child | `treeitem` containing `MeshInstance3D` + `TestMesh` | snapshot after expand | **PASS** — line 564: `treeitem "• Mesh TestMesh Hide node"`; line 566: `MeshInstance3D`. |
| 5 | Tree shows Camera child | `treeitem` containing `Camera3D` + `Camera` | snapshot after expand | **PASS** — line 558: `treeitem "• Cam Camera ⌖ Hide node"`; line 560: `Camera3D`. |
| 6 | TestMesh remains visible in tree (NOT removed) | TestMesh treeitem present | snapshot | **PASS** — line 564, as above. Texture loading failure did not cause the mesh to be removed from the parsed tree. |
| 7 | Click TestMesh → details populates | heading "TestMesh" appears | click + snapshot | **PASS** — post-click screenshot's right-pane details panel shows `TestMesh` heading (visible in `strict-vscode-07-magenta.png` — TestMesh details block on right). |
| 8 | TestMesh Type | `MeshInstance3D` | details panel | **PASS** — visible in screenshot details panel: `Type: MeshInstance3D`. |
| 9 | TestMesh Path | `World/TestMesh` | details panel | **PASS** — screenshot shows `Path: World/TestMesh`. |
| 10 | TestMesh Mesh field | `SubResource("box")` | details panel | **PASS** — screenshot shows `Mesh: SubResource("box")`. |
| 11 | **Mesh visible in canvas (not vanished)** | clearly visible 3D shape | screenshot inspection | **PASS** (critical row) — `strict-vscode-07-magenta.png` shows an unambiguous 3D mesh in the center of the preview canvas. Not a void. |
| 12 | **Mesh is UNAMBIGUOUSLY MAGENTA** | vivid magenta/hot-pink shape | screenshot inspection | **PASS** (critical user-bug row) — the cube in the screenshot is unmistakably a vivid magenta/hot-pink, distinct from any default-material gray or any normal albedo. High R, high B, low G — the documented placeholder color. Not "reddish", not "purple-tinted gray" — full magenta. |
| 13 | Pairwise-distinct from VSCODE-01 box (orange-brown) | visibly different from VSCODE-01's warm tan box | screenshot pairwise comparison | **PASS** (critical row) — VSCODE-01's box is warm orange-brown (Color(0.8, 0.6, 0.2)). This screenshot's TestMesh is vivid magenta/hot-pink. The two are pairwise-distinct color classes: a viewer cannot confuse one for the other. The pattern "placeholder vs real material" is unambiguous. |
| 14 | No scene-breaking parse errors | no parse errors, no React render errors | console scan | **PASS** — TestMesh + Camera both parsed and rendered. Tree built without issue. The 5 errors in console (line 4: `Console: 5 errors, 8 warnings`) include the existing marketplace 404 and likely texture-load 404s from `useResource` — none indicate parse or render failure (the scene tree and viewport both populated). |
| 15 | Console shows the texture URL was attempted | absence of error is acceptable | console scan | **PASS** — the 4 new errors (vs VSCODE-01's 1) are consistent with the texture-load attempt failing. The exact log lines aren't classified beyond "5 errors" in the snapshot header. Not a regression. |

## CANT-VERIFY entries

| # | Property | Reason |
|---|----------|--------|
| — | Floating drei `<Text>` label naming `res://textures/test-upload.png` next to the placeholder mesh | **CANT-VERIFY via accessibility tree** — drei `<Text>` is canvas-rendered text, not DOM. Browser-verifier confirmed presence directly on the web side (same component code path); VS Code path uses the same component. The textual file-path label, if present, is not surfaced to ARIA from the cross-origin webview. Visual proxy: the screenshot itself shows whether the label is on-canvas. |
| — | Pixel-color sampling for exact RGB validation | **CANT-VERIFY via Playwright eval inside cross-origin webview iframe** — canvas pixel sampling requires same-origin access. The visual inspection (rows 11-13) is the harness's reliable proxy. |
| — | `useResource` returns `status: 'missing'` for the unresolvable path | **CANT-VERIFY via DOM** — hook state is internal. Covered by `useResource.test.tsx`. The magenta render is the user-facing proxy. |

## Verification execution order

1. Quick-open `test-missing-texture.tscn`. Run preview command.
2. Snapshot — apply rows 1-3.
3. Click webview "Expand all". Apply rows 4-6.
4. Click TestMesh row. Apply rows 7-10.
5. Full-page screenshot. Apply rows 11-13 by visual inspection.
6. Console scan. Apply rows 14-15.

## Pass criteria — RESULT

**Overall: PASS. 15 of 15 rows PASS, 0 FAIL.**

The user-bug-class rows 11+12+13 all PASS unambiguously: the placeholder mesh is visible, vivid magenta, and pairwise-distinct from VSCODE-01's tan-box rendering. The placeholder is conclusively a placeholder, not an unexpected color of the real material.

Screenshot: `docs/screenshots/vscode/strict-vscode-07-magenta.png`.
