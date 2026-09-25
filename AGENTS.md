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
  part of `validate` (so `release.yml`) and is its own CI step. Run
  it locally with the other gates, not only at push time.
- `pnpm test:unit` is the full vitest suite and takes minutes. On a shell-tool timeout,
  re-run the same command with a larger `timeout` (ms). A subset never proves the gate.
- Per package: `pnpm --filter @textscene/web-previewer type-check` / `test`.
- `npx eslint <changed files>`. CI runs `eslint .`. Unused imports and variables pass
  vitest and tsc but fail CI.
- Changed `.tscn` fixtures: `pnpm build:linter && pnpm lint:tscn <files>`.
- Changed a linter rule or validator: `pnpm lint:scenes`, in `validate` and in CI. It
  sweeps `scenes/demos` and `scenes/isometric` and fails on any error. The directory
  list lives in `lint:scenes:only`, which CI runs too. It never lives inside the linter
  or the core package: the tool takes paths, the caller chooses them.
  `scenes/demos` and `scenes/isometric` are vendored from Godot's own demo projects, so an
  error there is a false positive in a rule, not a broken scene. Warnings there are
  expected and do not fail. `fixtureLint.test.ts` covers `scenes/fixtures`, this
  package's own corpus, including the negative `edge-*` files that must error.
