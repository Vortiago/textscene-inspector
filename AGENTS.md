# TextScene Inspector

TextScene Inspector parses, lints and renders Godot `.tscn` files with react-three-fiber. The
pnpm monorepo holds `packages/textscene-core` (parser, linter, r3f components),
`apps/textscene-web` (web previewer), `apps/textscene-vscode` (VS Code extension) and
`apps/textscene-linter` (CLI linter, free of React and THREE).

## Docs

- ARCHITECTURE.md: design and structure. Read it before structural work.
- GLOSSARY.md: the domain terms. Use them exactly.
- docs/adr/: decisions. Respect them in the areas they govern.
- docs/agents/: the issue tracker and the domain docs.
- README.md, REFERENCES.md, RELEASING.md, REVIEW.md: scripts, doc links, releases, review bar.

## Issues

Work items are GitHub issues. `gh issue view <n>` gives the implementation notes and testing
strategy.

- Do one issue at a time. The user picks it.
- Never start the next issue on your own.
- Reference the issue from the PR with `Closes #<n>`.

## Policies

- Do the full scope at full quality. Never trim, skip tests or defer for time, token or
  context pressure, and never mention such limits.
- Implement completely: no stubs, placeholders or TODOs. Do every numbered item.
- Give no time estimates. Report complexity only (simple / moderate / complex).
- Never run `git commit --no-verify` or `-n`. A hook blocks them.
- Write conventional, technical commits. Hooks enforce the format.
- Never edit `.claude/skills/conventional-commits/`, `.claude/rules/` or
  `.claude/agents/ste-review.md`. Run `pnpm vendor:verktoykasse --from <checkout>` instead.

## Gates

Run each gate from the repo root. Run these for every change:

- `pnpm type-check:all`. Run it once in a fresh worktree before any per-package check.
- `pnpm type-check:tests`. Every package that ships tests must define the script.
- `pnpm test:unit`. On a shell-tool timeout, re-run it with a larger `timeout`. A subset never
  proves the gate.
- `npx eslint <changed files>`.
- `pnpm format:check`. `pnpm format` fixes a failure.

Per package: `pnpm --filter @textscene/web-previewer type-check` / `test`.

Run these when the change touches the named area:

- `.tscn` fixtures: `pnpm build:linter && pnpm lint:tscn <files>`. The negative `edge-*` fixtures
  must error, and `fixtureLint.test.ts` checks them.
- A linter rule or validator: `pnpm lint:scenes`. An error in its vendored Godot demos is a
  false positive in the rule. Keep its directory list in `lint:scenes:only`.
- Rendering: `pnpm test:visual`.
- The webview CSP, its bundle, asset loading, the text pipeline or the **Dependency hot-reload**:
  `pnpm test:vscode:csp`.
- The web previewer's outliner, inspector, mode switching, or camera and selection wiring:
  `SHOWCASE_CHANNEL=bundled pnpm test:e2e:web`. Without the variable, it fails to find system
  Chrome. Never add a test hook for it to a production file.

### Visual goldens

- A capture must match its baseline's pixels exactly. Never add a tolerance.
- `pnpm test:visual:update` rewrites baselines. Inspect them, then commit.
- A new golden moves one variable. Its `.tscn` header names that variable and says why no
  other scene shows a regression in it.
- A 2D-UI scene sets `mode: '2d'` in `scripts/visual/scenes.mjs`.
- Never list a file that the harness or the web build reads in `scripts/ci/visualScope.mjs`.

### Godot reference

`pnpm ref:godot <scene.tscn> [--camera x,y,z] [--probe x,y]` renders through real Godot 4.6
and prints exact pixels. It is a tool, not a gate.

- Measure, never derive. Put a measurement in the pull request, never in a comparison sheet.
- `--particles <seconds>` advances every CPUParticles emitter. Choose the instant. Never
  derive it from the scene.
- `--mode 2d-root` measures a root-only setting. Add a new one to
  `ROOT_ONLY_VIEWPORT_PROPERTIES` in `scripts/godot-ref/run.mjs`.
- A 1/255 gap on a channel whose value × 255 is fractional is not a parity defect. Compare
  `--rendering-driver opengl3` with the default vulkan before you believe one.

## Vertical slices

A node type lives in `packages/textscene-core/src/nodes/<category>/<type>/`: `parser.ts`,
`linterParser.ts`, `linter.ts`, `propertyFormatter.ts` (optional), `Component.tsx`,
`types.ts`, `comparison.md` (format in `scripts/compare-docs/SHEET-STANDARD.md`) and
co-located `*.test.ts(x)`. It has three entry points:

- `index.ts`: parser and formatter, wired into `src/parser/TscnParser.ts`.
- `index.linter.ts`: validators and rules, wired into `src/linter/index.ts`. It never
  imports `Component.tsx`.
