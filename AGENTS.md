# AGENTS.md — the lean agent brief for TextScene Inspector

Operating guide for coding agents; CLAUDE.md is the in-depth companion. TextScene
Inspector parses, lints and renders Godot `.tscn` scene files (react-three-fiber over
three.js). pnpm monorepo: `packages/textscene-core` (parser, linter, r3f components),
`apps/textscene-web` (web previewer), `apps/textscene-vscode` (VS Code extension),
`apps/textscene-linter` (CLI linter — React/THREE-free).

## Gates (run from the repo root)

- `pnpm type-check:all` — builds `@textscene/core` FIRST, then type-checks every
  package. Required once in a fresh worktree before per-package checks can pass.
- `pnpm test:unit` — the full vitest suite. It takes minutes: if the shell tool times
  out, re-run the SAME command with a larger `timeout` (milliseconds). A targeted
  subset never proves the gate.
- Per-package forms: `pnpm --filter @textscene/web-previewer type-check` / `test`, etc.
- CI also runs `eslint .` — lint the files you changed (`npx eslint <files>`). Unused
  imports/vars pass vitest + tsc but fail CI.
- Created or modified `.tscn` fixtures? `pnpm build:linter && pnpm lint:tscn <files>`.
- Rendering changed? `pnpm test:visual` compares golden images against committed
  baselines (`pnpm test:visual:update` rewrites them — eyeball, then commit).

## The vertical-slice pattern (most node work lands here)

Each node type is a folder under `packages/textscene-core/src/nodes/<category>/<type>/`:
`parser.ts` · `linterParser.ts` + `linter.ts` · `propertyFormatter.ts` (optional) ·
`Component.tsx` · `types.ts` · co-located `*.test.ts(x)` · three entry points:

- `index.ts` — registers parser + formatter; wire into `src/parser/TscnParser.ts`
- `index.linter.ts` — registers validators/rules; imports `.ts` only, never
  `Component.tsx`; wire into `src/linter/index.ts`
- `index.r3f.ts` — registers the render component; the ONLY file that imports
  `./Component`; wire into `src/r3f/nodes/index.ts`

Scaffold with `pnpm new:node <TypeName> <category-dir> [--base node3d|node2d]
[--linter]` — it also creates the `unit-*.tscn` fixture and inserts the aggregation
imports. Conformance guard tests (barrelCompleteness, reactFree, ruleCoverage) fail
the suite when a slice is mis-wired.

## Conventions that bite

- **Two parsers, one scanning loop:** the lenient `TscnParser` (rendering — recover and
  render what you can) vs `StrictTscnParser` (linting — report every issue); both run
  `TscnParserCore` via the `ParseObserver` seam. Pick by purpose; depth in ARCHITECTURE.md.
- **Linter severity:** advisory conditions are WARNINGS, not errors — an error rule on
  a condition an existing positive fixture carries breaks the fixtureLint suite.
- **Web tests run under happy-dom:** no CSS cascade, no layout — never assert rendered
  geometry. Pin load-bearing CSS by reading the `.module.css` source, resolved via
  `import.meta.dirname` (never `process.cwd()` — hooks and CI run from the repo root).
- **THREE.Object3D has ONE parent:** cached Object3D resources are cloned per consumer
  (`src/resources/useResource.ts`); identity-equality is only for textures/materials.
- **Tests:** happy path + error path + edge case per public method, co-located with
  the implementation. TypeScript strict: prefix intentionally-unused params with `_`.
- **Self-registration:** new features register themselves on import — never edit central
  files beyond the documented aggregation imports. Keep the web previewer and the VS Code
  extension at feature parity through the shared core.
- **Shared dependencies** are pnpm catalog entries (`pnpm-workspace.yaml`); reference
  them as `"catalog:"` in package.json.
- **Logging:** verbose `logger.info` with `[Category]` prefixes is welcome in core code —
  host apps filter levels; keep `error`/`warn` for real problems.
- **Comments:** only non-obvious information (constraints, tricky algorithms, security
  notes); no issue/WI references in code; let types and names do the documenting.
- **Implement completely:** no placeholder comments, stubs, or TODOs. Do every
  numbered item in the task, including doc-only edits no test will catch.
- **Commits:** conventional-commit style, technical, no AI-attribution lines.
