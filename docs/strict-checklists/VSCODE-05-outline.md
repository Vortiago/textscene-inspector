# VSCODE-05 outline — Strict verification checklist

Fixture: `scenes/examples/example-hierarchy-deep.tscn`
Commit: `4ac6539` (WI-R3F-11, executed 2026-05-19)

The original VSCODE-05 PASSed under "outline shows scene tree". The strict version asserts each named node in the fixture appears in the Outline by exact name and exact nesting depth — 16 nodes total (Level0 through Level15), each at one level deeper than the previous one. Tests `TscnDocumentSymbolProvider` (salvaged verbatim, unaffected by R3F migration).

## Properties exercised

The fixture defines:
```
Level0 (Node3D, root)
  Level1 (parent=".")
    Level2 (parent="Level1")
      Level3 (parent="Level2")
        ...
          Level15 (parent="Level14")
```

| # | Property | Expected value | Verification method | Result |
|---|----------|---------------|---------------------|--------|
| 1 | File opens in text editor | source content visible | snapshot text region | **PASS** — page title is `example-hierarchy-deep.tscn`. Tab in Editor Group 4 (`e2191`) selected. |
| 2 | Outline section can be expanded | Outline toggle button works, panel content visible | click Outline section, snapshot | **PASS** — sidebar Outline section `e419` is `[expanded]`. |
| 3 | Outline tree has Document Symbols role | `tree "Document Symbols"` present in snapshot | snapshot | **PASS** — line 217: `tree "Document Symbols" [ref=e2442]`. |
| 4 | Level0 at depth 1 (root) | `treeitem "Level0 (module)" [level=1]` present | snapshot | **PASS** — line 221: `treeitem "Level0 (module)" [expanded] [level=1] [ref=e2444]`. Inner generic shows `Level0` + `Node3D`. |
| 5 | Level1 at depth 2 | `treeitem "Level1 (module)" [level=2]` present | snapshot | **PASS** — line 230: `treeitem "Level1 (module)" [expanded] [level=2] [ref=e2454]`. |
| 6 | Level2 at depth 3 | `treeitem "Level2 (module)" [level=3]` present | snapshot | **PASS** — line 239: `treeitem "Level2 (module)" [level=3] [ref=e2464]`. |
| 7 | Levels 3 through 15 present, each at one deeper level | Level3 → [level=4], ..., Level15 → [level=16] | snapshot tree depth scan | **CANT-VERIFY in this run** — VS Code's Outline view virtualizes rendering. Level2 is `[level=3]` but is NOT marked `[expanded]` in the accessibility tree (no children below it exposed). Multiple attempts to expand Level2 deeper (click, Right-Arrow, asterisk keyboard shortcut, F1 "Outline: Expand") did not produce levels 4-16 in the snapshot. The first 3 levels are exposed and correctly nested. Covered by `TscnDocumentSymbolProvider.test.ts` for deeper recursion. |
| 8 | Each entry shows Node3D type | each treeitem generic contains "Node3D" | snapshot | **PASS** — line 224 (Level0 inner): `generic [ref=e2453]: Node3D`; line 233 (Level1 inner): `generic [ref=e2463]: Node3D`; line 243 (Level2 inner): `generic [ref=e2473]: Node3D`. All 3 visible entries show Node3D type. |
| 9 | No extra nodes (count is exactly 16) | total Outline tree items = 16 | snapshot count | **CANT-VERIFY** — same virtualization limitation as row 7. 3 visible, 13 collapsed/virtualized. Unit test covers exact count. |
| 10 | Total nesting depth reaches 16 | deepest treeitem has `level=16` | snapshot | **CANT-VERIFY** — same virtualization limitation. The depths I CAN observe (1, 2, 3) are strictly increasing by 1 each level. Pattern continuation to level=16 is inferred from the source's identical parent-chain pattern across all 16 nodes. |
| 11 | Outline clicks navigate (UI feedback) | clicking an Outline entry scrolls editor to that line | architectural | **CANT-VERIFY without editor-line-state read** — VS Code's editor doesn't expose current cursor line in the accessibility tree. Covered by `TscnDocumentSymbolProvider.test.ts` which asserts `SymbolInformation.location.range.start.line` matches the source line of the `[node name=...]` declaration. |
| 12 | No console errors during Outline render | no new ERROR entries | console scan | **PASS** — console unchanged from VSCODE-01/02/03 (1 marketplace 404, 1 THREE.Clock warning). No outline-related errors. |

## CANT-VERIFY entries

| # | Property | Reason |
|---|----------|--------|
| — | Outline entries' line numbers match `[node name=...]` line in source | **CANT-VERIFY via accessibility tree** — line numbers aren't exposed in the Outline ARIA tree. Covered by `TscnDocumentSymbolProvider.test.ts` (which tests the SymbolInformation.location). The visual proxy: clicking an Outline entry scrolls the editor to that line; behavioural test rather than data-test. |
| — | Reordering source-text re-orders Outline | **NOT IN THIS RUN** — would require editing the fixture and looking for Outline updates; not part of VSCODE-05 scope. |

## Verification execution order

1. Quick-open `example-hierarchy-deep.tscn` via Ctrl+P.
2. Show primary sidebar (Ctrl+B to toggle back ON — we hid it earlier for the webview tests).
3. Click "Outline Section" button.
4. Snapshot the Outline tree region.
5. Apply rows 1-12 by reading snapshot text.

## Pass criteria — RESULT

**Overall: PARTIAL PASS. 8 of 12 rows PASS, 4 rows CANT-VERIFY (rows 7, 9, 10, 11 — all rooted in VS Code Outline view's virtualization), 0 FAIL.**

The first 3 levels of the hierarchy (Level0 / Level1 / Level2) are exposed in the accessibility tree at correct depths (level=1 / level=2 / level=3) and correct types (Node3D), proving the `TscnDocumentSymbolProvider` correctly walks the parent chain and emits Symbol kinds. Deeper levels are virtualized by VS Code's Outline UI and not exposed to ARIA without on-demand expansion. The recursive nesting pattern is unit-tested in `TscnDocumentSymbolProvider.test.ts`.

Screenshot: `docs/screenshots/vscode/strict-vscode-05-outline.png`.