- `index.r3f.ts`: the only importer of `./Component`, wired into `src/r3f/nodes/index.ts`.

Slices register themselves on import. Never edit a central file beyond its aggregation
imports.

Scaffold a node type with `pnpm new:node <TypeName> <category-dir> --intent
<draws|transform-only|pending> [--base node3d|node2d|node|control] [--linter]`. It creates the
`unit-*.tscn` fixture. `--intent` sets the slice shape, the render registration and the sheet status:

- `draws`: its own types, parser and Component. Status `unreviewed`.
- `transform-only`: the base under `renderIntent: 'transform-only'`. Status `linter-only`.
- `pending`: the base under `renderIntent: 'pending'`, except `--base control`. Status
  `unimplemented`.

Never drop a registration to mark a type undrawn.

The Godot parent comes from ClassDB (`pnpm nodes:base-types`), never by hand. A class the
pinned ClassDB lacks goes in the `UNCATALOGUED` table of `godot/nodeBaseTypes.ts`, with the
reason.

A **Resource slice** (ADR-0031) lives in `packages/textscene-core/src/resources/<category>/<type>/`:

- `index.ts`: THREE-free registration through `registerResourceSlice`, wired into
  `resources/sliceRegistrations.ts`.
- `decode.ts`: a pure `decode<Type>` from property bag to typed Data.
- `build.ts`: only where THREE construction exists.
- `types.ts` and co-located tests, a registration test included.

## Linter

The linter's subject is every valid current-format `.tscn`, not the subset this previewer
renders. A property earns a validator because Godot serialises it.

### Bound tiers

Ground every bound in the engine source and cite its `file:line` beside it. GLOSSARY.md
(**Severity**) and ADR-0032 define the tiers.

- **error**: the setter refuses or alters the value.
- **warning**: the value is outside the property's UI hint. An open end (`,or_greater`,
  `,or_less`) never warns.
- **nothing**: `PROPERTY_HINT_NONE`, both ends open, or a bound only in the class reference.

Also:

- A `p_flags & MASK` setter uses `maskedBitField`, not a min/max.
- Every float validator accepts `inf`, `-inf`, `inf_neg` and `nan`, unless the setter
  refuses them. Declare that as `{ finite: 'file:line' }`.
- An advisory condition is a warning, not an error.

### Validator markers

Every validator carries one marker. The `v` DSL sets it. A hand-rolled validator declares it.

- `formatOnly`: it rejects only values that never reach the property.
  `formatOnlyCorpus.ledger.test.mjs` runs it over Godot's stored literals. Add a missing literal to
  `formatOnlyCorpus.data.mjs` with its `variant_parser.cpp` cite.
- `grounding`: it rejects a value the setter receives and names the `file:line`.
- `intSlot`: it reads an INT slot. It cites `variant.h:360-377` and records the slot's `width`.

Every `RangeThreshold` carries a `cite`.

### Properties

- Before you call a class empty, grep `ADD_PROPERTY`, `PropertyListHelper`/`register_property`,
  `ADD_ARRAY_COUNT`, any `_set`/`_get`/property-list override and the literal key prefix.
- Read the getter of every array or dictionary property. A `TypedArray<T>` getter serialises
  as `Array[T]([…])`.

### Rule arms

A rule declares each diagnostic it reports as a **Rule arm** (`linter/ruleArms.ts`). `check`
reports only through `reportArm` or `armDiagnostic`, and `emits` is `armEmits(arms)`. Declare
an arm with `groundedArm(ruleName, grounding)`. Only an `engine` arm writes its tier.

## Conventions

- `packages/textscene-core/src/godot/` holds engine facts and imports nothing. Look there
  before you declare an engine constant or regex in a slice. Put a new one there.
- Web tests run under happy-dom, so never assert rendered geometry. Read a `.module.css`
  source through `import.meta.dirname`, never `process.cwd()`.
- `useResource.ts` clones a cached Object3D per consumer. Assert identity only for textures
  and materials, or `.source` identity where a consumer clones to retag the colour space.
- Write a happy, an error and an edge test per public method, co-located. Prefix an unused
  parameter with `_`.
- Assert a diagnostic's tier with `toBeAtTier` or a `tierLists.ts` helper, never
  `expect(d.severity)`.
- Keep the web previewer and the VS Code extension at parity through the shared core.
- Reference a shared dependency from the pnpm catalog as `"catalog:"`.
- Log with `logger.info` and a `[Category]` prefix in core. Keep `error` and `warn` for real
  problems.
- Write a comment only for non-obvious information, with no issue or work-item reference.
- Change the generator, never the text of a generated file or a `lint:begin` section.
