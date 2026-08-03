---
type: Node
category: Other
status: linter-only
visual: false
renders_as: nothing — a non-spatial base node
---

# Node

The base of every Godot node. A plain `Node` has no transform and no visual of its
own; the previewer mounts it as an empty group and draws nothing. Its role is to
parent other nodes, which render on their own.

## Divergences

None — a `Node` draws nothing in either engine. That absence is the useful fact.

## Linting

<!-- lint:begin Node -->
Strict parsing format-checks these `Node` properties. Every validator failure is an **error**.

| Property | Accepts |
| --- | --- |
| `auto_translate_mode` | enum 0-2 (AUTO_TRANSLATE_MODE_INHERIT/AUTO_TRANSLATE_MODE_ALWAYS/AUTO_TRANSLATE_MODE_DISABLED) |
| `editor_description` | quoted string |
| `physics_interpolation_mode` | enum 0-2 (PHYSICS_INTERPOLATION_MODE_INHERIT/PHYSICS_INTERPOLATION_MODE_ON/PHYSICS_INTERPOLATION_MODE_OFF) |
| `process_mode` | enum 0-4 (PROCESS_MODE_INHERIT/PROCESS_MODE_PAUSABLE/PROCESS_MODE_WHEN_PAUSED/PROCESS_MODE_ALWAYS/PROCESS_MODE_DISABLED) |
| `process_physics_priority` | integer |
| `process_priority` | integer |
| `process_thread_group` | enum 0-2 (PROCESS_THREAD_GROUP_INHERIT/PROCESS_THREAD_GROUP_MAIN_THREAD/PROCESS_THREAD_GROUP_SUB_THREAD) |
| `process_thread_group_order` | integer |
| `process_thread_messages` | integer >= 0 |
| `unique_name_in_owner` | true or false |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
<!-- lint:end -->

There is no registered validator here, so nothing for the lenient parser to
diverge from. Its `parser.ts` nonetheless reads a `transform` property the
same way Node3D does: absent, it stays `undefined`; malformed, it warns and
falls back to the identity `Transform3D`. A plain `Node` never carries this
key in an authored `.tscn`, so in practice the fallback is unreachable.
