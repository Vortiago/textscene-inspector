# AnimationPlayer drives sprite-sheet `frame` tracks via a push registry, not the mixer

A Godot `value` track targeting `Sprite2D:frame` (a sprite-sheet flipbook) is the dominant way 2D characters and coins animate, but it can't go through the `THREE.AnimationMixer`: the mixer binds object **transforms** only (ADR-0011 chose the mixer and explicitly deferred a "central animation-value" path for every other property). So the active **AnimationPlayer** samples its selected clip's `frame` tracks at the **live mixer playhead** (`action.time`) and *pushes* the value to the target sprite through a stable, ref-backed **AnimatedFrame registry** (`AnimatedFrameContext`), keyed by the target's resolved node path. Each `Sprite2D` registers a frame setter under its node path and overrides its displayed `frame` while a value is pushed; the player releases the targets (pushes `null`) on stop, deselect, or unmount.

This is the scoped version of the value-push ADR-0011 deferred — a narrow push for the one property whose demand justifies it, **not** the rejected "compute every value each frame and push it into every animatable component." Imperative pushes keep it cheap: the registry's context value is stable, so a push never re-renders consumers — only the target sprite's own setter re-renders, and only when its frame actually changes.

## Considered options

- **Bind a custom `frame` property on the sprite's THREE object for the mixer to drive.** Rejected: R3F does not react to non-React property mutations, and the frame → UV window is React state; the mixer write wouldn't repaint.
- **A global animated-value React context updated with `setState` each frame.** Rejected: a per-frame `setState` on a tree-wide context is a re-render storm. A ref-backed registry with per-target setters (functional-bail) confines re-renders to the sprite whose frame changed.

## Consequences

- The time source is the **live `action.time`** (advanced by `usePlaybackLoop` earlier in the same frame), not the React-state `transport.time` — the latter lags the `useFrame` closure by a frame inside the test renderer's advance loop (and is a frame stale at runtime).
- Sampling is **stepped** (discrete): a `frame` holds until the next keyframe, matching Godot's discrete value tracks.
- The registry generalises: other discrete properties (`modulate`, `visible`) and `Sprite3D` can ride the same push path later; only `frame` on `Sprite2D` is wired today.
- A clip whose only track is `frame` builds an *empty* mixer clip (no transform tracks); the action still advances `action.time` over the clip length, so the playhead the sampler reads is valid.
