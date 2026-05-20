# arch-scout curation — 2026-05-20

architect-2-2's curation of the 11 candidates in `docs/ARCH-IMPROVEMENT-CANDIDATES.md` produced by arch-scout. No rejections; all 11 are valid. Sequenced for sprint dispatch.

Source: arch-scout report at `71cca76`. Curation by architect-2-2.

**Pre-merge status**: none of these block PR #48 merge. All are post-merge cleanup ammunition.

---

## Sprint 1 — independent, high-leverage (land in any order)

### #1 — PropertyValidator combinators
- **Effort**: moderate
- **Where**: 31 `linterParser.ts` files (~9,488 LOC total) + `linter/ValidatorRegistry.ts`
- **Win**: 70% LOC reduction via combinator table. Highest mechanical ROI in the codebase.
- **Sequencing**: no blocking dependencies. Assign to whichever implementer owns the linter subsystem.

### #2 — ResourceLoader / SceneLoader / createResourceProcessor unification
- **Effort**: complex
- **Where**: three reimplementations of the cache/inflight/eventBus machine
- **Win**: collapse to one `ResourceLoader` with a `processors` map
- **Sequencing**: scout said "after #1" but the dependency is soft (different subsystems). Concurrent is fine; doing #1 first reduces linter test churn during #2. High test coverage makes this safe despite complexity rating.

### #3 + #5 bundled — R3F component hygiene WI
- **Effort**: simple (combined)
- **#3 useTHREEHelper hook** unifies BoxHelper (selection/hover) + gizmo lifecycles. Strictly better than a BoxHelper-specific version since BoxHelper is just a THREE.Object3D subclass with identical lifecycle to gizmos. Retrofit `<SelectionHighlight>` + `<HoverHighlight>` + the three light gizmos + camera gizmo through one hook.
- **#5 MissingResourcePlaceholder component** — three open-coded magenta-box clusters → one component.
- **Sequencing**: ship as one WI since they touch the same surface area.

---

## Sprint 2 — unblocks future capabilities

### #4 — useResources dynamic hook
- **Effort**: moderate (architect-2-2 raised priority above scout's rating)
- **Win**: unblocks secondary-surface material texture rendering that WI-R3F-19 explicitly deferred
- **Load-bearing contract**: rules-of-hooks invariant — dynamic-length array of requests must be stable-length or wrapped in a manager
- **Sequencing**: assign when multi-surface texture parity is scheduled

### #9 — r3f-main.tsx toolbar CSS extraction
- **Effort**: simple-moderate
- **Win**: closes the toolbar-slot divergence flagged in F-5 of ARCHITECTURE-REVIEW.md — hex literals in the host app bypass the `--tsi-*` token system
- **Sequencing**: AFTER PR #48 merges. Toolbar props are changing in the UX WIs and a concurrent move would conflict.

---

## Sprint 3 — janitor bundle (one hygiene WI)

### #7 — useNode3DTransform hook (simple)
8 components with identical useMemo preamble. Low priority, mostly aesthetics today.

### #8 — SubResourceResolver rename (trivial)
Move `parseResourceReference` to `utils/resourceReference.ts`.
**Caveat**: verify no in-flight WIs import `resources/SubResourceResolver` before landing — import path changes touch all callers simultaneously.

### #10 — useParsedScene hook (trivial)
Extract `parseContent` from `TscnPreviewShell` into an exportable hook. Fold into the next shell WI.

---

## Decide-later — gated on other work

### #6 — Property descriptors unified table
- **Effort**: complex
- **Gate**: hard dependency on #1 landing first.
- **Why**: the enum label arrays formatters hand-code are the same arrays #1's combinators will define. #6 becomes single-source-of-truth as a consequence of #1, not as its own effort.
- **Trigger**: schedule after #1 stabilises.

### #11 — useViewportSelection expandedRef
- **Effort**: simple
- **Gate**: tightly coupled to the SelectionContext cohesion question (F-1 in ARCHITECTURE-REVIEW.md).
- **Why**: changing the shape before that settles would create a merge conflict.
- **Trigger**: pair with the F-1 SelectionContext follow-up sprint.

---

## Cross-cutting sequencing note

**#1 and #6 share the enum label arrays.** The sequencing #1 → #6 is necessary (not just preferred) for #6 to avoid re-deriving the arrays #1's combinators will own.

---

## Disposition summary

| # | Title | Verdict | Sprint |
|---|---|---|---|
| 1 | PropertyValidator combinators | ACCEPT | 1 |
| 2 | ResourceLoader unification | ACCEPT | 1 |
| 3 | useTHREEHelper hook (bundled with #5) | ACCEPT | 1 |
| 4 | useResources dynamic hook | ACCEPT | 2 |
| 5 | MissingResourcePlaceholder (bundled with #3) | ACCEPT | 1 |
| 6 | Property descriptors unified table | DEFER | gated on #1 |
| 7 | useNode3DTransform hook | ACCEPT | 3 |
| 8 | SubResourceResolver rename | ACCEPT | 3 |
| 9 | r3f-main.tsx toolbar CSS extraction | ACCEPT | 2 (post-merge) |
| 10 | useParsedScene hook | ACCEPT | 3 |
| 11 | useViewportSelection expandedRef | DEFER | gated on F-1 |

ACCEPT: 9 • DEFER: 2 • REJECT: 0

**Top WI candidates by leverage**: #1 alone delivers more LOC leverage than the other 10 combined. #2 + #3+#5 are the obvious follow-ups.
