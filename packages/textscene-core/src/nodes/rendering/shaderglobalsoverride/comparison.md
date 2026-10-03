---
type: ShaderGlobalsOverride
category: Other
status: unimplemented
fixture: unit-shader-globals-override.tscn
# image: unit-shader-globals-override
visual: false
renders_as: nothing yet, Godot re-shades every material that reads the overridden globals, the previewer does not
---

# ShaderGlobalsOverride

Overrides the project's global shader parameters while it stays in the tree. Godot applies the override to every material that reads those globals, and the previewer does not yet (ADR-0045): its children still show, and no material sees the override.

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

## Known limitations

- **Needs runtime** Godot overrides the global shader parameters each `params/*` key names, so every material that reads one changes. Here no material sees the override.
