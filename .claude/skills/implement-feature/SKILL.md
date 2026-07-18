---
name: implement-feature
description: Implement a feature in the TextScene previewer end-to-end — a Godot node type OR a material/mesh/resource feature/property. Use when adding, contract-authoring, or reviewing any such feature so it lands complete.
---

# Implementing a feature completely

A feature is done only when **every layer** lands. The recurring failure is a **half-feature** —
the parse works but the node renders a gray placeholder (a barrel was never imported), or a property
renders but nothing lints, documents, or shows it. **Green unit tests do NOT mean complete**: several
layers have no unit guard (see Guards). Walk the whole checklist; each layer is either done or
explicitly N/A-because-X — never silently skipped.

**Identify the SHAPE first — the wiring differs fundamentally and is the #1 source of forgotten layers:**

- **Node type** (`[node type="X"]`) → **self-registering** via three barrels. Scaffold it:
  `pnpm new:node <Type> <category> [--linter]` (`scripts/new-node-slice.mjs`) generates the slice + a
  fixture and wires the three barrels. It does NOT do: semantic `linter.ts`, docs, goldens, or the
  material/mesh shape.
- **Material / mesh / resource** (`[sub_resource type="X"]`, or a StandardMaterial3D property) →
  **central dispatch**: hand-edit a switch. No self-registration, no scaffolder.

Mirror a reference implementation: `emission` (material property) or a recent node (`git log`). Broad
monorepo orientation lives in the `textscene-dev` skill; this skill is the per-feature layer checklist.

## Universal layers (every feature, both shapes)

- **Parse** → `parser.ts` (node) or `resources/<kind>/<type>/parser.ts`. Use the canonical value parsers
  (`parser/valueParsers.ts`, `utils/colorParser.ts`, `utils/transform.ts`), never ad-hoc `parseFloat`.
  Parse once into `types.ts`; render / inspector / linter read the parsed numbers, never re-parse a raw
  string. Done: `parser.test.ts` covers happy / malformed-fallback / missing-optional.
- **Pinned RED contract** (this repo's experiment flow) → `nodes/_contracts/<type>-contract.test.ts`, or
  `standardMaterialScalars.<feat>.test.ts` for a material scalar. Assert acceptance through public APIs
  (registry lookup, typed parser output, the right three.js object renders, linter passes the fixture).
- **Render** → see the shape section.
- **Component test** → `Component.test.tsx` / `Component.material-features.test.tsx` via
  `@react-three/test-renderer`, asserting the real rendered `material.*` / object. **Render IS gateable —
  never skip it as "visual-only."**
- **Fixture** → `scenes/fixtures/unit-<kebab-type>.tscn`, a real parseable scene, then **regenerate the web
  catalog: `pnpm generate:fixtures`** (rewrites the AUTO-GENERATED `apps/textscene-web/src/fixtures.ts`). If
  the fixture's filename prefix maps to no category, add a branch to `detectCategory()` in
  `scripts/generate-fixtures.js`.
- **Docs** + **golden** — conditional, see below.

## Node-type layers (self-registering)

- `Component.tsx` — the R3F component (gizmos/helpers live inside it; there is no gizmo registry).
- `index.ts` → `nodeRegistry.register({ typeName, parser, propertyFormatter? })`.
- `index.r3f.ts` → `nodeComponentRegistry.register({ typeName, Component })`.
- **The three barrels** (the import-side-effect gotcha — the folder registers nothing unless imported):
  `parser/TscnParser.ts` imports `<slice>/index.js`; `r3f/nodes/index.ts` imports `index.r3f`;
  `linter/index.ts` imports `index.linter.js` (if linted). `pnpm new:node` wires these.
- **Linter — two sub-layers, do not collapse:** (a) **format validators** — `linterParser.ts` →
  `validatorRegistry.registerAll('Type', {...})` (scaffolded by `--linter`); (b) **semantic rules** —
  `linter.ts` → `ruleRegistry` (+ `linter.test.ts`), NOT scaffolded. Gotcha: the generated `index.linter.ts`
  imports only `./linterParser.js`; adding a `linter.ts` also needs `import './linter.js'`, or the rule
  silently never registers.
- `propertyFormatter.ts` (optional) — inspector display for non-obvious props; wire via `index.ts`.
- Scene-tree badge (optional polish) — `TreeNode.tsx` `TYPE_BADGE_CLASS` / `TYPE_SHORTHAND` (has a default).

## Material / mesh / resource layers (central dispatch, hand-edited — no self-registration)

- **StandardMaterial3D scalar/property**: parse in `r3f/materials/standardMaterialScalars.ts` + apply in
  `StandardMaterialSlot.tsx`. Find the **native three.js analog** before writing a shader
  (clearcoat→`MeshPhysicalMaterial.clearcoat`, rim→`MeshPhysicalMaterial.sheen`,
  heightmap→`displacementScale`+`displacementMap`); an analog on MeshPhysical only → render
  `<meshPhysicalMaterial>` when active, else keep `<meshStandardMaterial>` so the common path (and its
  tests) are untouched. A texture also needs a `Component.tsx` `TEXTURE_PROPERTIES` slot. **Lint**: add
  `<feat>_enabled: validateBoolean` (+ any `<feat>_texture: validateExtResource`) to
  `linterValidators.ts` (mirror `emission`; scalar values are not validated).
- **Mesh primitive**: edit BOTH switches in `nodes/3d/meshinstance3d/meshGeometry.tsx` (`parseByType` + the JSX).
- **Resource type**: `resources/<kind>/<type>/` (parser/types/renderer/linterValidators), wired by DIRECT
  import — add the validators import to `linter/index.ts`; a material parser/renderer is lazily imported in
  `resources/processing/materialProcessing.ts`.

## Guards — what goes RED if you forget a layer (and the gap)

Meta-guards catch most forgotten layers: `linter/barrelCompleteness.test.ts` (linter barrel wiring),
`linter/ruleCoverage.test.ts` (rule registered + tested), `core/registrationCollision.test.ts` (dup
typeName), `nodes/_contracts/*-coverage*.test.ts` (dropped fixture / thin suite). **THE GAP: the render/parse
barrels (`TscnParser.ts`, `r3f/nodes/index.ts`) have no completeness guard** — miss the `r3f/nodes/index.ts`
import and the node renders a gray placeholder with green unit tests; only the visual golden or a manual run
catches it. Verify these two barrels by hand.

## Docs (the most-forgotten layer)

Landing complete updates: `README.md` (the node count + bullet list — a guard checks the count),
`CHANGELOG.md` (`## [Unreleased]`), `docs/PARITY-LIMITATIONS.md` (if the Godot→three.js mapping is lossy —
cite the exact render line). Only when relevant: `CONTEXT.md` (a NEW domain term, not per feature),
`docs/adr/NNNN-*.md` (an architectural decision).

## Golden image (conditional)

Only for a deterministic WebGL render (no 2D DOM overlays; must settle to two byte-identical frames — policy
in `scripts/visual/scenes.mjs`). Add a `GOLDEN_SCENES` entry, run `pnpm test:visual:update`, eyeball, commit
`scripts/visual/baselines/<name>.png`. Material scalars piggyback on the `material-features` golden; skip
non-deterministic nodes (Label3D, AnimationPlayer).

## Gate

Local `core` gate: `pnpm type-check && pnpm lint && pnpm test:unit`. CI (all required, PR→main): `build`
(lint / type-check / test:unit / build / bundle-size / package), `visual-regression` (a SEPARATE job — a new
golden with no baseline fails here, not in the core gate), `integration-tests` (VS Code E2E — see the
`e2e-testing` skill), `vsix-verification`.
