---
type: ShaderGlobalsOverride
category: Other
status: linter-only
fixture: unit-shader-globals-override.tscn
# image: unit-shader-globals-override
visual: false
renders_as: nothing (a transform-only group)
---

# ShaderGlobalsOverride

Overrides the project's global shader parameters while it stays in the tree. It has no geometry to draw, so the previewer renders it as a transform-only group (ADR-0008) and its children still show.

## Linting

<!-- lint:begin ShaderGlobalsOverride -->
Strict parsing format-checks these `ShaderGlobalsOverride` properties, plus 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `params/*` | any Variant — the type lives in project.godot, not the .tscn |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-shaderglobalsoverride-properties` | `shaderglobalsoverride-multiple-in-scene` | warning |
<!-- lint:end -->

`index.ts` registers the plain `parseNode` reader, which never looks at a `params/*` key. Every value is carried as inert text, since nothing here propagates global shader parameters into a THREE material.
