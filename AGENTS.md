# TextScene Inspector

Godot `.tscn` parser, linter and renderer (react-three-fiber over three.js). pnpm monorepo:
`packages/textscene-core` (parser, linter, r3f components), `apps/textscene-web`
(web previewer), `apps/textscene-vscode` (VS Code extension), `apps/textscene-linter`
(CLI linter, React- and THREE-free).

## Gates (repo root)

- `pnpm type-check:all` builds `@textscene/core` first. Run it once in a fresh worktree
  before any per-package check. It does not cover test files.
- `pnpm type-check:tests` runs one tsc project per package over the `*.test.ts(x)` files,
  which most packages' build tsconfigs exclude. (`apps/textscene-linter` includes them in
  its single project, so its script is the same command.) vitest transpiles without
  checking, so a test can be green and untyped. `pnpm -r` silently skips a package that
  does not define the script, so every package that ships tests must define it.
  `scripts/typeCheckTestsCoverage.test.mjs` keeps that true. `pnpm type-check:tests` is
  part of `validate` (so the pre-push hook and `release.yml`) and is its own CI step. Run
  `pnpm type-check:tests` locally with the other gates, not only at push time.
- `pnpm test:unit` is the full vitest suite and takes minutes. On a shell-tool timeout,
  re-run the same command with a larger `timeout` (ms). A subset never proves the gate.
- Per package: `pnpm --filter @textscene/web-previewer type-check` / `test`.
- `npx eslint <changed files>`. CI runs `eslint .`. Unused imports and variables pass
  vitest and tsc but fail CI.
- Changed `.tscn` fixtures: `pnpm build:linter && pnpm lint:tscn <files>`.
- Changed a linter rule or validator: `pnpm lint:scenes`, in `validate` and in CI. It
  sweeps `scenes/examples`, `scenes/demos`, `scenes/isometric` and `scenes/materials`,
  every shipped directory under `scenes/` but `fixtures`, and fails on any error. The
  directory list lives in `lint:scenes:only`, which CI runs too. It never lives inside the
  linter or the core package: the tool takes paths, the caller chooses them.
  `scenes/demos` and `scenes/isometric` are vendored from Godot's own demo projects. An
  error there is a false positive in a rule rather than a broken scene. Warnings are
  expected there and do not fail. `fixtureLint.test.ts` separately covers
  `scenes/fixtures`, this package's own corpus, including the negative `edge-*` files that
  must error.
- Changed rendering: `pnpm test:visual` (golden images). `pnpm test:visual:update`
  rewrites baselines: eyeball, then commit. A new golden moves one variable. Its `.tscn`
  header names it and says why a regression in it is invisible in every other scene. A
  fixture that moves two cannot localise which one broke.
- Parity questions: `pnpm ref:godot <scene.tscn> [--camera x,y,z] [--probe x,y]` renders
  through real Godot 4.6 and prints exact pixels. Measure, never derive. It needs a local
  `godot` and `xvfb-run`, so it is a tool, not a gate. It injects the editor preview sun
  and environment per Godot's yield rule (ADR-0025). `--no-previews` gives runtime
  semantics.
- Changed the **Control overlay** (2D DOM UI): `pnpm verify:2d` against a running
  preview (`SHOWCASE_URL`, default `http://localhost:4173`). The goldens are
  WebGL-canvas-only and happy-dom has no layout. This is therefore the only gate that
  sees a DOM-overlay regression (ADR-0024).
- Changed the Control-subtree rasteriser (`rasterizeControlSubtree`, the DOM-to-texture
  path a `ViewportTexture` samples): `pnpm verify:raster`. It makes pixel assertions in a
  real browser, since happy-dom can neither lay a Control out nor draw an SVG image. It
  needs a built core (`pnpm --filter @textscene/core build`) and, for its real-overlay
  suite, the same running preview as `verify:2d`.

## Vertical slices

Node types: `packages/textscene-core/src/nodes/<category>/<type>/` holds `parser.ts`,
`linterParser.ts` and `linter.ts`, `propertyFormatter.ts` (optional), `Component.tsx`,
`types.ts`, `comparison.md` (the Godot-parity sheet, format in
`scripts/compare-docs/SHEET-STANDARD.md`), co-located `*.test.ts(x)`, and three entry
points:

- `index.ts`: parser and formatter. Wire into `src/parser/TscnParser.ts`.
- `index.linter.ts`: validators and rules. Imports `.ts` only, never `Component.tsx`.
  Wire into `src/linter/index.ts`.
- `index.r3f.ts`: render component, the only importer of `./Component`. Wire into
  `src/r3f/nodes/index.ts`.

Scaffold: `pnpm new:node <TypeName> <category-dir> --intent <draws|transform-only|pending>
[--base node3d|node2d|node|control] [--linter]`. It creates the `unit-*.tscn` fixture
and the aggregation imports.

