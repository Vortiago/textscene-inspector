# arch-scout curation — post-merge 05bd4d8

Architect: `architect-3`. Date: 2026-05-27.
Inputs: `docs/archive/PARITY-AUDIT-POST-MERGE.md` + `docs/archive/ARCH-IMPROVEMENT-CANDIDATES-POST-MERGE.md`.
Branch tip: `05bd4d8` (merge of `feat/r3f-migration` into `feat/r3f-16-audio-animation`).

---

## Part 1 — Parity findings disposition

### Gate 1 status

Parity-auditor-2 calls Gate 1 MET. Verified: 17 PRESENT + 1 N/A in Layer B;
0 SILENT-DROP-BLOCKERs; 1 SILENT-DROP (materialOverlay — not in hallway); 3 PARTIALs.

**Gate 1: confirmed MET.** No disputed items.

---

### SILENT-DROP: `MeshInstance3D.materialOverlay`

**Disposition: DEFER-POST-GOAL**

Rationale:
- `material_overlay` does not appear in any hallway or fixture file.
  No user-visible rendering defect blocks Gate 1 or Gate 2.
- Implementing overlay blending in R3F requires a second material pass
  (`depthTest: false, blending: AdditiveBlending` or similar). It is a
  self-contained follow-up WI, not a janitor item — schedule alongside
  the next MeshInstance3D material-parity round.
- No dispatch needed in this goal cycle.

---

### PARTIAL: Light `shadow_filter` (DirectionalLight3D / OmniLight3D / SpotLight3D)

**Disposition: DEFER-POST-GOAL**

Rationale:
- `shadow_filter` controls PCF/PCSS softness — a visual refinement, not a
  correctness regression. Shadows render correctly with WebGL defaults.
- The hallway fixture uses `shadow_filter = 2` (PCF-Soft) on its directional
  light. The current render is acceptable; no user has flagged hard-shadow
  artifacts as a blocker.
- Implementing this requires mapping Godot's filter enum to
  `THREE.PCFSoftShadowMap / THREE.VSMShadowMap` on the renderer. Medium
  effort, medium user-visible impact. Queue as a dedicated follow-up WI.
- No dispatch needed in this goal cycle.

---

### PARTIAL: Auto-expand ancestors on tree-click selection (Layer B #16)

**Disposition: DEFER-POST-GOAL**

Rationale:
- Viewport-click selection correctly expands ancestors. The gap is that
  `TreeNode.tsx:115` `setSelectedNodePath` does not call `expandAncestors`.
  This is a one-line fix in the tree click handler, but the verifier did not
  flag it as a Gate-1 blocker and no hallway fixture triggers the failure path
  in normal usage.
- The fix is low-risk and cosmetically desirable; bundle it into the next
  `SceneTreeViewer` polish WI (same WI as the expand-all sub-scene item
  NEW-3 when that triggers).
- No dispatch needed in this goal cycle.

---

### PARTIAL: Empty-state mouse controls hint (Layer B #19)

**Disposition: REJECT (not worth tracking)**

Rationale:
- "Use mouse to orbit camera. Scroll to zoom." is pure informational copy.
- Orbit-controls affordance is industry standard; no user confusion reported.
- The empty-state already shows "No scene loaded..." guidance.
- Closing this item permanently. If the team later adds an onboarding flow,
  re-open it then.

---

## Part 2 — Arch-scout findings disposition

**Gate 2 status per arch-scout-4**: 0 HIGH / 0 MEDIUM / 11 LOW.
**Gate 2: MET.** No disputed items.

Sprint-1 items #1, #2, #3+#5 RESOLVED. Prior #9 (toolbar CSS) MOSTLY RESOLVED.
3 new POST items all LOW.

---

### Janitor bundle — single WI recommended

The following 5 items form a natural one-WI janitor bundle. All are mechanical,
touch no public API surfaces, and have no blocking dependencies on each other.

| Item | Title | Effort | File scope |
|------|-------|--------|------------|
| POST-1 | `resolveInstancePath` — consolidate 2 identical copies into `utils/resourceReference.ts` | trivial | `SubResourceResolver.ts`, `NodeDispatcher.tsx`, `useSubSceneChildren.ts`, `linter/resourceChecker.ts` |
| POST-2 | `v.ts` inline regex factories → extend `vectorValidators.ts` (5 types) | trivial | `v.ts`, `vectorValidators.ts` |
| POST-3 | `r3f-main.tsx` outermost wrapper `style={{...}}` → `r3f-main.module.css .appRoot` | trivial | `r3f-main.tsx`, `r3f-main.module.css` |
| NEW-1 | sRGB two implementations → single `godotColorToLinear` utility | trivial | `materialScalars.ts`, `materials/standardmaterial3d/renderer.ts` |
| LOW-1 | ResourceLoader compat pass-throughs (test-only shims) — drop when test mocks updated | trivial | `ResourceLoader.ts` (test files) |

