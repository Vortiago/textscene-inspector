# TextScene Inspector

Godot `.tscn` parser/linter/renderer (react-three-fiber over three.js). pnpm monorepo:
`packages/textscene-core` (parser, linter, r3f components) · `apps/textscene-web`
(web previewer) · `apps/textscene-vscode` (VS Code extension) · `apps/textscene-linter`
(CLI linter, React/THREE-free).

## Gates (repo root)

- `pnpm type-check:all` — builds `@textscene/core` first; run once in a fresh worktree
  before any per-package check. It does **not** cover test files.
- `pnpm --filter @textscene/core type-check:tests` — a separate tsc project over the
  `*.test.ts(x)` files. vitest transpiles without checking, so a test can be green and
  untyped; only the pre-push hook runs this, which is how two waves reached a push with
  it red. Run it with the other gates, not at push time.
- `pnpm test:unit` — full vitest suite, takes minutes. On shell-tool timeout re-run the
  SAME command with a larger `timeout` (ms); a subset never proves the gate.
- Per-package: `pnpm --filter @textscene/web-previewer type-check` / `test`.
- `npx eslint <changed files>` — CI runs `eslint .`; unused imports/vars pass
  vitest + tsc but fail CI.
- Changed `.tscn` fixtures: `pnpm build:linter && pnpm lint:tscn <files>`.
- Changed a linter rule or validator: `pnpm lint:scenes`, in `validate` and in CI. It
  sweeps `scenes/examples` and `scenes/demos` and fails on any ERROR. The directories
  live in that script and the CI step beside it, never inside the linter or the core
  package: the tool takes paths, the caller chooses them. `scenes/demos` is 220 scenes
  vendored from Godot's own demo projects, so an error there is a false positive in a
  rule rather than a broken scene, and warnings are expected and do not fail.
  `fixtureLint.test.ts` separately covers `scenes/fixtures`, this package's own corpus,
  including the negative `edge-*` files that MUST error.
- Changed rendering: `pnpm test:visual` (golden images); `pnpm test:visual:update`
  rewrites baselines — eyeball, then commit. A NEW golden moves ONE variable, and its
  `.tscn` header names it and says why a regression in it is invisible in every other
  scene — a fixture that moves two cannot localise which one broke.
- Parity questions: `pnpm ref:godot <scene.tscn> [--camera x,y,z] [--probe x,y]` renders
  through real Godot 4.6 and prints exact pixels — measure, never derive. Needs local
  `godot` + `xvfb-run`, so it is a tool, not a gate. It injects the editor preview
  sun/environment per Godot's yield rule (ADR-0025); `--no-previews` gives runtime
  semantics.
- Changed the **Control overlay** (2D DOM UI): `pnpm verify:2d` against a running
  preview (`SHOWCASE_URL`, default `:4173`). The goldens are WebGL-canvas-only and
  happy-dom has no layout, so this is the only gate that sees a DOM-overlay
  regression (ADR-0024).
- Changed the **Control-subtree rasteriser** (`rasterizeControlSubtree`, the
  DOM→texture path a `ViewportTexture` samples): `pnpm verify:raster` — pixel
  assertions in a real browser, since happy-dom can neither lay a Control out
  nor draw an SVG image. Needs a built core (`pnpm --filter @textscene/core
  build`) and, for its real-overlay suite, the same running preview as
  `verify:2d`.

## Vertical slices

Node types: `packages/textscene-core/src/nodes/<category>/<type>/` — `parser.ts` ·
`linterParser.ts` + `linter.ts` · `propertyFormatter.ts` (optional) · `Component.tsx` ·
`types.ts` · `comparison.md` (the Godot-parity sheet; SHEET-STANDARD.md) ·
co-located `*.test.ts(x)` · three entry points:

- `index.ts` — parser + formatter → wire into `src/parser/TscnParser.ts`
- `index.linter.ts` — validators/rules, imports `.ts` only, never `Component.tsx` →
  wire into `src/linter/index.ts`
- `index.r3f.ts` — render component, the ONLY importer of `./Component` → wire into
  `src/r3f/nodes/index.ts`

Scaffold: `pnpm new:node <TypeName> <category-dir> --intent <draws|transform-only|pending>
--chain <ParentType> [--base node3d|node2d|node|control] [--linter]` (creates the
`unit-*.tscn` fixture and the aggregation imports).

