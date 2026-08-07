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

Overrides the project's global shader parameters for as long as it stays in the tree; it has no geometry of its own to draw. The previewer renders it as a transform-only group (ADR-0008): its children still show, and that absence is the whole story.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `params/fog_enabled` | `true` | overrides a bool-typed global shader parameter |
| `params/tint` | `Color(1, 0, 0, 1)` | overrides a Color-typed global shader parameter |

## Divergences

None visible in this fixture.

## Linting

<!-- lint:begin ShaderGlobalsOverride -->
Strict parsing format-checks these `ShaderGlobalsOverride` properties, plus 10 inherited from Node. Every validator failure is an **error**.

| Property | Accepts |
| --- | --- |
| `params/*` | any Variant — the type lives in project.godot, not the .tscn |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-shaderglobalsoverride-properties` | `shaderglobalsoverride-multiple-in-scene` | warning |
<!-- lint:end -->

`parser.ts` reuses the plain `parseNode` reader, which never looks at any
`params/*` key — every value, well-formed or not, is carried as inert text and
has no effect on what the previewer draws, since nothing here propagates a
project's global shader parameters into a THREE material in the first place.