- Changed rendering: `pnpm test:visual` (golden images). A capture must decode to its
  baseline's pixels exactly. There is no per-scene tolerance, and a new one is never the
  answer to a failure. `pnpm test:visual:update` rewrites baselines: inspect them, then
  commit. A new golden moves one variable. Its `.tscn` header names that variable and
  says why a regression in it is invisible in every other scene, because a fixture that
  moves two cannot show which one broke. A 2D-UI scene sets `mode: '2d'`
  (`scripts/visual/scenes.mjs`). That routes it through the **2D parity capture** (the
  project-viewport rectangle at zoom 1, chrome hidden, Godot's own clear colour) instead
  of the default 3D one, so a Control's golden and its `comparison.md` describe the same
  picture.
  CI skips the golden run on a pull request whose every changed file matches
  `scripts/ci/visualScope.mjs`. A file the harness or the web build reads never goes on
  that list.
- Changed the webview CSP, its bundle or asset loading, or the text pipeline:
  `pnpm test:vscode:csp`. It drives a real desktop VS Code, opens a Control fixture
  through the extension's own preview command and reads the canvas back over CDP. It
  requires ink with text, exactly 0 ink with every label emptied, and zero CSP violations
  or network attempts inside the preview frame. Linux/Xvfb. CI runs it there.
- Changed the web previewer's outliner, inspector, mode switching, or camera/selection
  wiring: `pnpm test:e2e:web`. It drives the real built app in a headless browser
  (`scripts/e2e/webAppGate.mjs`) and asserts:
  - the viewport camera's GL-uploaded `viewMatrix` is byte-identical across two different
    tree selections (the camera never moves on selection: auto-fit is load-time only);
  - the outliner's node paths and the inspector's displayed property values;
  - a 2D/3D fixture opens in the matching workspace with a correctly sized canvas,
    checked separately from its ink count;
  - zero console errors, pageerrors or failed requests on load.

  It observes entirely from outside the app (`context.addInitScript` patching
  `WebGL(2)RenderingContext.prototype`, the same mechanism `scripts/vscode/driveScene.mjs`
  uses). No production file carries a test hook for it.
  **Run it as `SHOWCASE_CHANNEL=bundled pnpm test:e2e:web`.** Everything that goes through
  `scripts/showcase/browser.mjs` (this gate, `showcase/record.mjs`, `showcase/_verify.mjs`)
  defaults to system Chrome. Where only Playwright's bundled browser is installed, it dies
  at launch with "Chromium distribution 'chrome' is not found". That looks like a missing
  dependency, not a missing variable. CI sets `bundled`, so that is the configuration the
  gate is verified under.
- Parity questions: `pnpm ref:godot <scene.tscn> [--camera x,y,z] [--probe x,y]` renders
  through real Godot 4.6 and prints exact pixels. Measure, never derive. It needs local
  `godot` and `xvfb-run`, so it is a tool, not a gate. It injects the editor preview
  sun/environment per Godot's yield rule (ADR-0025). `--no-previews` gives runtime
  semantics.
  - Particles: the editor animates particles, which a paused reference cannot show.
    `--particles <seconds>` advances every CPUParticles emitter that much further through
    Godot's own settle loop. It adds to any authored `preprocess` and does not replace
    it, so the caller names the instant and both sides can be measured at it. Default 0.
    Never derive it from the scene. It is one number for the whole scene, while the
    previewer's substituted window is per emitter.
  - Root-only settings: a 2D scene renders inside a SubViewport, which owns its rectangle
    whatever the window does. Godot applies some viewport settings to `SceneTree`'s root
    Window and to nothing else (`gui/common/snap_controls_to_pixels`, the
    `rendering/2d/snap/*` pair, the canvas-texture filter/repeat defaults, `msaa_2d`, and
    so on), so nothing nested can observe them. `--mode 2d-root` draws the same rectangle
    as the root window for those. The SubViewport arm stays the default and refuses such
    a setting, naming it and both values, instead of answering from the class default.
    `ROOT_ONLY_VIEWPORT_PROPERTIES` in `scripts/godot-ref/run.mjs` is the list, and each
    entry cites the Godot line that applies it. Extend it there when you find a new one.
  - Rounding floor: the tool has a **±1/255 floor on any channel whose value × 255 is
    fractional**. The rasterizer's ROP rounds a blend into an 8-bit attachment, and
    GL/Vulkan require only that the source is clamped before the blend equation, never
    converted to fixed point. The tie-break is therefore implementation-defined.
    `--rendering-driver opengl3` against the default vulkan moves the bytes on this
    machine, the clear colour included (0.3 × 255 = 76.5 lands 76 under one and 77 under
    the other). A one-step gap on a fractional channel is not a parity defect and has no
    source-derivable expected value. Reproducing it would pin us to one software
    rasterizer. Measure such a channel on both backends before you believe it, and spend
    the effort on a divergence that survives the swap.

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

`--intent` sets the slice shape, the render registration and the sheet status together,
because `scripts/compare-docs/sheets.test.mjs` asserts they agree:

- `draws` gets its own types, parser and Component, and the sheet status `unreviewed`.
- `transform-only` reuses the base, registers `renderIntent: 'transform-only'`, and gets
  `linter-only` (ADR-0008).
- `pending` is parsed but not drawn. It registers the base under
  `renderIntent: 'pending'` (except `--base control`) and gets `unimplemented`.

The badge reads the declared intent, never the absence of a registration. Dropping the
registration also drops `visible` and puts the type in both workspaces.

The Godot parent comes from ClassDB and is never typed by hand. `NODE_BASE_TYPES` comes
from the node catalog's ancestry (`pnpm nodes:base-types` writes
`godot/nodeBaseTypes.generated.ts`). A type name Godot does not know gets no base and
silently receives zero inherited validation, so the scaffold refuses a name absent from
the catalog. A class the pinned 4.6.3 ClassDB does not enumerate gets its one hop
written by hand, in the `UNCATALOGUED` table in `godot/nodeBaseTypes.ts`, with the
reason beside it. `baseChainCompleteness.test.ts` rejects a registered type that is in
neither, and an entry the catalog could have answered. The conformance guards
(barrelCompleteness, parserBarrelCompleteness, reactFree, ruleCoverage,
baseChainCompleteness) fail on a mis-wired slice.

Coverage: `node scripts/coverage-report.mjs [--json]` reports node registration and
validator coverage against the pinned catalog.

Resource types: `packages/textscene-core/src/resources/<category>/<type>/`
(**Resource slice**, ADR-0031) holds:

- `index.ts`: registration through `registerResourceSlice`, THREE-free, wired into
  `resources/sliceRegistrations.ts`;
- `decode.ts`: pure, property bag to typed Data, named `decode<Type>`;
- `build.ts`, only where THREE construction exists;
- `types.ts`;
- co-located tests, including a registration test.

Foreign formats (`resources/formats/`) declare their real parser instead of the
decode/build split. Conformance: `resourceSliceConformance` and `resourceSliceIsolation`
fail on a mis-shaped slice.

## Conventions

