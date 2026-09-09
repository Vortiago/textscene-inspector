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

Replicates spawned nodes from the multiplayer authority to peers and draws nothing. The previewer renders it as a transform-only group (ADR-0008) and its children still show.

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

`index.ts` registers the base `parseNode`, which reads only the heading attributes and `transform`. A malformed `spawn_limit` is never read on the lenient path, so there is no fallback to report.
