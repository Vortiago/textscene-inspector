---
type: RootMotionView
category: 3D
status: linter-only
fixture: unit-root-motion-view.tscn
# image: unit-root-motion-view
visual: false
renders_as: nothing (a transform-only group)
---

# RootMotionView

An editor-only helper that draws a fading grid under an [AnimationMixer] to visualise
root motion; the class docs say it "is only visible in the editor. It will be hidden
automatically in the running project," so drawing NOTHING at runtime is correct here,
not a gap — the previewer renders it as a transform-only group (ADR-0008): its children
still show, and that absence is the whole story.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `animation_path` | `NodePath("../Player")` | none at runtime — names the [AnimationMixer] the editor-only grid would track |
| `color` | `Color(0.2, 0.6, 0.9, 1)` | none at runtime — the editor-only grid's colour |
| `cell_size` | `2.0` | none at runtime — the editor-only grid's cell size in 3D units |
| `radius` | `8.0` | none at runtime — how far the editor-only grid extends before fading out |
| `zero_y` | `false` | none at runtime — whether the editor-only grid's points keep their original Y |

## Divergences

None visible in this fixture — there is nothing to render in either image.

## Linting

<!-- lint:begin RootMotionView -->
Strict parsing format-checks these `RootMotionView` properties, plus 1 inherited from VisualInstance3D, 17 inherited from Node3D, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `animation_path` | NodePath("path/to/node") |  |
| `cell_size` | float >= 0.1 | warning below |
| `color` | Color(r, g, b, a) |  |
| `radius` | float >= 0.1 | warning below |
| `zero_y` | true or false |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error |
<!-- lint:end -->

`parser.ts` reuses `parseNode3D`, which reads only `transform` and `visible` — it
never looks at `animation_path`, `color`, `cell_size`, `radius`, or `zero_y` at all.
So a malformed value on any of those five (`cell_size = "banana"`, an unquoted
`animation_path`, …) parses with no error and no substitution: the lenient parser
never reaches the property to reject or fall back on it, because nothing downstream
of it reads that key. Strict is stricter here on every one of the five.