- Two parsers, one scanning loop (`TscnParserCore`, `ParseObserver` seam). The lenient
  `TscnParser` renders what it can. `StrictTscnParser` lints and reports everything.
  ARCHITECTURE.md has the detail.
- **The linter's subject is every valid current-format `.tscn`, not the subset this
  previewer renders.** Its job is to help someone author a sound, valid scene file. A
  property earns a validator because Godot serialises it, never because something here
  reads it. `Viewport.vrs_mode` is as much the linter's business as `Line2D.points`. The
  `renderGap`/`linterOnly` split in the parity allowlist answers a different question
  (should the renderer read this key) and never decides whether a validator is worth
  writing. The vendored corpus is a false-positive detector. "No scene sets this" sizes
  the blast radius of a change and never justifies skipping one.
  The one scope limit is the file's own header. `format <= 2` predates the string ext-
  and sub-resource ids that version 3 introduced, so those files get a single
  `legacy-format-version` info and no other diagnostic (ADR-0032). Formats 3 and 4 are
  both current (one 4.6.3 saver writes either, per file), and a header that declares no
  format is current too, so none of them is bounded.
- Every property bound is grounded in the engine source, in one of three bound tiers
  (ADR-0032, defined under **Severity** in CONTEXT.md). Cite the `file:line` beside each
  bound. A constant named `EXTREME_*`, `LARGE_*` or `*_RECOMMENDED` without one is a
  defect.
  - **error**: the setter refuses or alters the value (`ERR_FAIL*`, a clamp, a mask that
    drops bits).
  - **warning**: outside what the property's own UI-control hint permits,
    `PROPERTY_HINT_RANGE`, `LAYERS_*` and `FLAGS` alike. `,or_greater` opens the max end,
    `,or_less` opens the min end, and an open end never warns. A hint constrains the
    inspector widget, not the engine, so it warns and never errors.
  - **nothing**: `PROPERTY_HINT_NONE`, both ends open, or a bound that exists only in the
    class-reference prose.

  A `p_flags & MASK` setter is both tiers and needs `maskedBitField`, not a min/max. A
  bit outside the mask is dropped (error). A bit inside it but missing from the `FLAGS`
  hint is kept yet unreachable from the inspector (warning).
  A literal that an INT slot stores differently is a fourth case and also a warning.
  `_to_int` truncates `5.5` and maps `true` to 1 before the setter runs, so
  `set_hframes` never sees either. The stored value differs from the written one, but
  not by the setter's doing. The shared `storedNotWritten` handles it, applied to every
  int slot after its bounds. No slice declares it.
  `inf`, `-inf`, `inf_neg` and `nan` are legal float literals that Godot writes and
  reloads (`variant_parser.cpp:150-155`), so every float validator accepts them. Only a
  setter that opens with `ERR_FAIL_COND(!is_finite(...))` refuses one, and it says so
  with `{ finite: 'file:line' }`. A range bound cannot stand in, since every comparison
  against `nan` is false.
  A semantic rule's tier is derived, not chosen. `severityFixedBy` reads the rule's
  `EmitGrounding` kind:
  - a ported `get_configuration_warnings()` row warns;
  - an `engine-inert` value (the engine reads it and leaves it inert) and a
    `previewer-limitation` are both info;
  - a `linter-failure` errors;
  - the three scopes that describe the file rather than the engine
    (`dangling-reference`, `unresolvable-path`, `file-integrity`) warn;
  - only the `engine` kind is left to its cite.
- **`ADD_PROPERTY` is one of four ways a property reaches a `.tscn`.** The others are
  `PropertyListHelper`/`register_property`, `ADD_ARRAY_COUNT` (a real serialised INT,
  `class_db.cpp:1492`, whose floor is often an `ERR_FAIL_COND` in a template in the
  base header), and a hand-rolled `_set`/`_get`/property-list override. That override
  is not always underscore-prefixed. `ChainIK3D::get_property_list` has none, and that
  class serialises a whole nested `settings/<i>/joints/<j>/` family while it declares
  zero `ADD_PROPERTY` and zero XML `<member>`. Grep all four, both spellings, plus the
  family's literal key prefix, before you call a class empty.
