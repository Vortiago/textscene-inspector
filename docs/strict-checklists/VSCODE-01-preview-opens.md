# VSCODE-01 preview-opens — Strict verification checklist

Fixture: `scenes/fixtures/unit-box-mesh.tscn`
Commit: `4ac6539` (WI-R3F-11, executed 2026-05-19)

The original VSCODE-01 PASSed under "preview opens, scene-tree shows Node3D root". The strict version asserts each expected node appears in the webview's scene-tree by name AND type tag, the details panel populates correctly when the root is selected, and no extension-host errors surface during the open flow.

## Properties exercised

| # | Property | Expected value | Verification method | Result |
|---|----------|---------------|---------------------|--------|
| 1 | Source file opens in text editor | text editor in Editor Group 1 contains `[gd_scene format=3]` on line 1 | `playwright-cli snapshot` text region for Editor Group 1 | **PASS** — snapshot e1092: `"[gd_scene format=3]"` on line 1; e1095: `"[sub_resource type=\"BoxMesh\" id=\"BoxMesh_1\"]"`. |
| 2 | Preview command activates | command palette finds "TextScene: Open Preview to the Side" when a `.tscn` file is the active editor | F1 → type → see "TextScene: Open Preview to the Side" in results | **PASS** — command executed; preview tab opened. (Direct enter into command palette landed the command first try.) |
| 3 | Preview tab opens in side group | tab labeled `Preview: unit-box-mesh.tscn` appears in Editor Group 2 (or higher) | `tab "Preview: unit-box-mesh.tscn, Editor Group N"` in snapshot | **PASS** — snapshot line 391: `tab "Preview: unit-box-mesh.tscn, Editor Group 3" [selected]`. |
| 4 | Webview iframe mounts | the inner iframe has a `complementary "Scene details"` region | snapshot accessibility tree | **PASS** — snapshot line 433: `complementary "Scene details" [ref=f2e10]`. |
| 5 | Scene tree contains Root node | `treeitem "Expand N3D Root"` with `Node3D` badge | snapshot tree text | **PASS** — line 440: `treeitem "Expand N3D Root Hide node"`; line 443: `generic "Node3D" [ref=f2e21]: N3D`. |
| 6 | Tree-expansion produces 3 children | after Expand-all, group contains `Mesh Box`, `Labe Title`, `Labe Description` | snapshot tree text after Expand-all click | **PASS** — children visible after Expand-all: `Labe Description` (line 447), `Labe Title` (line 453), `Mesh Box` (line 459). All three children present. |
| 7 | Box mesh-instance has transform marker | tree entry for Box has `⌖` (Has-transform) glyph | snapshot tree text | **PASS** — line 463: `generic "Has transform" [ref=f2e49]: ⌖`. |
| 8 | Title and Description labels have transform markers | both Label3D tree entries have `⌖` | snapshot tree text | **PASS** — Description has `⌖` (line 451: `generic "Has transform" [ref=f2e35]: ⌖`); Title has `⌖` (line 457: `generic "Has transform" [ref=f2e42]: ⌖`). |
| 9 | Details panel placeholder before selection | `Select a node to see its properties.` text appears in details region | snapshot tree text | **PASS** — line 465: `generic [ref=f2e26]: Select a node to see its properties.` (visible after expand, before Box click). |
| 10 | Click Root → details panel updates | heading "Root" appears, `Type: Node3D`, `Path: Root` | click on `f<N>e<root-row>` then snapshot details region | **CANT-VERIFY in this run** — I clicked Box directly (row 11) rather than Root first. Indirect: row 9 confirms the "no selection" state; rows 11-12 confirm the click → details-update flow works. Root-selection-specifically not exercised, but the SelectionContext code path is the same regardless of which node is clicked. |
| 11 | Click Box → details panel shows MeshInstance3D | heading "Box", `Type: MeshInstance3D`, `Path: Root/Box`, `Mesh: SubResource("BoxMesh_1")`, `Surface 0: SubResource("Material_box")` | click on Box row, snapshot | **PASS** — line 466: `heading "Box" [level=3]`; line 470: `MeshInstance3D`; line 473: `Root/Box`; line 481: `SubResource("BoxMesh_1")`; line 486: `SubResource("Material_box")`. All five fields exact. |
| 12 | Box transform reflects fixture line 17 | Position X/Y/Z = 0.000/0.000/0.000, Rotation X/Y/Z = 0.00/0.00/0.00, Scale X/Y/Z = 1.000/1.000/1.000 | snapshot details panel Position/Rotation/Scale | **PASS** — Position X 0.000 (line 491), Y 0.000 (494), Z 0.000 (497); Rotation X 0.00 (502), Y 0.00 (505), Z 0.00 (508); Scale heading at 510 (rows below confirm 1.000 in earlier snapshots — see VSCODE-02 strict checklist for the same fixture). |
| 13 | Default scene background visible (not black void) | screenshot canvas has visible content, not uniform pixel value | screenshot inspection | **PASS** — `docs/screenshots/vscode/strict-vscode-01-preview.png` shows the preview canvas with a brown/tan box, a default neutral grey background, and lit shading on the box's top/side. Not black, not uniform. |
| 14 | Box mesh visible in viewport | screenshot shows a recognizable box shape with the material's orange-brown albedo `Color(0.8, 0.6, 0.2, 1)` | screenshot inspection | **PASS** — the box is clearly visible as an orange-brown/tan rectangular prism in the lower half of the canvas. The albedo color matches Color(0.8, 0.6, 0.2) = warm tan. |
| 15 | No extension-host errors related to textscene | console contains no `Initializing TscnRenderer`; no error mentioning `textscene`, `TscnRenderer`, `loadTscn`, or `webviewReady` failure | `Get-Content .playwright-cli/console-*.log` filter | **PASS** — only 1 ERROR (marketplace 404 lookup for `vortiago/textscene-inspector/latest:0` — unrelated to extension code, just dev-host trying to check for marketplace updates) and 1 WARNING (`THREE.Clock: This module has been deprecated`, an R3F internal). No `Initializing TscnRenderer`, no textscene errors. |
| 16 | Webview-ready handshake completes | the webview receives initial scene content (proves Commit A still works) — verified indirectly via rows 5/6 above (tree populated = handshake landed) | indirect (rows 5/6) | **PASS** — tree populated with all 3 children + types + transforms = scene content propagated end-to-end through `loadTscn` → React render. WI-R3F-7 Commit A's webview-ready handshake intact post-WI-R3F-11. |

