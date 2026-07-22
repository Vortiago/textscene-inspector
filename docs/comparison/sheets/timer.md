---
type: Timer
category: Other
fixture: unit-timer.tscn
image: unit-timer
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
