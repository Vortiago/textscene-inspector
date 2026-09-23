---
name: implement-feature
description: Implement a feature in the TextScene previewer end-to-end, either a Godot node type or a material, mesh or resource feature or property. Use when adding, contract-authoring, or reviewing any such feature so it lands complete.
---

# Implementing a feature completely

A feature is done only when **every layer** lands. A half-feature parses but renders through
`GenericNodeFallback` because a barrel is not imported, or it renders but nothing lints,
documents or shows it. **Green unit tests do not mean complete**: several layers have no unit
guard (see Guards). Walk the whole checklist. Mark each layer done, or not applicable with the
reason. Never skip one without a word.

**Identify the shape first.** The wiring differs, and a wrong shape is the main cause of
forgotten layers.

- **Node type** (`[node type="X"]`): self-registering through three barrels. Scaffold it with
  `pnpm new:node <Type> <category> --intent <draws|transform-only|pending>
  [--base node3d|node2d|node|control] [--linter]` (`scripts/new-node-slice.mjs`). It generates
  the slice and a fixture and wires the barrels. `NODE_BASE_TYPES` is derived from the node
  catalog, and `<Type>` is checked against it. `--intent draws` is the shape for a node you are
  about to render. The scaffold does not write the semantic `linter.ts`, docs or goldens.
- **Material, mesh or resource** (`[sub_resource type="X"]`, or a StandardMaterial3D property):
  a **Resource slice** under `resources/<category>/<type>/`, self-registering through
  `registerResourceSlice` (ADR-0031). There is no scaffolder. Mirror a sibling slice.

Mirror a reference implementation: `resources/materials/standardmaterial3d/emission.ts` for a
material property, or a recent node (`git log`). Broad monorepo orientation lives in the
`textscene-dev` skill. This skill is the per-feature layer checklist.

## Universal layers (every feature, both shapes)

- **Parse**: `parser.ts` (node) or `decode.ts` (resource slice). Use the canonical value parsers
  (`parser/valueParsers.ts`, `utils/colorParser.ts`, `utils/transform.ts`), never an ad-hoc
  `parseFloat`. Parse once into `types.ts`. Render, inspector and linter read the parsed numbers
  and never re-parse a raw string. Done when `parser.test.ts` (or `decode.test.ts`) covers happy,
  malformed-fallback and missing-optional.
- **Pinned red contract**: `nodes/_contracts/<type>-contract.test.ts(x)` for a node, or
  `resources/materials/standardmaterial3d/scalars.<feature>.test.ts` for a material scalar.
  Assert acceptance through public APIs: registry lookup, typed parser output, the right three.js
  object renders, the linter passes the fixture.
- **Render**: see the shape section.
- **Component test**: `Component.test.tsx`, or `Component.material-features.test.tsx` for a
  MeshInstance3D material feature, through `@react-three/test-renderer`, asserting the real
  rendered `material.*` or object. **Render is gateable. Never skip it as "visual-only".**
- **Fixture**: `scenes/fixtures/unit-<kebab-type>.tscn`, a real parseable scene. Then regenerate
  the web catalog with `pnpm generate:fixtures`, which rewrites the auto-generated
  `apps/textscene-web/src/fixtures.ts`. If the fixture's filename prefix maps to no category, add
  a branch to `detectCategory()` in `scripts/generate-fixtures.js`.
- **Docs** and **golden**: conditional, see below.

## Node-type layers (self-registering)

- `Component.tsx`: the R3F component. Gizmos and helpers live inside it. There is no gizmo
  registry.
- `index.ts`: `nodeRegistry.register({ typeName, parser, propertyFormatter? })`.
- `index.r3f.ts`: `nodeComponentRegistry.register({ typeName, Component })`.
- **The three barrels.** The folder registers nothing unless imported. `parser/TscnParser.ts`
  imports `<slice>/index.js`. `r3f/nodes/index.ts` imports `index.r3f`. `linter/index.ts` imports
  `index.linter.js` (if linted). `pnpm new:node` wires these.
- **Linter, two sub-layers. Do not collapse them.** (a) Format validators: `linterParser.ts`
  calls `validatorRegistry.registerAll('Type', {...})` (scaffolded by `--linter`). (b) Semantic
  rules: `linter.ts` registers with `ruleRegistry`, plus `linter.test.ts`. Not scaffolded.
  Gotcha: the generated `index.linter.ts` imports only `./linterParser.js`. Adding a `linter.ts`
  also needs `import './linter.js'`, or the rule never registers.
- `propertyFormatter.ts` (optional): inspector display for non-obvious props. Wire through
  `index.ts`.
- Scene-tree badge (optional polish): `TYPE_BADGE_CLASS` and `TYPE_SHORTHAND` in
  `r3f/components/SceneTreeViewer/TreeNode.tsx` (there is a default).

## Material / mesh / resource layers (self-registering)