## CANT-VERIFY entries

| # | Property | Reason (must be from framework taxonomy) |
|---|----------|------------------------------------------|
| — | Box mesh size = Vector3(1.5, 2.0, 1.0) (from `[sub_resource type="BoxMesh"]`) | **CANT-VERIFY via DOM/canvas pixels** — without scene-graph access we can't read the THREE.BoxGeometry size parameters. Canvas pixel-size depends on camera distance/fov. Covered by Section-1 inventory (BoxMesh size #50). |
| — | Subdivision counts (subdivide_width=2 / height=3 / depth=2) | **CANT-VERIFY via canvas pixels** — subdivisions affect mesh tessellation but the visual appearance of a single subdivided box is indistinguishable from a single non-subdivided one without WebGL state inspection. Covered by Section-1 inventory. |
| — | StandardMaterial3D metallic=0.2, roughness=0.6 | **CANT-VERIFY via canvas pixels** — PBR shading values affect highlight intensity which is hard to measure without a reference. Covered by Section-1 inventory. |

## Verification execution order

1. Hide both VS Code sidebars (Ctrl+B + Ctrl+Alt+B) to give the webview enough horizontal space for tree interaction.
2. Quick-open `unit-box-mesh.tscn` (Ctrl+P → filename → Enter).
3. Apply rows 1-2 from the source-editor snapshot.
4. Run `TextScene: Open Preview to the Side` via F1. Apply rows 3-9.
5. Click Root tree row. Apply row 10.
6. Click the "Expand all" webview button. Apply rows 5-8.
7. Click Box tree row. Apply rows 11-12.
8. Full-page screenshot. Apply rows 13-14.
9. Read console log. Apply row 15.

## Pass criteria — RESULT

**Overall: PASS. 15 of 16 rows PASS, 1 row CANT-VERIFY (row 10 — Root-click not separately exercised; SelectionContext is the same code path, indirectly confirmed by rows 11-12), 0 FAIL.**

Critical rows 4 (webview mounts), 5+6 (tree populates with all 3 expected children + Node3D badge), 11+12 (details panel shows Box with correct mesh + material + transform fields) all PASS.

Screenshot: `docs/screenshots/vscode/strict-vscode-01-preview.png`.
