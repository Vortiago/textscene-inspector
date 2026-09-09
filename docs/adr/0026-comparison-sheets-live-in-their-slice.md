# ADR-0026: Comparison sheets live in their slice, and their reference content is generated

## Status

Accepted.

## Context

The Godot-parity corpus lived in a flat `docs/comparison/sheets/` tree, 79
hand-authored Markdown files assembled by `build-gallery.mjs` into a browsable
gallery, alongside 170 synthetic "Not implemented" cards derived from
`node-catalog.json`. Four problems had accumulated:

1. **The sheets sat apart from the code they describe.** Every other artefact of a
   node type is co-located in its slice (ADR-0001). The sheet was the exception,
   and an author updating `parser.ts` had to remember a file in another tree.
2. **Cross-sheet duplication.** One explanation of 2D tonemapping was reworded
   across five sheets, and `RemoteTransform2D`/`RemoteTransform3D` shared four
   verbatim passages. Each restatement was a place to drift.
3. **No external references.** Not one sheet linked to Godot's class reference or
   to the engine source, so verifying a claim meant searching by hand.
4. **Nothing described the linter.** At the time of this decision the repo shipped
   41 registered rules reporting under 211 distinct rule names, across 62
   validator-bearing node types. The parity corpus said nothing about any of it,
   and nothing recorded what the lenient parser does with a value strict rejects.

## Decision

**A sheet is slice content.** It moves to `<slice>/comparison.md`, beside the
`parser.ts` and `linterParser.ts` it documents. The `complex-*` whole-scene
showcases belong to no slice and stay in `docs/comparison/sheets/`.
`build-gallery.mjs` and `recapture.mjs` walk both roots through one shared module.

**Reference content is generated, never hand-written.** Three kinds:

- **Godot docs and source links**, as fields on `node-catalog.json`. The docs URL
  is derived from the class name. The source path is not derivable, so it is
  resolved (filename, ancestor chain, directory sweep, curated override) and then
  **verified by fetching the header and matching its `GDCLASS` macro**. An
  unverified class ships with no link and a loud error, because a wrong link is
  worse than a missing one.
- **The `## Linting` block** in each sheet, from the live registries, plus
  `lint-coverage.json` for the unsupported nodes. Written by
  `pnpm docs:lint-sections`, verified in CI by `--check`.
- **ADR citations**, linked by the gallery from plain `ADR-0025` text.

**A shared cause is written once.** `docs/comparison/README.md` holds the
explanations that span sheets. A sheet reports its own measured pixels and points
there.

**A rule declares what it reports.** `RuleMeta` gains
`emits: ReadonlyArray<{ ruleName, severity }>`, because `meta.name` is the registry
key while the names users see and suppress are string literals inside `check`.
`valid-camera2d-properties` reports under five of them. `ruleCoverage.test.ts`
holds the declaration to the source.

## Consequences

Sheets are found where the code is, and `pnpm new:node` scaffolds one. The
inherited validator set is summarised as a count per base type rather than listed.
Listing 31 inherited `Node3D` rows on every light sheet would recreate the
duplication this removes. The full set lives on the base type's own sheet.

Editing inside the lint markers is destroyed on the next generator run and fails
CI. Hand-written prose goes below them.

Two consequences worth naming:

- **`AreaLight3D` is absent from the pinned Godot 4.6.3 ClassDB but present in
  current `stable`.** Links are deliberately unpinned (`stable` / `master`). It is carried in the
  catalog's `extras` array and self-heals into `nodes` when the local Godot lists it. Its parity captures cannot have come from the pinned
  engine's class list, so its comparison story differs in kind from every other
  sheet.
- **`@textscene/core`'s `dist/` is not loadable by plain Node ESM.** Its sources
  use extensionless relative specifiers under `moduleResolution: "Bundler"`, which
  `tsc --build` emits verbatim. Bundlers resolve them, Node does not, and
  `publint` passes regardless. `scripts/compare-docs/loadCoreLinter.mjs` registers
  a resolve hook that retries with `.js`.

## Alternatives considered

**Leave the sheets in a flat tree and fix only the content.** Rejected. It keeps
the one artefact that ignores the slice convention, and the co-location is what
makes the lenient-parser prose cheap to write and to verify.

**Scrape rule names statically instead of declaring `emits`.** Rejected, though
the guard shipped alongside this does scrape. The two are not the same job. A
scrape can enumerate names, but the `rangeAdvisories` tables and the physics
factories build theirs by interpolation in another file. Attributing a name to
the rule that reports it needs an import-closure walk and template matching. That
is affordable in a test. It is not something the generator can do, and it yields
nothing at runtime. `emits` is the declaration the registry serves live, and the
scrape's job is only to keep it honest.

**Summarise the 170 unsupported nodes in prose.** Rejected. The generated Godot
docs link is the summary, and it cannot rot.