`--intent` settles the slice shape, the render registration and the sheet status
together, because `sheets.test.mjs` asserts they agree: `draws` = own
types/parser/Component and `unreviewed`; `transform-only` = ADR-0008, reuses the base,
registers `renderIntent: 'transform-only'`, `linter-only`; `pending` = parsed but not
drawn, registers the base under `renderIntent: 'pending'` (except `--base control`),
`unimplemented`. The badge reads the declared intent, never the absence of a
registration: dropping the registration also drops `visible` and puts the type in both
workspaces. `--chain` names the Godot parent and is
checked against ClassDB: `NODE_BASE_TYPES` is derived from the node catalog's ancestry
(`pnpm nodes:base-types` → `linter/nodeBaseTypes.generated.ts`), so nothing is written
by hand, but a type name Godot does not know gets no base and silently receives zero
inherited validation. Conformance tests (barrelCompleteness, reactFree, ruleCoverage,
baseChainCompleteness) fail on a mis-wired slice.

Coverage: `node scripts/coverage-report.mjs [--next 5]` derives which Godot node types
are still unregistered, base classes first.

Resource types: `packages/textscene-core/src/resources/<category>/<type>/`
(**Resource slice**, ADR-0031) — `index.ts` (registration via
`registerResourceSlice`, THREE-free, wired into `resources/sliceRegistrations.ts`)
· `decode.ts` (pure: property bag → typed Data; `decode<Type>` naming) ·
`build.ts` only where THREE construction exists · `types.ts` · co-located tests
incl. a registration test. Foreign formats (`resources/formats/`) declare their
real parser instead of the decode/build split. Conformance:
`resourceSliceConformance` + `resourceSliceIsolation` fail on a mis-shaped slice.

## Conventions

- Two parsers, one scanning loop (`TscnParserCore`, `ParseObserver` seam): lenient
  `TscnParser` renders what it can; `StrictTscnParser` lints and reports everything.
  Depth: ARCHITECTURE.md.
- **The linter's subject is every valid `.tscn`, not the subset this previewer
  renders.** It exists because no Godot text-scene linter did, and its job is helping
  someone author a sound, valid scene file. A property therefore earns a validator
  because Godot SERIALISES it, never because something here reads it: `Viewport.vrs_mode`
  is exactly as much the linter's business as `Line2D.points`. The
  `renderGap`/`linterOnly` split in the parity allowlist answers a different question
  (should the RENDERER read this key) and must never decide whether a validator is worth
  writing. Same for the vendored corpus: it is a false-positive detector, so "no scene
  sets this" sizes the blast radius of a change and never justifies skipping one.
- Every diagnostic is grounded in the engine source, in one of three tiers (ADR-0032).
  **error** = the setter refuses or alters the value (`ERR_FAIL*`, a clamp, a mask
  that drops bits). **warning** = outside what the property's own
  UI-control hint permits, `PROPERTY_HINT_RANGE` / `LAYERS_*` / `FLAGS` alike, where
  `,or_greater` opens the max end and `,or_less` opens the min end and an open end
  never warns. **nothing** = `PROPERTY_HINT_NONE`, both ends open, or a bound that
  only exists in the class-reference prose. A hint constrains the inspector widget, not
  the engine, so it warns and never errors. Cite the `file:line` beside each bound; a
  constant named `EXTREME_*` / `LARGE_*` / `*_RECOMMENDED` without one is a defect.
  A `p_flags & MASK` setter is BOTH tiers and needs `maskedBitField`, not a min/max:
  a bit outside the mask is dropped (error), a bit inside it but missing from the
  `FLAGS` hint is kept yet unreachable from the inspector (warning).
  A fractional literal in an INT slot is a fourth case and also a warning: `_to_int`
  truncates it BEFORE the setter runs, so `set_hframes` never sees the `5.5` — the
  stored value differs from the written one, but not by the setter's doing. It is
  the shared `truncatedInt`, applied to every int slot after its bounds; no slice
  declares it.
  `inf`/`-inf`/`inf_neg`/`nan` are LEGAL float literals that Godot writes and reloads
  (`variant_parser.cpp:150-155`), so every float validator accepts them. Only a setter
  opening with `ERR_FAIL_COND(!is_finite(...))` refuses one, and it says so with
  `{ finite: 'file:line' }` — a range bound cannot stand in, since every comparison
  against `nan` is false.