Resource types register through `registerResourceSlice` (ADR-0031). Nothing below is a central
switch.

- **StandardMaterial3D property**: all in `resources/materials/standardmaterial3d/`. Decode it in
  `decode.ts` into `types.ts`, and map it to three's vocabulary in `scalars.ts`. Both appliers
  read that output: `r3f/materials/StandardMaterialSlot.tsx` (reactive JSX) and `build.ts`
  (imperative, for an external `.tres`). Find the native three.js analogue before writing a
  shader: clearcoat is `MeshPhysicalMaterial.clearcoat`, rim is `MeshPhysicalMaterial.sheen`,
  heightmap is `displacementScale` plus `displacementMap`. When the analogue exists only on
  MeshPhysical, render `<meshPhysicalMaterial>` while the feature is active and keep
  `<meshStandardMaterial>` otherwise. That leaves the common path and its tests untouched. A new
  texture slot goes in two lists: `TEXTURE_SLOTS` in the slice's `types.ts` and
  `TEXTURE_PROPERTIES` in `nodes/3d/meshinstance3d/meshTextureSlots.ts`. **Lint**: validators for
  material properties are declared on `BaseMaterial3D`, the class Godot declares them on. They
  live in `resources/materials/basematerial3d/<group>.ts` (`features.ts`, `pbr.ts`, `surface.ts`,
  `uv.ts`, `render.ts`, `stencil.ts`), written with the `v` combinators and the `material.cpp`
  line cited beside each bound. Scalars get hint-tier warnings, not only the `_enabled` booleans.
- **Mesh primitive**: a slice under `resources/meshes/<type>/` with `decode.ts`, `build.ts` and an
  `index.ts` calling `registerMeshSlice`, imported from `resources/sliceRegistrations.ts`. Add a
  `BUILDERS` entry in `nodes/3d/meshinstance3d/primitiveMeshGeometry.ts`, so MeshInstance3D and
  CSGMesh3D share one construction. QuadMesh builds through PlaneMesh's geometry.
- **Resource type**: `resources/<category>/<type>/` with `index.ts` (`registerResourceSlice`:
  type names, extensions, bus tag, failure label), `decode.ts`, `build.ts` where THREE
  construction exists, `types.ts`, and a registration test. Import the `index.ts` from
  `resources/sliceRegistrations.ts`. Validators, where the type has them, live in a
  `linterValidators.ts` imported directly from `linter/index.ts`. A foreign format
  (`resources/formats/`) declares its real parser instead of `decode.ts`.

## Guards: what fails if you forget a layer, and the gap

Conformance guards catch most forgotten layers: `linter/barrelCompleteness.test.ts` (linter
barrel wiring), `parser/parserBarrelCompleteness.test.ts` (parser barrel wiring),
`linter/ruleCoverage.test.ts` (rule registered), `core/registrationCollision.test.ts` (duplicate
typeName), `nodes/_contracts/fixture-coverage.test.ts` (dropped fixture),
`resources/resourceSliceConformance.test.ts` (resource slice shape and barrel). **The gap: the
render barrel `r3f/nodes/index.ts` has no completeness guard.** Miss that import and the node
renders through `GenericNodeFallback` with green unit tests. `scripts/compare-docs/sheets.test.mjs`
reads the slice's own `index.r3f.ts`, not the barrel, so it does not see it either. Only the
visual golden or a manual run catches it, so verify that barrel by hand. Nothing sizes a test
suite either. A co-located `parser.test.ts` holding one empty `it` is invisible to every guard above,
so suite thoroughness is a `/code-review` question.

## Docs (the most-forgotten layer)

Landing complete updates `README.md` (the node count, which `sheets.test.mjs` pins against the
catalog, and the "What it renders" table) and the node's `comparison.md` in its slice. Fill its
Divergences or Known limitations when the Godot-to-three.js mapping is lossy, and cite the exact
render line. Only when relevant: `CONTEXT.md` (a new domain term, not per feature),
`docs/adr/NNNN-*.md` (an architectural decision).

## Golden image (conditional)

Only for a deterministic WebGL render: no 2D DOM overlays, and it must settle to two
byte-identical frames (policy in `scripts/visual/scenes.mjs`). Add a `GOLDEN_SCENES` entry, run
`pnpm test:visual:update`, eyeball, and commit `scripts/visual/baselines/<name>.png`. Material
scalars piggyback on the `material-features` golden. Skip non-deterministic nodes (Label3D,
AnimationPlayer).

## Gate

Local `core` gate: `pnpm type-check && pnpm type-check:tests && pnpm lint && pnpm test:unit`. CI (all required, PR to
main): `build` (lint, type-check, test:unit, build, bundle-size, package), `visual-regression` (a
separate job: a new golden with no baseline fails here, not in the core gate),
`integration-tests` (VS Code end-to-end, see the `e2e-testing` skill), `vsix-verification`.
