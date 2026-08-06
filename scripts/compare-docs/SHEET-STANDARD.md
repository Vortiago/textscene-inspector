# Comparison sheet standard

One sheet per Godot node type — or per resource type (StandardMaterial3D,
Environment, …), which sit under `category: Resources` in the left menu beside the
nodes — showing how this previewer renders it against real Godot. The **screenshots are produced by a script** (`scripts/compare-docs/capture.mjs`)
and committed under `docs/comparison/images/`. A sheet NEVER creates or edits an
image — it only references the two the script already made, by fixed path. Re-running
the capture script refreshes every screenshot without touching a single sheet.

A sheet is slice content: it documents the very `parser.ts` / `linterParser.ts`
beside it, so it lives **in the slice** as
`packages/textscene-core/src/nodes/<category>/<type>/comparison.md` (resources:
`src/resources/<...>/comparison.md`). The only exceptions are the `complex-*`
whole-scene showcases, which belong to no slice and stay at
`docs/comparison/sheets/<slug>.md`. A separate
generator (`scripts/compare-docs/build-gallery.mjs`) turns the whole folder plus the
images into one browsable HTML gallery — for previewing as an artifact and for the
website. So author plain, strict Markdown; styling is not your concern.

## The shape — exactly this, in this order, nothing extra

```markdown
---
type: OmniLight3D
category: 3D            # 3D | 2D | Resources | Other
status: unreviewed     # done | limitation | unimplemented | unreviewed (see Status)
fixture: unit-omni-light-3d.tscn
image: unit-omni-light-3d
renders_as: a THREE.PointLight    # one short noun phrase
---

# OmniLight3D

One or two sentences: what the node is, and what the previewer draws for it. Present
tense, no hedging, no three.js tutorial.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `light_energy` | `2.0` | brightness of the pool on the ground |
| `omni_range` | `8.0` | how far the light reaches |
| `shadow_enabled` | `true` | the box casts a shadow |

Only the properties the FIXTURE actually sets, with the value it sets and the visible
consequence. Read the fixture; never invent a property.

## Divergences

What differs between the two images, each with a cause. Report YOUR measured
pixels here; if the cause is one of the shared ones catalogued in
`docs/comparison/README.md`, name your numbers and point there rather than
restating the explanation.

If the two agree, write exactly one line:

    None visible in this fixture.

Never pad this section. An invented divergence is worse than an empty one.

## Linting

<!-- lint:begin OmniLight3D -->
Generated. Do not edit inside these markers.
<!-- lint:end -->

Below the marker, by hand: what the LENIENT parser does where strict rejects.
Name the property and the concrete fallback value.
```

## Sectioned sheets — one sheet, many per-property comparisons

A node or resource with several visually distinct features (a StandardMaterial3D
has metallic, emission, clearcoat, rim, …) gives each its OWN fixture and
comparison as a **section**. A section is a `##` heading immediately followed by a
`<!-- compare: … -->` marker; the generator lays out that section's Godot-vs-ours
pair, status badge, and prose (which runs until the next such heading).

```markdown
---
type: StandardMaterial3D
category: Resources        # 3D | 2D | Resources | Other
renders_as: a THREE.MeshStandardMaterial / MeshPhysicalMaterial
---

# StandardMaterial3D

Intro sentence(s) — the whole resource, above the per-feature sections.

## Metallic / roughness
<!-- compare: image=unit-material-metallic status=done fixture=unit-material-metallic.tscn -->

What the fixture sets and what the two images show; fold any limitation in here.

## Refraction
<!-- compare: image=unit-material-refraction status=limitation fixture=unit-material-refraction.tscn -->

…
```

- Marker attributes: `image=` (required — the basename), `status=` (see below),
  `fixture=` (optional — the live `?fixture=` deep link).
- A sectioned sheet needs NO top-level `image:` frontmatter; each section supplies
  its own. Legacy single-pair sheets (one `image:`, no markers) still work unchanged.

## Sections beyond the four

`## Known limitations` is an accepted optional fifth section, used by sheets whose
constraint is structural rather than visible in the capture. Put it last.

## What the generator supplies — never hand-write these

- **The Godot docs and source links** in the sheet header. Both are generated from
  `node-catalog.json` (`pnpm nodes:catalog`), and the source URL is verified
  against the engine's `GDCLASS` macro before it ships.