- **`ADD_PROPERTY` is one of FOUR ways a property reaches a `.tscn`.** The others are
  `PropertyListHelper`/`register_property`, `ADD_ARRAY_COUNT` (a real serialised INT,
  `class_db.cpp:1492`, whose floor is often an `ERR_FAIL_COND` in a template in the
  BASE header), and a hand-rolled `_set`/`_get`/property-list override. That override
  is **not always underscore-prefixed** — `ChainIK3D::get_property_list` has none, and
  that class serialises a whole nested `settings/<i>/joints/<j>/` family while
  declaring zero `ADD_PROPERTY` and zero XML `<member>`. Grep all four, both
  spellings, plus the family's literal key prefix, before calling a class empty.
- **`ADD_PROPERTY` gives the declared type; the GETTER decides the serialised form.**
  A `TypedArray<T>` getter behind a `PropertyInfo(Variant::PACKED_*, …)` serialises as
  `Array[T]([…])`, not `PackedTArray(…)` — all five of CodeEdit's array properties do
  this. Read the getter signature for every array or dictionary property, or ship a
  validator that rejects what Godot itself wrote.
- That grounding is declared, not inferred. Every validator carries `formatOnly` (it
  rejects only what Godot's parser could not read either, so no citation exists),
  `grounding` (it rejects a real value, and names the `file:line`), or `intSlot` (it
  reads an INT slot, so `_to_int` itself is the authority and the citation is always
  `variant.h:360-377`; it also records the slot's `width`, since `4294967296` is
  unstorable in an int32 slot and exact in an int64 one). The `v` DSL sets one, a
  hand-rolled validator must say which, and `boundGrounding` fails on one that says
  none — `intSlot` counts only for a validator carrying no bounds of its own.
  Every `RangeArm` carries a required `cite`, checked by `rangeAdvisoryGrounding`. Both guards exist because a sweep that only sees the DSL
  reads zero while a hand-rolled validator rejects legal scenes beside it.
- Advisory linter conditions are WARNINGS, not errors — an error rule on a condition an
  existing positive fixture carries breaks fixtureLint.
- Web tests run under happy-dom: no CSS cascade, no layout — never assert rendered
  geometry. Pin load-bearing CSS by reading the `.module.css` source via
  `import.meta.dirname`, never `process.cwd()` (hooks/CI run from the repo root).
- `THREE.Object3D` has ONE parent: cached Object3D resources are cloned per consumer
  (`src/resources/useResource.ts`); identity-equality only for textures/materials.
- Tests: happy + error + edge per public method, co-located. Prefix intentionally-unused
  params with `_`.
- Self-registration on import — never edit central files beyond the aggregation imports.
  Keep web previewer and VS Code extension at parity via the shared core.
- **Engine facts live in `packages/textscene-core/src/godot/`, which imports
  NOTHING** — the one module every domain (linter, parser, resources, nodes, r3f)
  may import freely, because as a leaf it can never carry one domain's weight
  into another's bundle. A constant or pure function that describes GODOT rather
  than this codebase, and that a second domain could want, belongs there:
  `CMP_EPSILON`/`isZeroApprox` (`math.ts`), `IS_VALID_INT_RE` (`string.ts`).
  **Before declaring a magic number, threshold, tolerance or engine-grammar regex
  in a slice, look there first** — six copies of `/^[+-]?\d+$/` and five of
  `CMP_EPSILON` accumulated one slice at a time, and one of them stood in at
  `1e-6`, ten times off, rejecting values Godot calls zero. One file per engine
  area, named for it (`math.ts`, `string.ts`), never one bag of constants: the
  value is the reasoning attached to each fact, and that survives only while the
  files stay small and topical. Anything typed in this repo's own vocabulary
  (`ParseError`, `PropertyValidator`, THREE, React) is a domain concept and must
  NOT go there; `noDependencies.test.ts` enforces it.
- Shared deps: pnpm catalog (`pnpm-workspace.yaml`), referenced as `"catalog:"`.
- Logging: verbose `logger.info` with `[Category]` prefixes in core; host apps filter;
  `error`/`warn` for real problems.
- Comments: non-obvious info only; no issue/WI references in code.
- Implement completely — no stubs/placeholders/TODOs; do every numbered item, including
  doc-only edits.
- Commits: conventional, technical, no AI-attribution lines.
