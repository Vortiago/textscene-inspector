---
type: Timer
category: Other
status: linter-only
fixture: unit-timer.tscn
image: unit-timer
visual: false
renders_as: nothing (a countdown timer node)
---

# Timer

Counts down and emits `timeout`, a logic node with no runtime visual. The previewer draws nothing for it, so both images show only the empty preview environment.

## Linting

<!-- lint:begin Timer -->
Strict parsing format-checks these `Timer` properties, plus 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `autostart` | true or false |  |
| `ignore_time_scale` | true or false |  |
| `one_shot` | true or false |  |
| `paused` | true or false |  |
| `process_callback` | enum 0-1 (PHYSICS/IDLE) | warning |
| `wait_time` | float >= 0.001 | error at or below 0, warning below 0.001 |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-timer-wait-time` | `timer-low-wait-time` | warning |
<!-- lint:end -->

Every property reads through the `parseOptional*` family, which substitutes no default. `wait_time` and `process_callback` resolve to `undefined` when absent or unparseable, and the four flags resolve to `false` for anything but the literal `true`. `process_callback` is read as a bare int with no enum check.
