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
- Changed rendering: `pnpm test:visual` (golden images) — a capture must decode to its
  baseline's pixels EXACTLY; there is no per-scene tolerance and a new one is never the
  answer to a failure. `pnpm test:visual:update` rewrites baselines — eyeball, then
  commit. A NEW golden moves ONE variable, and its `.tscn` header names it and says why
  a regression in it is invisible in every other scene — a fixture that moves two
  cannot localise which one broke. A 2D-UI scene sets `mode: '2d'`
  (`scripts/visual/scenes.mjs`), routing it through the **2D parity
  capture** — the project-viewport rectangle at zoom 1, chrome hidden, Godot's own
  clear colour — instead of the default 3D one, so a Control's golden and its
  `comparison.md` describe the same picture.
- Changed the webview CSP, its bundle/asset loading, or the text pipeline:
  `pnpm test:vscode:csp` — drives a real desktop VS Code, opens a Control fixture through
  the extension's own preview command and reads the canvas back over CDP. Requires ink
  with text, exactly 0 with every label emptied, and zero CSP violations or network
  attempts inside the preview frame. Linux/Xvfb; CI runs it there.
- Changed the web previewer's outliner, inspector, mode switching, or camera/selection
  wiring: `pnpm test:e2e:web` — drives the real built app in a headless browser
  (`scripts/e2e/webAppGate.mjs`). Asserts the viewport camera's GL-uploaded `viewMatrix`
  is byte-identical across two different tree selections (camera never moves on
  selection — auto-fit is load-time only), the outliner's node paths, the inspector's
  displayed property values, that a 2D/3D fixture opens in the matching workspace with a
  properly SIZED canvas checked separately from its ink count, and zero console
  errors/pageerrors/failed requests on load. Observes entirely from outside the app
  (`context.addInitScript` patching `WebGL(2)RenderingContext.prototype`, the same
  mechanism `scripts/vscode/driveScene.mjs` uses) — no production file carries a test
  hook for it.
- Parity questions: `pnpm ref:godot <scene.tscn> [--camera x,y,z] [--probe x,y]` renders
  through real Godot 4.6 and prints exact pixels — measure, never derive. Needs local
  `godot` + `xvfb-run`, so it is a tool, not a gate. It injects the editor preview
  sun/environment per Godot's yield rule (ADR-0025); `--no-previews` gives runtime
  semantics. The editor also ANIMATES particles, which a paused reference cannot show:
  `--particles <seconds>` advances every CPUParticles emitter that much FURTHER through
  Godot's own settle loop — on top of any authored `preprocess`, which it adds to rather
  than replaces — so the caller names the instant and both sides can be measured at it.
  Default 0; never derive it from the scene, and note it is one number for the whole
  scene while the previewer's substituted window is per emitter.
  A 2D scene renders inside a SubViewport, which owns its rectangle whatever the window
  does — but Godot hands some viewport settings to `SceneTree`'s root Window and to
  nothing else (`gui/common/snap_controls_to_pixels`, the `rendering/2d/snap/*` pair,
  the canvas-texture filter/repeat defaults, `msaa_2d`, …), so nothing nested can observe
  them. `--mode 2d-root` draws the SAME rectangle AS the root window for those; the
  SubViewport arm stays the default and now REFUSES, naming the setting and both values,
  rather than answering from the class default. `ROOT_ONLY_VIEWPORT_PROPERTIES` in
  `scripts/godot-ref/run.mjs` is the list, each entry citing the Godot line that applies
  it — extend it there when a new one turns up.
  The tool has a **±1/255 floor on any channel whose value × 255 is fractional**: blending
  into an 8-bit attachment is rounded by the rasterizer's ROP, and GL/Vulkan require the
  source only to be CLAMPED before the blend equation, never converted to fixed point —
  so the tie-break is implementation-defined. `--rendering-driver opengl3` against the
  default vulkan moves the bytes on this machine, the clear colour itself included
  (0.3 × 255 = 76.5 lands 76 under one and 77 under the other). A one-step gap on a
  fractional channel is therefore NOT a parity defect and has no source-derivable
  expected value; reproducing it would pin us to one software rasterizer. Measure such a
  channel on both backends before believing it, and spend the effort on a divergence that
  survives the swap.

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

Scaffold: `pnpm new:node <TypeName> <category-dir> [--base node3d|node2d] [--linter]`
(creates the `unit-*.tscn` fixture + aggregation imports). Conformance tests
(barrelCompleteness, reactFree, ruleCoverage) fail on a mis-wired slice.

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
- Advisory linter conditions are WARNINGS, not errors — an error rule on a condition an
  existing positive fixture carries breaks fixtureLint.
- Web tests run under happy-dom: no CSS cascade, no layout — never assert rendered
  geometry. Pin load-bearing CSS by reading the `.module.css` source via
  `import.meta.dirname`, never `process.cwd()` (hooks/CI run from the repo root).
- `THREE.Object3D` has ONE parent: cached Object3D resources are cloned per consumer
  (`src/resources/useResource.ts`); identity-equality only for textures/materials —
  except where a consumer needs its own colour space, which clones and retags, so
  assert `.source` identity there — `r3f/undecodedTexture.ts` for the 2D canvas and
  the theme icons, and
  `resources/materials/standardmaterial3d/textureBinding.ts` for a 3D material,
  where naming the SLOT is what decides it (Godot's `source_color` samplers) and
  both arrival paths cross the same seam.
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
