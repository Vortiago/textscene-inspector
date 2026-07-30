# TextScene Inspector

Godot `.tscn` parser/linter/renderer (react-three-fiber over three.js). pnpm monorepo:
`packages/textscene-core` (parser, linter, r3f components) · `apps/textscene-web`
(web previewer) · `apps/textscene-vscode` (VS Code extension) · `apps/textscene-linter`
(CLI linter, React/THREE-free).

## Gates (repo root)

- `pnpm type-check:all` — builds `@textscene/core` first; run once in a fresh worktree
  before any per-package check.
- `pnpm test:unit` — full vitest suite, takes minutes. On shell-tool timeout re-run the
  SAME command with a larger `timeout` (ms); a subset never proves the gate.
- Per-package: `pnpm --filter @textscene/web-previewer type-check` / `test`.
- `npx eslint <changed files>` — CI runs `eslint .`; unused imports/vars pass
  vitest + tsc but fail CI.
- Changed `.tscn` fixtures: `pnpm build:linter && pnpm lint:tscn <files>`.
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
`unit-*.tscn` fixture, the aggregation imports, and the `NODE_BASE_TYPES` entry).

`--intent` settles the slice shape, the render registration and the sheet status
together, because `sheets.test.mjs` asserts they agree: `draws` = own
types/parser/Component and `unreviewed`; `transform-only` = ADR-0008, reuses the base,
registers `renderIntent: 'transform-only'`, `linter-only`; `pending` = parsed but not
drawn, registers NO component, `unimplemented`. `--chain` names the Godot parent —
mandatory because a type absent from `NODE_BASE_TYPES` silently receives zero
inherited validation. Conformance tests (barrelCompleteness, reactFree, ruleCoverage,
baseChainCompleteness) fail on a mis-wired slice.

Coverage: `node scripts/coverage-report.mjs [--next 5]` derives which Godot node types
are still unregistered, base classes first.

## Conventions

- Two parsers, one scanning loop (`TscnParserCore`, `ParseObserver` seam): lenient
  `TscnParser` renders what it can; `StrictTscnParser` lints and reports everything.
  Depth: ARCHITECTURE.md.
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
- Shared deps: pnpm catalog (`pnpm-workspace.yaml`), referenced as `"catalog:"`.
- Logging: verbose `logger.info` with `[Category]` prefixes in core; host apps filter;
  `error`/`warn` for real problems.
- Comments: non-obvious info only; no issue/WI references in code.
- Implement completely — no stubs/placeholders/TODOs; do every numbered item, including
  doc-only edits.
- Commits: conventional, technical, no AI-attribution lines.
