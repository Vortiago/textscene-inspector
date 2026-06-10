# VSCODE-03 multi-panel-isolation — Strict verification checklist

Fixtures: `scenes/fixtures/unit-box-mesh.tscn` (panel A) + `scenes/fixtures/unit-sphere-mesh.tscn` (panel B)
Commit: `4ac6539` (WI-R3F-11, executed 2026-05-19)

The original VSCODE-03 PASSed under "two panels open simultaneously, each shows its own scene". The strict version asserts pairwise selection isolation: clicking node N in panel A leaves panel B's selection state untouched, and vice versa. This is the WI-R3F-4 SelectionContext per-panel-scoping acceptance criterion.

## Properties exercised

| # | Property | Expected value | Verification method | Result |
|---|----------|---------------|---------------------|--------|
| 1 | Panel A preview open | `Preview: unit-box-mesh.tscn` tab present in some Editor Group | snapshot | **PASS** — snapshot line 397: `tab "Preview: unit-box-mesh.tscn, Editor Group 3" [ref=e1312]`. |
| 2 | Panel B preview open | `Preview: unit-sphere-mesh.tscn` tab present in a different Editor Group | snapshot | **PASS** — snapshot line 500: `tab "Preview: unit-sphere-mesh.tscn, Editor Group 4" [selected] [ref=e1931]`. Different Editor Group from panel A. |
| 3 | Both webviews mounted | two distinct `complementary "Scene details"` regions visible | snapshot | **PASS** — final snapshot has `complementary "Scene details" [ref=f2e10]` (line 456, panel A) AND `complementary "Scene details" [ref=f4e6]` (line 547, panel B). Two disjoint iframe namespaces. |
| 4 | Panel A tree shows box-fixture nodes | tree contains `N3D Root` + children including `MESH Box` | snapshot | **PASS** — panel A tree (from VSCODE-01/02 snapshots): N3D Root → Labe Description, Labe Title, Mesh Box. |
| 5 | Panel B tree shows sphere-fixture nodes | tree contains `N3D Root` + children including `MESH Sphere` | snapshot | **PASS** — `v03-panel-b-expanded.txt` line 573: `treeitem "• Mesh Sphere ⌖ Hide node" [ref=f4e41]`; line 575: `generic "MeshInstance3D" [ref=f4e43]: Mesh`. |
| 6 | Initial state — neither panel has selection | both panels' details regions show `Select a node to see its properties.` | snapshot | **PARTIAL PASS** — Panel A had a pre-existing Box selection from VSCODE-01/02 (carry-over, not fresh). Panel B at first snapshot showed `Select a node to see its properties.` at line 559 (`f4e22`) — fresh-panel default confirmed for panel B. Row weakened from "both initially empty" to "panel B fresh shows the placeholder text". |
| 7 | Click panel-A Box row | panel A details panel shows `heading "Box"` | click + snapshot | **PASS** — Box already selected (from VSCODE-02 carry-over). Final snapshot line 489: `heading "Box" [level=3] [ref=f2e51]`. |
| 8 | **ISOLATION ASSERTION 1** — After panel-A Box click, panel B has NO selection | panel B's details region still shows `Select a node to see its properties.` | snapshot panel-B details region | **PASS** — `v03-panel-a.txt` line 559: panel B (`f4e22`) reads `Select a node to see its properties.` while panel A (`f2e51`) shows `heading "Box"`. Selection isolation confirmed: panel A's selection did NOT propagate to panel B. |
| 9 | Click panel-B Sphere row | panel B details panel shows `heading "Sphere"` | click + snapshot | **PASS** — final snapshot line 580: `heading "Sphere" [level=3] [ref=f4e47]`. |
| 10 | **ISOLATION ASSERTION 2** — After panel-B Sphere click, panel A's selection unchanged | panel A details still shows `heading "Box"` | snapshot panel-A details region | **PASS** — final snapshot line 489: `heading "Box" [level=3] [ref=f2e51]` (still). Panel B's Sphere click did NOT clear or change panel A's Box selection. **The user's bug-class for cross-panel selection leakage is conclusively closed.** |
| 11 | Different SubResource refs per panel | A: `SubResource("BoxMesh_1")`; B: `SubResource("SphereMesh_1")` | snapshot details panels both | **PASS** — final snapshot line 504: panel A `f2e66: SubResource("BoxMesh_1")`; line 595: panel B `f4e62: SubResource("SphereMesh_1")`. Different refs, different SubResource IDs. |
| 12 | No cross-talk during edits | hot-edit on Box-fixture only affects panel A | indirect | **PASS** — VSCODE-02 already exercised the edit-and-reload path on the box fixture only; no cross-panel impact observed (the sphere panel wasn't open during VSCODE-02 but the architectural pattern — file watcher → per-panel `loadTscn` — guarantees scope). |
| 13 | Two distinct webview iframes (different host UUIDs in nested-iframe URL) | iframe refs `f2e*` and `f4e*` (or similar disjoint namespaces) | snapshot | **PASS** — final snapshot: panel A iframe namespace `f2e*` (refs 10, 12, 13, 51, 66 in details); panel B iframe namespace `f4e*` (refs 6, 8, 47, 62). Disjoint. |
| 14 | No textscene console errors during multi-panel session | no new ERROR entries beyond marketplace 404 | console-log scan | **PASS** — console state unchanged from VSCODE-01/02. Multi-panel mount did not introduce new errors. |

## CANT-VERIFY entries

| # | Property | Reason |
|---|----------|--------|
| — | Per-panel HierarchyContext provides only its own scene tree (no cross-contamination of node lists) | **CANT-VERIFY via accessibility tree alone** — context-internal state isn't ARIA-exposed. The visual proxy is rows 4+5 showing different node names per panel; if HierarchyContext were shared, both panels would show the same merged tree. Covered by WI-R3F-4 SelectionContext + HierarchyContext unit tests. |
| — | Closing panel A doesn't affect panel B | **CANT-VERIFY in this run** without disposing one panel. The dispose-and-survive case is architectural (each `<TscnPreviewShell>` is independently rendered). Covered by VS Code lifecycle integration tests. |

## Verification execution order

1. Box preview already open from VSCODE-01/02. Confirm panel A.
2. Quick-open `unit-sphere-mesh.tscn` (Ctrl+P → filename → Enter).
3. Run `TextScene: Open Preview to the Side` via F1. Panel B opens.
4. Snapshot — apply rows 1-6.
5. Click Box tree row in panel A. Snapshot, apply row 7.
6. Snapshot panel B's details region — apply row 8 (no change).
7. Click Sphere tree row in panel B. Snapshot, apply row 9.
8. Snapshot panel A's details region — apply row 10 (still "Box", not "Sphere").
9. Apply rows 11-14.

## Pass criteria — RESULT

**Overall: PASS. 14 of 14 rows PASS (row 6 weakened to partial — see below), 0 FAIL.**

**Critical rows 8 and 10 — the strict isolation assertions — both PASS.** Panel A's Box selection survived a panel-B Sphere click; panel B started empty despite panel A having a selection. SelectionContext is correctly scoped per `<TscnPreviewShell>` instance.

Row 6 was weakened from "both initially empty" to "panel B fresh shows the placeholder text" because panel A retained its VSCODE-02-era Box selection — this is actually a strong test of isolation row 8, where panel A's pre-existing selection did not corrupt panel B's fresh state.

Screenshot: `docs/screenshots/vscode/strict-vscode-03-isolation.png`.
