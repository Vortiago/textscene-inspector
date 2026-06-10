# Architecture improvement candidates — scout report

Scan tip: 6a5cc44 — date 2026-05-28

Scout: `arch-scout-4` (read-only). Main checkout.

Baseline: prior scan at `05bd4d8` (2026-05-27, 0 HIGH / 0 MED / 11 LOW).
See `docs/archive/ARCH-IMPROVEMENT-CANDIDATES-POST-MERGE.md`.

New surface since baseline:
- `bec1d15` — WI-R3F-18: lazy-load DOM panels + ESM esbuild split
- `6bc77d0` — WI-R3F-16/C: AnimationPlayer + AnimationTree full vertical slices

---

## HIGH: 0

No new HIGH items introduced.

---

## MEDIUM: 0

No new MEDIUM items introduced.

---

## NEW LOW candidates from this surface

---

### FINAL-1 (LOW): Parser utility helpers (`floatOr` / `boolOr` / `enumOr` / `intOr`) independently re-defined in 4 node parsers

**Where**:
- `packages/textscene-core/src/nodes/audio/audiostreamplayer3d/parser.ts:67-93` — defines `floatOr`, `intOr`, `boolOr`, `enumOr`
- `packages/textscene-core/src/nodes/animation/animationplayer/parser.ts:65-87` — defines `floatOr`, `boolOr`, `enumOr`, `stripQuotes`
- `packages/textscene-core/src/nodes/animation/animationtree/parser.ts:64-83` — defines `intOr`, `boolOr`, `enumOr`
- `packages/textscene-core/src/nodes/3d/sprite3d/parser.ts:82-94` — defines `floatOr`, `intOr`

**Smell**: WI-R3F-16/A (audio) introduced the first copy; WI-R3F-16/C (animation) added two more. The audio template was followed faithfully — including its local helper definitions. Total 13 function definitions across 4 files for the same 4–5 trivial parse helpers:

```typescript
function floatOr(raw: string | undefined, fallback: number): number {
  if (raw === undefined) return fallback;
  const n = parseFloat(raw);
  return Number.isNaN(n) ? fallback : n;
}
```

Every definition is byte-for-byte identical (varying only in parameter name `value` vs `raw`, which is immaterial).

**Deletion test**: delete `animationtree/parser.ts:64-83`. The parser breaks. The fix is a single import of `floatOr`, `boolOr`, `enumOr`, `intOr` from a shared `nodes/parserUtils.ts`. A fifth node parser that follows this pattern would be a third copy on top of these four — confirming Rule of Three is already exceeded.

**Deepening opportunity**: `packages/textscene-core/src/nodes/parserUtils.ts` exporting `floatOr`, `intOr`, `boolOr`, `enumOr`, `stripQuotes`. Each is 4–8 lines; the shared file is ~30 LOC. All 4 call sites become 1-line imports. Future node parsers (Skeleton3D non-linter path, PathFollow3D, etc.) would use the shared file immediately.

**Proposed shape**:
```typescript
// nodes/parserUtils.ts
export function floatOr(raw: string | undefined, fallback: number): number { … }
export function intOr(raw: string | undefined, fallback: number): number { … }
export function boolOr(raw: string | undefined, fallback: boolean): boolean { … }
export function enumOr<T extends number>(raw: string | undefined, fallback: T, allowed: readonly T[]): T { … }
export function stripQuotes(raw: string): string { … }
```

**Effort**: trivial. ~30 LOC in new file, 4 import statements replacing 13 function definitions.

**Blast radius**: `audio/audiostreamplayer3d/parser.ts`, `animation/animationplayer/parser.ts`, `animation/animationtree/parser.ts`, `3d/sprite3d/parser.ts`. No test changes needed (helpers have no observable type change; parsers produce identical output).

**Why LOW, not MEDIUM**: each copy is correct and independent — no behavioral risk. The risk is a fourth parser (already plausible given Skeleton3D, PathFollow3D, Label3D all share similar enum-parsing needs) deriving a fifth copy and the pattern becoming load-bearing at 5 files before anyone notices.

**Janitor target**: fold into the existing janitor bundle (POST-1 + POST-2 + NEW-1 group).

---

### FINAL-2 (LOW): `lazy()` named-export adapter shape has 2 call sites — watch for third

**Where**:
- `packages/textscene-core/src/r3f/components/TscnPreviewShell/TscnPreviewShell.tsx:31-40`

```typescript
const SceneTreeViewer = lazy(() =>
  import('../SceneTreeViewer/SceneTreeViewer.js').then((m) => ({
    default: m.SceneTreeViewer,
  }))
);
const NodeDetailsPanel = lazy(() =>
  import('../NodeDetailsPanel/NodeDetailsPanel.js').then((m) => ({
    default: m.NodeDetailsPanel,
  }))
);
```