`--intent` settles the slice shape, the render registration and the sheet status
together, because `scripts/compare-docs/sheets.test.mjs` asserts they agree. `draws`
gets its own types, parser and Component, and the sheet status `unreviewed`.
`transform-only` reuses the base, registers `renderIntent: 'transform-only'`, and gets
`linter-only` (ADR-0008). `pending` is parsed but not drawn: it registers the base under
`renderIntent: 'pending'` (except `--base control`) and gets `unimplemented`. The badge
reads the declared intent, never the absence of a registration. Dropping the
registration also drops `visible` and puts the type in both workspaces.

The Godot parent is derived from ClassDB, never typed. `NODE_BASE_TYPES` comes from the
node catalog's ancestry (`pnpm nodes:base-types` writes
`godot/nodeBaseTypes.generated.ts`). A type name Godot does not know gets no base and
silently receives zero inherited validation. That is why the scaffold refuses a name
absent from the catalog. A class the pinned 4.6.3 ClassDB does not enumerate gets its one
hop written by hand. It goes in the `UNCATALOGUED` table in `godot/nodeBaseTypes.ts`, with
the reason beside it. `baseChainCompleteness.test.ts` rejects a registered type that is in
neither, and an entry the catalog could have answered. The conformance guards
(barrelCompleteness, parserBarrelCompleteness, reactFree, ruleCoverage,
baseChainCompleteness) fail on a mis-wired slice.

Coverage: `node scripts/coverage-report.mjs [--json]` reports node registration and
validator coverage against the pinned catalog.

Resource types: `packages/textscene-core/src/resources/<category>/<type>/`
(**Resource slice**, ADR-0031) holds `index.ts` (registration through
`registerResourceSlice`, THREE-free, wired into `resources/sliceRegistrations.ts`),
`decode.ts` (pure: property bag to typed Data, `decode<Type>` naming), `build.ts` only
where THREE construction exists, `types.ts`, and co-located tests including a
registration test. Foreign formats (`resources/formats/`) declare their real parser
instead of the decode/build split. Conformance: `resourceSliceConformance` and
`resourceSliceIsolation` fail on a mis-shaped slice.

## Conventions

- Two parsers, one scanning loop (`TscnParserCore`, `ParseObserver` seam). The lenient
  `TscnParser` renders what it can. `StrictTscnParser` lints and reports everything.
  ARCHITECTURE.md has the detail.
- **The linter's subject is every valid current-format `.tscn`, not the subset this
  previewer renders.** It exists because no Godot text-scene linter did, and its job is
  helping someone author a sound, valid scene file. A property therefore earns a
  validator because Godot serialises it, never because something here reads it.
  `Viewport.vrs_mode` is exactly as much the linter's business as `Line2D.points`. The
  `renderGap`/`linterOnly` split in the parity allowlist answers a different question
  (should the renderer read this key) and must never decide whether a validator is worth
  writing. The vendored corpus is a false-positive detector. "No scene sets this" sizes
  the blast radius of a change and never justifies skipping one.
  The one scope limit is the file's own header. `format <= 2` predates the string ext-
  and sub-resource ids that version 3 introduced, so those files get a single
  `legacy-format-version` info and no other diagnostic (ADR-0032). Formats 3 and 4 are
  both current (one 4.6.3 saver writes either, per file), and a header declaring no
  format is current too, so none of them is bounded.
- Every property bound is grounded in the engine source, in one of three bound tiers
  (ADR-0032, defined under **Severity** in CONTEXT.md). **error**: the setter refuses or
  alters the value (`ERR_FAIL*`, a clamp, a mask that drops bits). **warning**: outside
  what the property's own UI-control hint permits, `PROPERTY_HINT_RANGE`, `LAYERS_*` and
  `FLAGS` alike. `,or_greater` opens the max end, `,or_less` opens the min end, and an
  open end never warns. **nothing**: `PROPERTY_HINT_NONE`, both ends open, or a bound
  that only exists in the class-reference prose. A hint constrains the inspector widget,
  not the engine, so it warns and never errors. Cite the `file:line` beside each bound. A
  constant named `EXTREME_*`, `LARGE_*` or `*_RECOMMENDED` without one is a defect.
  A `p_flags & MASK` setter is both tiers and needs `maskedBitField`, not a min/max. A
  bit outside the mask is dropped (error). A bit inside it but missing from the `FLAGS`
  hint is kept yet unreachable from the inspector (warning).
  A literal an INT slot stores differently is a fourth case and also a warning.
  `_to_int` truncates `5.5` and maps `true` to 1 before the setter runs, so
  `set_hframes` never sees either. The stored value differs from the written one, but
  not by the setter's doing. That is the shared `storedNotWritten`, applied to every int
  slot after its bounds. No slice declares it.
  `inf`, `-inf`, `inf_neg` and `nan` are legal float literals that Godot writes and
  reloads (`variant_parser.cpp:150-155`), so every float validator accepts them. Only a
  setter opening with `ERR_FAIL_COND(!is_finite(...))` refuses one, and it says so with
  `{ finite: 'file:line' }`. A range bound cannot stand in, since every comparison
  against `nan` is false.
  A semantic rule's tier is derived rather than chosen. `severityFixedBy` reads the
  rule's `EmitGrounding` kind. A ported `get_configuration_warnings()` row warns. An
  `engine-inert` value the engine reads and leaves inert, and a `previewer-limitation`,
  are both info. A `linter-failure` errors. The three scopes that describe the file
  rather than the engine (`dangling-reference`, `unresolvable-path`, `file-integrity`)
  warn. Only the `engine` kind is left to its cite.
