# ADR-0026: Comparison sheets live in their slice, and their reference content is generated

## Status

Accepted.

## Context

A flat `docs/comparison/sheets/` tree of hand-authored Markdown files, assembled by
`build-gallery.mjs` into a gallery beside synthetic "Not implemented" cards from
`node-catalog.json`, has four problems:

1. **The sheets sit apart from the code they describe.** Each other artefact of a node
   type is co-located in its slice (ADR-0001). An author who changes `parser.ts` must
   remember a file in another tree.
2. **Cross-sheet duplication.** One explanation restated across sheets (2D tonemapping,
   the passages `RemoteTransform2D` and `RemoteTransform3D` share) is one more place to
   drift.
3. **No external references.** A sheet without a link to Godot's class reference or the
   engine source makes each claim a manual search.
4. **Nothing describes the linter.** The parity corpus says nothing about the rules and
   validators, or about what the lenient parser does with a value strict rejects.

## Decision

**A sheet is slice content.** It lives in `<slice>/comparison.md`, beside the `parser.ts`
and `linterParser.ts` it documents. The `complex-*` whole-scene showcases belong to no
slice and stay in `docs/comparison/sheets/`. `build-gallery.mjs` and `recapture.mjs` walk
both roots through one shared module.

**Reference content is generated, never hand-written.** There are three kinds:

- **Godot docs and source links**, as fields on `node-catalog.json`. The docs URL is
  derived from the class name. The source path is not derivable, so it is resolved
  (filename, ancestor chain, directory sweep, curated override) and then **verified by
  fetching the header and matching its `GDCLASS` macro**. An unverified class ships with
  no link and a loud error, because a wrong link is worse than a missing one.
- **The `## Linting` block** in each sheet, from the live registries, plus
  `lint-coverage.json` for the unsupported nodes. `pnpm docs:lint-sections` writes it, and
  CI verifies it with `--check`.
- **ADR citations**, which the gallery links from plain `ADR-0025` text.

**A shared cause is written once.** `docs/comparison/README.md` holds the explanations
that span sheets. A sheet reports its own measured pixels and points there.

**A rule declares what it reports.** `RuleMeta` has
`emits: ReadonlyArray<{ ruleName, severity }>`, because `meta.name` is the registry key,
while the names users see and suppress are string literals inside `check`.
`valid-camera2d-properties` reports under five of them. `ruleCoverage.test.ts` holds the
declaration to the source.

## Consequences

Sheets are where the code is, and `pnpm new:node` scaffolds one. A sheet summarises the
inherited validator set as a count per base type, not a list. A list of the inherited
`Node3D` rows on each light sheet would bring back the duplication. The full set lives
on the base type's own sheet.

The next generator run destroys an edit inside the lint markers, and CI fails on it.
Hand-written prose goes below them.

Two more consequences:

- **`AreaLight3D` is absent from the pinned Godot 4.6.3 ClassDB but present in current
  `stable`.** Links are unpinned on purpose (`stable` / `master`). The catalog carries it
  in its `extras` array, and it moves into `nodes` when the local Godot lists it. Its
  parity captures cannot come from the pinned engine's class list, so its comparison
  differs in kind from each other sheet.
- **`@textscene/core`'s `dist/` is not loadable by plain Node ESM.** Its sources use
  extensionless relative specifiers under `moduleResolution: "Bundler"`, which
  `tsc --build` emits verbatim. Bundlers resolve them, Node does not, and `publint`
  passes regardless. `scripts/compare-docs/loadCoreLinter.mjs` registers a resolve hook
  that retries with `.js`.

## Alternatives considered

**Leave the sheets in a flat tree and fix only the content.** Rejected. It keeps the one
artefact that ignores the slice convention, and co-location is what makes the
lenient-parser prose cheap to write and to verify.

**Scrape rule names statically instead of declaring `emits`.** Rejected, though the guard
beside `emits` does scrape. The two do different jobs. A scrape can list names, but the
`rangeAdvisories` tables and the physics factories build theirs by interpolation in
another file. To attribute a name to the rule that reports it needs an import-closure
walk and template matching. A test can afford that. The generator cannot do it, and it
gives nothing at runtime. `emits` is the declaration the registry serves live, and the
scrape only keeps it honest.

**Summarise the unsupported nodes in prose.** Rejected. The generated Godot docs link is
the summary, and it cannot rot.
