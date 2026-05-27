# WEB — AnimationPlayer + AnimationTree strict verification checklist

Fixture: `scenes/fixtures/unit-animation-player.tscn`

## Pre-conditions

1. Open the web previewer (`pnpm dev` in `apps/textscene-web`)
2. Select **"Animation Player"** from the fixture dropdown
3. Confirm the scene loads without console errors

---

## Checklist rows

| # | Property / behaviour | Expected value | Verification method | Result |
|---|---|---|---|---|
| 1 | Scene tree shows `AnimationPlayer` node | Node named "AnimationPlayer" appears in the tree | Click tree — look for AnimationPlayer child under Character | PASS / FAIL |
| 2 | `AnimationPlayer` node selectable in tree | Clicking it highlights it and updates the details panel | Click the AnimationPlayer row | PASS / FAIL |
| 3 | Details panel — section "Playback" present | Section heading "Playback" visible | Inspect details panel | PASS / FAIL |
| 4 | Details panel — Speed Scale row | Value = `1.000` | Read "Speed Scale" row | PASS / FAIL |
| 5 | Details panel — Active row | Value = `true` | Read "Active" row | PASS / FAIL |
| 6 | Details panel — Autoplay row | Value = `idle` | Read "Autoplay" row | PASS / FAIL |
| 7 | Details panel — section "Clips (3)" present | Section heading contains "Clips (3)" | Inspect section header | PASS / FAIL |
| 8 | Clip list shows "idle" | Row `[0]` value = `idle` | Read first item in Clips section | PASS / FAIL |
| 9 | Clip list shows "walk" | Row `[1]` value = `walk` | Read second item in Clips section | PASS / FAIL |
| 10 | Clip list shows "run" | Row `[2]` value = `run` | Read third item in Clips section | PASS / FAIL |
| 11 | Clip list items are pairwise distinct | idle ≠ walk ≠ run | Verify all three values differ | PASS / FAIL |
| 12 | No gizmo / no mesh rendered for AnimationPlayer | 3D viewport unchanged vs a scene without it | Compare viewport — no extra geometry | PASS / FAIL |
| 13 | AnimationPlayer does not appear as GenericNodeFallback | Node label in tree is NOT "(?) AnimationPlayer" | Inspect tree row — should show the node name without a warning prefix | PASS / FAIL |

---

## AnimationTree checklist (if an AnimationTree fixture is added)

| # | Property / behaviour | Expected value | Verification method | Result |
|---|---|---|---|---|
| 14 | AnimationTree node selectable | Details panel opens on click | Click tree row | PASS / FAIL |
| 15 | Details panel — section "AnimationTree" present | Section heading "AnimationTree" visible | Inspect panel | PASS / FAIL |
| 16 | Active row | Value = `false` (default) | Read "Active" row | PASS / FAIL |
| 17 | Tree Root row shows "(none)" when not set | Value = `(none)` | Read "Tree Root" row | PASS / FAIL |
| 18 | AnimationPlayer row shows extracted NodePath | Value is the path string, not `NodePath("...")` wrapper | Read "AnimationPlayer" row | PASS / FAIL |
| 19 | No gizmo / no mesh rendered for AnimationTree | 3D viewport unchanged | Compare viewport | PASS / FAIL |
| 20 | AnimationTree does not appear as GenericNodeFallback | Tree row has no warning prefix | Inspect tree | PASS / FAIL |
