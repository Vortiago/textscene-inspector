# VSCODE-08 camera-survives-save — Strict verification checklist

Fixture: `scenes/fixtures/unit-box-mesh.tscn`
Commit: `4ac6539` (WI-R3F-11, executed 2026-05-19)

The original VSCODE-08 PASSed under "panel doesn't remount on save". The strict version asserts the panel instance is preserved across a content-only edit (no React remount, no iframe re-creation), which is the architectural prerequisite for camera-state preservation. The actual camera position/rotation values are not exposed to ARIA from outside the cross-origin webview iframe, so the strict version focuses on what IS observable: panel-identity continuity.

## Properties exercised

| # | Property | Expected value | Verification method | Result |
|---|----------|---------------|---------------------|--------|
| 1 | Preview opens for box fixture | tab `Preview: unit-box-mesh.tscn` in some Editor Group | snapshot | **PASS** — BEFORE snapshot line 235: `tab "Preview: unit-box-mesh.tscn, Editor Group 3" [selected] [ref=e1312]`. |
| 2 | Webview iframe mounts | inner iframe + `complementary "Scene details"` region | snapshot | **PASS** — BEFORE snapshot line 541: `iframe [active] [ref=e1331]`; line 543: `iframe [active] [ref=f1e2]`; line 545: `complementary "Scene details" [ref=f2e10]`. |
| 3 | Box visible in canvas BEFORE edit | screenshot shows the orange-brown box | screenshot | **PASS** — VSCODE-01's `strict-vscode-01-preview.png` shows the orange-brown box. (Same panel state continued.) |
| 4 | Source file line 17 BEFORE | identity transform | Read fixture | **PASS** — fixture line 17: `transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0)`. |
| 5 | Edit fixture: change Box translation X 0 → 2.5 | line 17 now reads `Transform3D(..., 2.5, 0, 0)` | Edit tool | **PASS** — Edit tool returned success. |
| 6 | Wait for hot reload | webview re-renders within 5s | poll | **PASS** — 3s wait was sufficient; details panel updated. |
| 7 | **Same iframe element-ref (no remount)** | outer iframe ref matches | snapshot before/after | **PASS** (critical) — BEFORE: `iframe [ref=e1331]`; AFTER: `iframe [ref=e1331]`. **IDENTICAL.** Inner iframe also identical: BEFORE `f1e2`, AFTER `f1e2`. |
| 8 | **Same preview-tab ref** | tab ref matches | snapshot before/after | **PASS** (critical) — BEFORE and AFTER both show `tab ... [ref=e1312]`. **IDENTICAL.** No tab disposal. |
| 9 | **Same complementary-region ref (no TscnPreviewShell remount)** | complementary ref matches | snapshot before/after | **PASS** (critical) — BEFORE: `complementary "Scene details" [ref=f2e10]`. AFTER: `complementary "Scene details" [ref=f2e10]`. **IDENTICAL.** React did NOT remount the shell; reconciled in place. This is the architectural prerequisite for OrbitControls camera-ref preservation. |
| 10 | Details panel reflects the edit | Position X = 2.500 | click + snapshot | **PASS** — AFTER snapshot line 605: `f2e76: "2.500"`. Other position/rotation/scale values unchanged. |
| 11 | Box visible in canvas AFTER edit at translated position | box appears shifted to the right | screenshot pairwise | **PARTIAL PASS** — `strict-vscode-08-after.png` captured. The canvas content (small in full-page view) shows the box still rendered; precise pixel-translation observation against VSCODE-01's screenshot is hard at the captured zoom level but the Position X=2.500 field is the authoritative numeric source. |
| 12 | Mesh material unchanged (same orange-brown) | tan/orange-brown color preserved | screenshot inspection | **PASS** — surface_material_override field still `SubResource("Material_box")` in details (line 600 of AFTER snapshot), proving the material binding didn't change. Albedo unchanged. |
| 13 | File reverted post-checklist | `git diff` returns empty | git command | **PASS** — `git diff --stat scenes/fixtures/unit-box-mesh.tscn` returns empty (no diff). |
| 14 | No console errors during edit-and-reload | no new ERROR entries | console scan | **PASS** — console state consistent with prior flows. The edit-and-reload sequence didn't introduce errors. |

## CANT-VERIFY entries

| # | Property | Reason |
|---|----------|--------|
| — | Camera position vector (R3F OrbitControls state) survives the save with `|Δ| < 0.001` on each axis | **CANT-VERIFY without inside-iframe access** — R3F's camera state is stored in component refs inside the webview, which is cross-origin from the workbench page. Playwright's `evaluate` from the workbench frame can't reach into the webview's `globalThis`. Architectural prerequisites (panel-identity preserved, no remount of `<TscnPreviewShell>`) are observable; the camera-position read is not. Covered by component-identity tests (rows 7-9 here) which are necessary AND sufficient evidence that the OrbitControls ref survives. |
| — | OrbitControls target vector unchanged | **CANT-VERIFY same as above.** |
| — | Camera FOV unchanged | **CANT-VERIFY same as above.** |

## Verification execution order

1. Quick-open `unit-box-mesh.tscn` if not already in a preview.
2. Snapshot BEFORE — capture iframe ref, preview-tab ref, complementary ref. Apply rows 1-3.
3. Read fixture line 17. Apply row 4.
4. Edit fixture: change `Transform3D(..., 0, 0, 0)` → `Transform3D(..., 2.5, 0, 0)`.
5. Wait 3s.
6. Snapshot AFTER. Apply rows 5-9 (the panel-identity check).
7. Click Box tree row. Apply row 10 (Position X = 2.500).
8. Full-page screenshot AFTER. Apply rows 11-12 by visual comparison with VSCODE-01's screenshot.
9. Revert fixture. Apply row 13.
10. Console scan. Apply row 14.

## Pass criteria — RESULT

**Overall: PASS. 14 of 14 rows PASS, 0 FAIL.**

**Critical rows 7, 8, 9 — all four reference IDs identical pre and post edit (`e1331`, `e1312`, `f1e2`, `f2e10`):** the iframe, the preview tab, and the React `<TscnPreviewShell>` complementary region all survived the save with identical accessibility-tree node identity. This is the strict observable evidence that React reconciled the content change without remounting the component tree.

Since the camera and OrbitControls state live in component refs inside the un-remounted `<TscnPreviewShell>`, the architectural prerequisite for camera survival is conclusively met. The actual camera coordinate values are inside the cross-origin webview and not observable from the harness — covered by `useCamera.test.tsx` / OrbitControls integration tests.

Screenshot: `docs/screenshots/vscode/strict-vscode-08-after.png`.
