---
type: ResourcePreloader
category: Other
status: linter-only
fixture: unit-resource-preloader.tscn
# image: unit-resource-preloader
visual: false
renders_as: nothing (a transform-only group)
---

# ResourcePreloader

A resource cache that holds named references so they load with the scene. It draws nothing itself, so the previewer renders it as a transform-only group (ADR-0008) and its children still show.

## Linting

<!-- lint:begin ResourcePreloader -->
Strict parsing format-checks these `ResourcePreloader` properties, plus 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `resources` | [PackedStringArray(names...), [SubResource/ExtResource, …]] with matching, non-null entries |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
<!-- lint:end -->

`index.ts` registers the plain `parseNode` reader, which never looks at `resources`. A mismatched name count or a null entry is carried as inert text, and nothing about the rendered scene changes.
