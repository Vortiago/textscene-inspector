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

An editor-only helper that draws a fading grid under an AnimationMixer to visualise root motion. Godot hides it in the running project, so the previewer renders it as a transform-only group (ADR-0008) and its children still show.

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

`index.ts` registers `parseNode3D`, which reads only `transform` and `visible`. A malformed `cell_size = "banana"` or an unquoted `animation_path` parses with no error and no substitution, and only strict reports it.

## Known limitations

- **Editor only** The root-motion grid appears only in Godot's editor. Here it is absent.