**Recommendation**: dispatch as one janitor WI post-Gate-2 confirmation. LOW-1
should only land when the test files that use the shim APIs are updated
simultaneously — do not drop the shims without updating the callers.

**Verdict: ACCEPT, DEFER-POST-GOAL** (no dispatch in this cycle; queue as first
post-merge cleanup WI).

---

### Sprint-2 item: LOW-2 `useResources` dynamic hook

**Disposition: ACCEPT, DEFER-POST-GOAL (Sprint-2)**

Rationale:
- This is the highest-leverage remaining functional item: secondary-surface
  material textures cannot be loaded without it (WI-R3F-19 explicitly deferred).
- It is not a janitor item — it requires a new hook, MeshInstance3D rewrite,
  and rules-of-hooks invariant documentation.
- Precondition (WI-ARCH-1 PropertyValidator) is now met.
- Dispatch as the opening WI of the next goal cycle (Sprint-2).

---

### Sprint-3 bundle (janitor + deepening)

| Item | Title | Gate | Disposition |
|------|-------|------|-------------|
| LOW-3 | `propertyFormatter.ts` 11 per-type files | Precondition #1 now met | ACCEPT, Sprint-3 (#6 follow-on) |
| LOW-4 | `transformFromNode3DProperties` useMemo in 12 components | None | ACCEPT, Sprint-3 (#7) |
| #8 | SubResourceResolver rename → `utils/resourceReference.ts` | Merged into POST-1 janitor bundle | Covered by janitor WI |
| #10 | `useParsedScene` hook | None | ACCEPT, Sprint-3 (fold into next shell WI) |

---

### Decide-later (watch-only)

| Item | Trigger |
|------|---------|
| NEW-3 | Expand-all sub-scene walk — re-classify to MEDIUM if a second tree-as-data consumer arrives (e.g. export-tree, tree-search-inside-subscenes) |
| NEW-4 | GLBSceneRoot synthesis registry — re-classify if a second binary-as-scene format lands |
| NEW-5 | GLBSceneRoot BoxHelper on empty wrapper — investigate in next verifier pass; drop if `THREE.BoxHelper.setFromObject()` correctly descends into child geometry |
| #11 | `useViewportSelection expandedRef` — pair with F-1 SelectionContext split if that ever schedules |

---

## Dispatch order for remaining in-goal work

Nothing in Part 1 or Part 2 requires an immediate dispatch inside this goal
cycle. Both gates are met.

Recommended post-gate sequencing:
1. **Janitor WI** (POST-1 + POST-2 + POST-3 + NEW-1; LOW-1 when test mocks ready)
2. **Sprint-2 WI** (`useResources` dynamic hook — secondary-surface textures)
3. **Sprint-3 bundle** (#6 property descriptors → LOW-3 formatter, #7 transform hook, #10 useParsedScene)

---

## Summary table

| Finding | In-scope? | Verdict | Sprint |
|---------|-----------|---------|--------|
| SILENT-DROP: materialOverlay | No (not in hallway) | DEFER-POST-GOAL | Post-MVS |
| PARTIAL: shadow_filter | No (not blocking) | DEFER-POST-GOAL | Post-MVS |
| PARTIAL: auto-expand tree-click | No (not blocking) | DEFER-POST-GOAL | SceneTreeViewer polish WI |
| PARTIAL: empty-state hint | No | REJECT | — |
| POST-1 resolveInstancePath | No (janitor) | ACCEPT | Janitor WI |
| POST-2 v.ts inline regex | No (janitor) | ACCEPT | Janitor WI |
| POST-3 r3f-main inline style | No (janitor) | ACCEPT | Janitor WI |
| NEW-1 sRGB two impls | No (janitor) | ACCEPT | Janitor WI |
| LOW-1 compat shims | No (janitor) | ACCEPT | Janitor WI (with test cleanup) |
| LOW-2 useResources hook | No (feature parity) | ACCEPT | Sprint-2 |
| LOW-3 propertyFormatter | No | ACCEPT | Sprint-3 |
| LOW-4 transform useMemo x12 | No | ACCEPT | Sprint-3 |
| NEW-3 expand-all sub-scene | No | DECIDE-LATER | Watch |
| NEW-4 GLB synthesis registry | No | DECIDE-LATER | Watch |
| NEW-5 GLBSceneRoot BoxHelper | No | INVESTIGATE | Next verifier pass |
| #10 useParsedScene hook | No | ACCEPT | Sprint-3 |
| #11 expandedRef smell | No | DEFER | Gated on F-1 |

**ACCEPT-IN-GOAL: 0** (nothing blocks the gates; no in-goal dispatches needed)
**ACCEPT-POST-GOAL: 10** (janitor + Sprint-2 + Sprint-3 items)
**DEFER: 3** (materialOverlay, shadow_filter, auto-expand ancestors, #11)
**REJECT: 1** (empty-state hint)
**DECIDE-LATER / INVESTIGATE: 3** (NEW-3, NEW-4, NEW-5)