**Smell**: `React.lazy` requires the imported module to expose a `default` export. `SceneTreeViewer` and `NodeDetailsPanel` are named exports only; the `.then((m) => ({ default: m.Foo }))` adapter bridges the gap. Both adapters are currently in one file, so the duplication is co-located and visible.

Team-lead's readiness message correctly anticipated this: **"the `default: m.Foo` re-export pattern is a candidate for a tiny shared util if a third lazy import appears."**

**Current state**: 2 call sites, same file. The duplicated shape is 3-line boilerplate per component. At 2, it's below the Rule-of-Three threshold; the discipline cost of extracting a `lazyNamed` helper outweighs the benefit.

**Trigger**: if a third `lazy(() => import('…').then(m => ({ default: m.Foo })))` appears anywhere in the codebase, extract:

```typescript
function lazyNamed<T>(factory: () => Promise<{ [K: string]: T }>, name: string) {
  return lazy(() => factory().then((m) => ({ default: m[name] as T })));
}
// call site:
const SceneTreeViewer = lazyNamed(() => import('../SceneTreeViewer/SceneTreeViewer.js'), 'SceneTreeViewer');
```

**Why LOW**: 2 sites, co-located, non-behavioural. Watch only.

**Effort if triggered**: trivial (1 helper function, 2 updated call sites).

**Blast radius**: `TscnPreviewShell.tsx` only (today).

---

## Prior LOWs — re-check status

| # | Title | Status | Notes |
|---|-------|--------|-------|
| POST-1 | `resolveInstancePath` — 3 copies | **UNCHANGED** | Still 3 copies (NodeDispatcher, useSubSceneChildren, ResourceLoader). |
| POST-2 | `v.ts` inline regex for 5 Godot types | **UNCHANGED** | Still present. |
| POST-3 | `r3f-main.tsx` structural inline style | **UNCHANGED** | One `style={{…}}` wrapper div remains. |
| LOW-1 | ResourceLoader compat pass-throughs | **UNCHANGED** | No production callers found. |
| LOW-2 | MeshInstance3D 6-fold `useResource` | **UNCHANGED** | Sprint-2 `useResources` hook dependency. |
| LOW-3 | `propertyFormatter.ts` 11 per-type files | **COUNT GREW TO 13** | AnimationPlayer + AnimationTree added 2 new `propertyFormatter.ts` files. Both use the same shape as prior 11. Precondition (#1 PropertyValidator) still met; Sprint-3 scheduling unaffected. |
| LOW-4 | `transformFromNode3DProperties` useMemo | **COUNT GREW TO 14** | AnimationPlayer and AnimationTree Components each add `useMemo(() => transformFromNode3DProperties(properties), [properties])`. Now 14 files. Still LOW. |
| NEW-1 | sRGB two implementations | **UNCHANGED** | `materialScalars.ts` hand-rolled vs `renderer.ts` THREE.Color. |
| NEW-3 | Expand-all misses sub-scene children | **UNCHANGED** | Decide-later. |
| NEW-4 | GLBSceneRoot synthesis — watch | **UNCHANGED** | Watch only. |
| NEW-5 | GLBSceneRoot BoxHelper | **UNCHANGED** | Still needs field verification. |
| FINAL-1 (new) | Parser utility helpers re-defined in 4 files | **NEW — see above** | |
| FINAL-2 (new) | `lazy()` named-export adapter — watch at 2 | **NEW — see above** | |

---

## Summary

| Severity | Count | Delta vs 05bd4d8 |
|----------|-------|-----------------|
| HIGH | **0** | 0 |
| MEDIUM | **0** | 0 |
| LOW (active) | **13** | +2 (FINAL-1, FINAL-2) |
| RESOLVED since 05bd4d8 | 0 | — |

---

## Gate 2 assessment

**Condition met: 0 HIGH / 0 MED.**

All 13 active LOWs are low blast-radius, non-behavioural, and either already assigned to sprint bundles (LOW-3 → #6, LOW-4 → #7, LOW-2 → Sprint-2 #4) or candidates for the janitor WI (POST-1, POST-2, POST-3, NEW-1, FINAL-1).

**FINAL-1 is the most actionable new item**: 4 files × 4 functions = 13 identical private functions, triggered by WI-R3F-16/C faithfully following the audio template (including its duplication). Simple janitor fix. Recommend folding into the existing janitor bundle (now: POST-1 + POST-2 + POST-3 + NEW-1 + FINAL-1 = one simple WI).

**FINAL-2 is watch-only**: 2 call sites co-located in one file; trigger is a third lazy import elsewhere. No action needed now.

**Curation note for architect-3**: LOW-3 and LOW-4 counters now stand at 13 and 14 files respectively (grew by 2 each from the animation WI). Neither crosses a severity threshold; they remain LOW and reinforce that the janitor window for #7 (`useNode3DTransform` hook) and #6 (property descriptor unification) is growing.