- **`ADD_PROPERTY` gives the declared type. The getter decides the serialised form.**
  A `TypedArray<T>` getter behind a `PropertyInfo(Variant::PACKED_*, …)` serialises as
  `Array[T]([…])`, not `PackedTArray(…)`. All five of CodeEdit's array properties do
  this. Read the getter signature for every array or dictionary property, or you ship a
  validator that rejects what Godot itself wrote.
- That grounding is declared, not inferred. Every validator carries one of three
  markers:
  - `formatOnly`: it rejects only values that never reach the property (unreadable text,
    or a type `can_convert_strict` refuses), so no per-property citation exists.
  - `grounding`: it rejects a real value, and names the `file:line`.
  - `intSlot`: it reads an INT slot, so `_to_int` itself is the authority and the
    citation is always `variant.h:360-377`. `intSlot` also records the slot's `width`,
    since `4294967296` is unstorable in an int32 slot and exact in an int64 one.

  The `v` DSL sets one. A hand-rolled validator must say which. `boundGrounding` fails
  on one that says none, and `intSlot` counts only for a validator that carries no
  bounds of its own. Every `RangeArm` carries a required `cite`, checked by
  `rangeAdvisoryGrounding`. Both guards exist because a check that sees only the DSL
  misses a hand-rolled validator that rejects legal scenes.
- Advisory linter conditions are warnings, not errors. An error rule on a condition that
  an existing positive fixture carries breaks fixtureLint.
- Web tests run under happy-dom: no CSS cascade and no layout, so never assert rendered
  geometry. Pin load-bearing CSS by reading the `.module.css` source through
  `import.meta.dirname`, never `process.cwd()` (hooks and CI run from the repo root).
- `THREE.Object3D` has one parent, so cached Object3D resources are cloned per consumer
  (`src/resources/useResource.ts`). Assert identity equality only for textures and
  materials. The exception is a consumer that needs its own colour space: it clones and
  retags, so assert `.source` identity there. That is `r3f/undecodedTexture.ts` for the
  2D canvas and the theme icons, and
  `resources/materials/standardmaterial3d/textureBinding.ts` for a 3D material, where
  the slot decides it (Godot's `source_color` samplers) and both arrival paths cross the
  same seam.
- Tests: happy + error + edge per public method, co-located. Prefix intentionally-unused
  params with `_`.
- Self-registration on import: never edit central files beyond the aggregation imports.
  Keep the web previewer and the VS Code extension at parity through the shared core.
- **Engine facts live in `packages/textscene-core/src/godot/`, which imports
  nothing.** It is the one module every domain (linter, parser, resources, nodes, r3f)
  may import freely, because as a leaf it can never carry one domain's weight into
  another's bundle. A constant or pure function that describes Godot rather than this
  codebase, and that a second domain could want, belongs there. Examples: `CMP_EPSILON`
  and `isZeroApprox` (`math.ts`), `IS_VALID_INT_RE` (`string.ts`). **Before you declare
  a magic number, threshold, tolerance or engine-grammar regex in a slice, look there
  first.** A copy in a slice drifts: a wrong `CMP_EPSILON` rejects values Godot calls
  zero. Use one file per engine area, named for it (`math.ts`, `string.ts`), never one
  bag of constants, so the reasoning beside each fact stays readable. Anything typed in
  this repo's own vocabulary (`ParseError`, `PropertyValidator`, THREE, React) is a
  domain concept and must not go there. `noDependencies.test.ts` enforces it.
- Shared deps: pnpm catalog (`pnpm-workspace.yaml`), referenced as `"catalog:"`.
- Logging: verbose `logger.info` with `[Category]` prefixes in core. Host apps filter.
  `error` and `warn` are for real problems.
- Comments: non-obvious information only. No issue or work-item references in code.
  A fact that needs more room than a comment goes in a `.md` beside the code. Generated
  files and `lint:begin` sections keep their generator's text: change the generator.
- Implement completely: no stubs, placeholders or TODOs. Do every numbered item,
  including doc-only edits.
- Commits: conventional, technical. The `commit-msg` hook and the PR-title Claude hook
  enforce the format.
- `.claude/skills/conventional-commits/`, `.claude/rules/` and `.claude/agents/ste-review.md`
  are vendored from Verktøykasse. Never edit them here: run
  `pnpm vendor:verktoykasse --from <checkout>`. A test fails on a local edit.