- **The `## Linting` block** between `<!-- lint:begin … -->` and
  `<!-- lint:end -->`, from the live linter registries (`pnpm docs:lint-sections`,
  checked in CI). Editing inside the markers is destroyed on the next run and
  fails the check. The hand-written lenient-parser prose goes BELOW `lint:end`.
- **ADR links.** Write `ADR-0025` as plain text; the generator links it. A relative
  path is wrong from a slice, wrong in the gallery, and broken on the deployed site.
- **Shared causes.** A divergence explained in `docs/comparison/README.md` (2D
  tonemapping, RemoteTransform relay limits) is written there once. Report your own
  measured pixels and point at it.

Two sheet kinds carry no `## Linting` block, and the sheets test asserts they have
no markers: the `complex-*` whole-scene showcases (no single node type), and the
`category: Resources` sheets (resources are validated through `resourceChecker`,
not the per-node registries the generator reads, so a generated block would lie).

## Status — never claim more than you have verified

Every section and every legacy sheet carries a parity status, shown as a nav dot
and a header/section badge. A node's badge **rolls up to its worst section**.

| Status | Meaning |
| --- | --- |
| `done` | Faithful to Godot, verified by eye. Green. **Never the default — earn it.** |
| `limitation` | Renders, but with a known divergence (a three.js constraint). Orange. |
| `unimplemented` | Not rendered at all. Red. |
| `unreviewed` | Not yet assessed against Godot. Grey. **The default.** |

`done` is the strong claim: reserve it for a feature you have looked at and found
matches. An unassessed sheet stays `unreviewed`; a whole-scene showcase with gaps is
`limitation`, not `done`. When in doubt, do not go green.

## Current state only — a sheet is not a changelog

A sheet describes how the previewer renders this type **right now**, against Godot.
It carries no history. The reader wants to know what the two images show today, not
how they got there.

Never write, in any form:

- **Fix narration** — "(FIXED)", "flagged here, fixed subsequently", "closed in a
  later pass", "not this component's to fix", "recorded as a follow-up".
- **Discovery narration** — "two bugs found while building this", "the point-fix
  exposed", "measured directly, it turned out that…", "my first attempt".
- **Before/after** — what a value used to be, what a previous implementation did,
  what a baseline encoded before it was corrected. Arbitration tables comparing an
  old render to a new one are history by definition.
- **Dates, commits, agent or packet names, issue or WI numbers.**

If a divergence is **open**, state the divergence in present tense with its measured
numbers. If it is **closed**, delete the row — a fixed divergence is simply not a
divergence, and leaving it "closed with numbers" is the changelog creeping back.

That history is not lost; it lives where history belongs — git, the ADRs, the issue.
A sheet that reads as a diary is stale the moment the code moves again, and it buries
the one thing it exists to say.

Applies to prose, headings and tables alike. A heading like
`## Auto-framing (two bugs found while building this)` is the same violation as the
sentence would be.

## Rules

- **Look at both images.** Read `docs/comparison/images/<image>-godot.png` and
  `-ours.png` with your own eyes. The prose and divergences must describe what is
  actually on screen. A sheet written from the code alone is worthless — that is the
  one thing only a viewer can do.
- **Terse.** This is a reference to skim, not an essay. No restating the code, no
  explaining what three.js is.
- **No visual of its own?** A Timer, a RemoteTransform, an AudioStreamPlayer draws
  nothing. Say so in one line under the heading and keep `## Divergences` short. That
  absence IS the useful fact.
- **Selection-gated gizmos** (Marker3D, Path3D, PathFollow3D — ADR-0018) and
  **toggle-gated** overlays (collision shapes — ADR-0005/0006) do not appear in a
  plain capture. Say the gizmo is gated, not missing.
- **Editor-only gizmos** (light bulbs, camera frustums) appear in neither image: the
  reference renders the game, not the editor. Never report their absence as a bug.
- **The frontmatter is load-bearing** — the generator reads it to place the images and
  group the sheet. `image` is the basename with no `-godot.png`/`-ours.png` suffix and
  no directory. Copy it from the task; do not derive it.
- Write only your own sheet. No AI-attribution lines, no TODOs, no placeholders.
