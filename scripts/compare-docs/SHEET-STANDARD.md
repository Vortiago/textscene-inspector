# Comparison sheet standard

One sheet per Godot node type, showing how this previewer renders it against real
Godot. The **screenshots are produced by a script** (`scripts/compare-docs/capture.mjs`)
and committed under `docs/comparison/images/`. A sheet NEVER creates or edits an
image — it only references the two the script already made, by fixed path. Re-running
the capture script refreshes every screenshot without touching a single sheet.

A sheet is a **Markdown file** at `docs/comparison/sheets/<slug>.md`. A separate
generator (`scripts/compare-docs/build-gallery.mjs`) turns the whole folder plus the
images into one browsable HTML gallery — for previewing as an artifact and for the
website. So author plain, strict Markdown; styling is not your concern.

## The shape — exactly this, in this order, nothing extra

```markdown
---
type: OmniLight3D
category: 3D            # 3D | 2D | Other
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

What differs between the two images, each with a cause. Link a limitation where one
covers it: `[PARITY-LIMITATIONS.md](../../PARITY-LIMITATIONS.md#omnilight3d--spotlight3d-distance-falloff)`.

If the two agree, write exactly one line:

    None visible in this fixture.

Never pad this section. An invented divergence is worse than an empty one.
```

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
