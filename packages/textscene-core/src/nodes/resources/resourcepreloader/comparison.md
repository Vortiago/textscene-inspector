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

A resource cache: it holds named references so they load with the scene instead of on first use, and draws nothing itself. The previewer renders it as a transform-only group (ADR-0008): its children still show, and that absence is the whole story.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `resources` | `[PackedStringArray("blank", "icon"), [SubResource("Resource_1"), ExtResource("1_tex")]]` | preloads two named resources; nothing is drawn |

## Divergences

None visible in this fixture.

## Linting

<!-- lint:begin ResourcePreloader -->
Strict parsing format-checks these `ResourcePreloader` properties, plus 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `resources` | [PackedStringArray(names...), [SubResource/ExtResource, …]] with matching, non-null entries | error |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
<!-- lint:end -->

`parser.ts` reuses the plain `parseNode` reader, which never looks at
`resources` at all — whether it is well-formed, has mismatched name/resource
counts, or carries a null entry, the lenient parser carries it as inert text
and nothing about the rendered scene changes.