- **`ADD_PROPERTY` is one of four ways a property reaches a `.tscn`.** The others are
  `PropertyListHelper`/`register_property`, `ADD_ARRAY_COUNT` (a real serialised INT,
  `class_db.cpp:1492`, whose floor is often an `ERR_FAIL_COND` in a template in the
  base header), and a hand-rolled `_set`/`_get`/property-list override. That override
  is not always underscore-prefixed. `ChainIK3D::get_property_list` has none, and that
  class serialises a whole nested `settings/<i>/joints/<j>/` family while declaring
  zero `ADD_PROPERTY` and zero XML `<member>`. Grep all four, both spellings, plus the
  family's literal key prefix, before calling a class empty.
- **`ADD_PROPERTY` gives the declared type. The getter decides the serialised form.**
  A `TypedArray<T>` getter behind a `PropertyInfo(Variant::PACKED_*, …)` serialises as
  `Array[T]([…])`, not `PackedTArray(…)`. All five of CodeEdit's array properties do
  this. Read the getter signature for every array or dictionary property, or ship a
  validator that rejects what Godot itself wrote.
- That grounding is declared, not inferred. Every validator carries one of three
  markers. `formatOnly`: it rejects only values that never reach the property
  (unreadable text, or a type `can_convert_strict` refuses), so no per-property citation
  exists. `grounding`: it rejects a real value, and names the `file:line`. `intSlot`: it
  reads an INT slot, so `_to_int` itself is the authority and the citation is always
  `variant.h:360-377`. `intSlot` also records the slot's `width`, since `4294967296` is
  unstorable in an int32 slot and exact in an int64 one. The `v` DSL sets one. A
  hand-rolled validator must say which. `boundGrounding` fails on one that says none,
  and `intSlot` counts only for a validator carrying no bounds of its own. Every
  `RangeArm` carries a required `cite`, checked by `rangeAdvisoryGrounding`. Both guards
  exist because a sweep that only sees the DSL reads zero while a hand-rolled validator
  rejects legal scenes beside it.
- Advisory linter conditions are warnings, not errors. An error rule on a condition an
  existing positive fixture carries breaks fixtureLint.
- Web tests run under happy-dom: no CSS cascade, no layout. Never assert rendered
  geometry. Pin load-bearing CSS by reading the `.module.css` source through
  `import.meta.dirname`, never `process.cwd()` (hooks and CI run from the repo root).
- `THREE.Object3D` has one parent. Cached Object3D resources are cloned per consumer
  (`src/resources/useResource.ts`). Identity equality holds only for textures and
  materials.
- Tests: happy, error and edge per public method, co-located. Prefix intentionally
  unused params with `_`.
- Self-registration on import. Never edit central files beyond the aggregation imports.
  Keep the web previewer and the VS Code extension at parity through the shared core.
- **Engine facts live in `packages/textscene-core/src/godot/`, which imports
  nothing.** It is the one module every domain (linter, parser, resources, nodes, r3f)
  may import freely, because as a leaf it can never carry one domain's weight into
  another's bundle. A constant or pure function that describes Godot rather than this
  codebase, and that a second domain could want, belongs there. Examples: `CMP_EPSILON`
  and `isZeroApprox` (`math.ts`), `IS_VALID_INT_RE` (`string.ts`). **Before declaring a
  magic number, threshold, tolerance or engine-grammar regex in a slice, look there
  first.** Copies accumulate one slice at a time, and a copy of `CMP_EPSILON` once stood
  at `1e-6`, ten times off, rejecting values Godot calls zero. One file per engine area,
  named for it (`math.ts`, `string.ts`), never one bag of constants. The value is the
  reasoning attached to each fact, and that survives only while the files stay small and
  topical. Anything typed in this repo's own vocabulary (`ParseError`,
  `PropertyValidator`, THREE, React) is a domain concept and must not go there.
  `noDependencies.test.ts` enforces it.
- Shared deps: pnpm catalog (`pnpm-workspace.yaml`), referenced as `"catalog:"`.
- Logging: verbose `logger.info` with `[Category]` prefixes in core. Host apps filter.
  `error` and `warn` are for real problems.
- Comments: non-obvious information only. No issue or work-item references in code.
- Implement completely: no stubs, placeholders or TODOs. Do every numbered item,
  including doc-only edits.
- Commits: conventional, technical.
