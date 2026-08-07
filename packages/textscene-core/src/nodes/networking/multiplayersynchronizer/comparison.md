---
type: MultiplayerSynchronizer
category: Other
status: linter-only
fixture: unit-multiplayer-synchronizer.tscn
# image: unit-multiplayer-synchronizer
visual: false
renders_as: nothing (a transform-only group)
---

# MultiplayerSynchronizer

This node synchronizes properties from the multiplayer authority to remote peers and draws nothing, so the previewer renders it as a transform-only group (ADR-0008): its children still show, and that absence is the whole story.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `root_path` | `NodePath("SyncTarget")` | none — no visual effect |
| `replication_interval` | `0.1` | none — no visual effect |
| `delta_interval` | `0.05` | none — no visual effect |
| `replication_config` | `SubResource("SceneReplicationConfig_1")` | none — no visual effect |
| `visibility_update_mode` | `1` | none — no visual effect |
| `public_visibility` | `true` | none — no visual effect |

## Divergences

None visible in this fixture.

## Linting

<!-- lint:begin MultiplayerSynchronizer -->
Strict parsing format-checks these `MultiplayerSynchronizer` properties, plus 10 inherited from Node. Every validator failure is an **error**.

| Property | Accepts |
| --- | --- |
| `delta_interval` | float 0-5 |
| `public_visibility` | true or false |
| `replication_config` | SubResource("id") or ExtResource("id") |
| `replication_interval` | float 0-5 |
| `root_path` | NodePath("path/to/node") |
| `visibility_update_mode` | enum 0-2 (VISIBILITY_PROCESS_IDLE/VISIBILITY_PROCESS_PHYSICS/VISIBILITY_PROCESS_NONE) |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-multiplayersynchronizer-root-path` | `multiplayersynchronizer-root-path-dangling` | warning |
<!-- lint:end -->

`parser.ts` reuses the base `parseNode`, which reads only `transform`/`name`/`parent`/
`instance`/`index` — none of MultiplayerSynchronizer's own properties. A malformed
`replication_interval` like `"abc"` is never read by the lenient path at all, so it has
no fallback value to report: the node still renders as the same empty transform group
the strict parser would accept.
