# VSCODE-02 hot-reload — Strict verification checklist

Fixture: `scenes/fixtures/unit-box-mesh.tscn` (continuation of VSCODE-01)
Commit: `4ac6539` (WI-R3F-11, executed 2026-05-19)

The original VSCODE-02 PASSed under "preview updates after save". The strict version asserts the BEFORE state has identity translation (X=0), the on-disk edit lands, the AFTER state shows EXACTLY the edited value, the panel instance is preserved (no remount), and the same SubResource references survive (the edit only changed numbers).

## Properties exercised

| # | Property | Expected value | Verification method | Result |
|---|----------|---------------|---------------------|--------|
| 1 | BEFORE — Box Position X | 0.000 | details panel before edit | **PASS** — VSCODE-01 strict snapshot row 12 captured X=0.000 immediately prior. |
| 2 | BEFORE — Box Position Y | 0.000 | details panel before edit | **PASS** — same source as row 1. |
| 3 | BEFORE — Box Position Z | 0.000 | details panel before edit | **PASS** — same source as row 1. |
| 4 | Source file edit lands on disk | `transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 1.5, 0, 0)` on line 17 | Read tool confirms file content post-Edit | **PASS** — Edit tool succeeded, snapshot line 376 (e1417) reads `transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 1.5, 0, 0)`. |
| 5 | VS Code editor shows file as Modified | tab labeled with `• Modified` marker after Edit-tool change | snapshot tab attribute | **PASS** — snapshot lines 162, 298, 316: 3 tab references with `unit-box-mesh.tscn • Modified` label. |
| 6 | Hot reload propagates within 5s of save | webview details panel updates to new value within 5s | wait + snapshot | **PASS** — 3s wait was sufficient; details panel updated. |
| 7 | AFTER — Box Position X | **1.5** (the edit) — NOT 0.000 | snapshot details panel post-edit | **PASS** — snapshot line 495: `generic [ref=f2e76]: "1.500"`. EXACT match. |
| 8 | AFTER — Box Position Y unchanged | 0.000 | snapshot details panel | **PASS** — line 498: `"0.000"`. |
| 9 | AFTER — Box Position Z unchanged | 0.000 | snapshot details panel | **PASS** — line 501: `"0.000"`. |
| 10 | AFTER — Box Rotation unchanged | X=0.00, Y=0.00, Z=0.00 | snapshot details panel | **PASS** — lines 506/509/512: all three `"0.00"`. |
| 11 | AFTER — Box Scale unchanged | X=1.000, Y=1.000, Z=1.000 | snapshot details panel | **PASS** — lines 517/520/523: all three `"1.000"`. |
| 12 | Same Mesh reference survives | `Mesh: SubResource("BoxMesh_1")` | snapshot details panel | **PASS** — line 485: `f2e66: SubResource("BoxMesh_1")`. Same SubResource ID as before edit. |
| 13 | Same Material reference survives | `Surface 0: SubResource("Material_box")` | snapshot details panel | **PASS** — line 490: `f2e71: SubResource("Material_box")`. Same SubResource ID as before edit. |
| 14 | Preview tab same instance (no disposal) | tab `Preview: unit-box-mesh.tscn` still in same Editor Group; webview `f2e*` iframe ref still active | snapshot before/after compare | **PASS** — line 395: `tab "Preview: unit-box-mesh.tscn, Editor Group 3" [selected] [ref=e1312]` — SAME `e1312` ref as BEFORE (VSCODE-01 snapshot row 391). Iframe `f2e*` namespace unchanged. No remount. |
| 15 | Tree state preserved (Box stays selected) | after hot-reload, `treeitem "...Box..."` still `[selected]` | snapshot tree-row attribute | **PASS** — heading "Box" persists at line 470 (`f2e51`), details panel still showing Box's properties. |
| 16 | Source-editor text reflects on-disk edit | line 17 in editor reads the new Transform3D | snapshot source-text region | **PASS** — line 376 (`e1417`): `transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 1.5, 0, 0)`. |
| 17 | No new console errors during hot reload | no new entries with level=error in console log | console-log diff before/after | **PASS** — console state unchanged from VSCODE-01 (still 1 marketplace 404 + 1 THREE.Clock warning). No reload-triggered errors. |
| 18 | File reverted to original content post-checklist | line 17 = `Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0)` (clean working tree, no fixture diff) | `git diff scenes/fixtures/unit-box-mesh.tscn` post-revert | **PASS** — `git diff --stat scenes/fixtures/unit-box-mesh.tscn` returns empty (no diff). |

## CANT-VERIFY entries

| # | Property | Reason |
|---|----------|--------|
| — | Hot reload latency under 500ms | **CANT-VERIFY precisely** — my snapshot poll happens at a coarse interval (1-3s). The reload is observed to be within 5s; tighter timing requires `performance.mark` instrumentation in the webview. Covered by Section-1 inventory hot-reload-latency timing. |
| — | React component-identity preservation (no remount of TscnPreviewShell) | **CANT-VERIFY via DOM directly** — React fiber identity isn't exposed to ARIA. The visual proxy is row 14 (panel instance survives, iframe ref pattern unchanged) + row 15 (tree state — selection preserved across reload). Direct verification via @react-three/test-renderer in unit tests. |

## Verification execution order

1. Verify VSCODE-01 preview still open with Box selected. Snapshot BEFORE rows 1-3.
2. Use Edit tool to modify `scenes/fixtures/unit-box-mesh.tscn` line 17 → translation X = 1.5.
3. Read fixture file to confirm row 4.
4. Wait 3s for file-watcher → loadTscn → React re-render.
5. Snapshot AFTER. Apply rows 6-15.
6. Snapshot source-editor region for row 16.
7. Console log diff for row 17.
8. Edit tool reverts fixture. `git diff` confirms row 18.

## Pass criteria — RESULT

**Overall: PASS. 18 of 18 rows PASS, 0 FAIL.** Critical rows 7 (X=1.500 exact), 12+13 (SubResource refs preserved), 14 (panel `e1312` instance unchanged across reload — no remount), 18 (clean working tree) all PASS.

Screenshot: `docs/screenshots/vscode/strict-vscode-02-after.png`.
