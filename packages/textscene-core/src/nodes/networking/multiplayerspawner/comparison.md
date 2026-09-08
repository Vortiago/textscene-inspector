---
type: MultiplayerSpawner
category: Other
status: linter-only
fixture: unit-multiplayer-spawner.tscn
# image: unit-multiplayer-spawner
visual: false
renders_as: nothing (a transform-only group)
---

# MultiplayerSpawner

This node replicates spawned nodes from the multiplayer authority to peers and draws nothing, so the previewer renders it as a transform-only group (ADR-0008): its children still show, and that absence is the whole story.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `_spawnable_scenes` | `PackedStringArray("res://enemy.tscn")` | none — no visual effect |
| `spawn_path` | `NodePath("SpawnRoot")` | none — no visual effect |
| `spawn_limit` | `8` | none — no visual effect |

## Divergences

None visible in this fixture.

## Linting

<!-- lint:begin MultiplayerSpawner -->
Strict parsing format-checks these `MultiplayerSpawner` properties, plus 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `_spawnable_scenes` | string array (PackedStringArray(…), Array[String]([…]) or […]) |  |
| `spawn_limit` | integer >= 0 | warning below |
| `spawn_path` | NodePath("path/to/node") |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-multiplayerspawner-spawn-path` | `multiplayerspawner-spawn-path-dangling` | warning |
<!-- lint:end -->

`index.ts` registers the base `parseNode`, which reads only `transform`/`name`/`parent`/
`instance`/`index` — none of MultiplayerSpawner's own properties. A malformed
`spawn_limit` like `"abc"` is never read by the lenient path at all, so it has no
fallback value to report: the node still renders as the same empty transform group
the strict parser would accept.
