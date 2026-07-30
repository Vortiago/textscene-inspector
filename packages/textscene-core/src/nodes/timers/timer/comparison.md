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

Timer counts down and emits `timeout` — a logic node with no runtime visual. The
previewer draws nothing for it, reusing the base Node component with zero geometry.
Both images therefore show only the empty editor preview environment: a sky gradient
fading into the ground, with no object anywhere, since the fixture's sole child is the
invisible `RespawnTimer`.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `wait_time` | `1.5` | none — countdown duration has no visual |
| `autostart` | `true` | none — starting the timer has no visual |
| `one_shot` | `true` | none — single-fire behaviour has no visual |

## Divergences

None visible in this fixture.

## Linting

<!-- lint:begin Timer -->
Strict parsing format-checks these `Timer` properties. Every validator failure is an **error**.

| Property |
| --- |
| `autostart` |
| `ignore_time_scale` |
| `one_shot` |
| `paused` |
| `process_callback` |
| `wait_time` |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
<!-- lint:end -->

Every property here goes through the `parseOptional*` family rather than the
warn-then-fallback `*Or` helpers, and none of them substitutes strict's
defaults. `wait_time` (`parseOptionalFloat`) and `process_callback`
(`parseOptionalInt`) resolve to `undefined`, silently and with no warning,
whenever the value is absent or fails to parse. `autostart`/`one_shot`/
`paused`/`ignore_time_scale` (`parseOptionalBool`) only go `undefined` when
the key is absent; a present-but-invalid value (anything other than the
literal string `'true'`) silently resolves to `false` instead, since
`parseOptionalBool` has no unparseable case, unlike its int/float
counterparts. `process_callback` is read as a bare int with no enum check, so
a value outside strict's `0`/`1` membership (e.g. `99`) parses through
unrejected. Since Timer draws nothing, none of this has a render-time effect;
it only changes what a consumer reading the parsed node sees.
