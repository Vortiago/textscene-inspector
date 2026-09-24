# AnimatedSprite2D frame playback is a transport driver, not an autonomous loop

AnimatedSprite2D plays a `SpriteFrames` flipbook. It is a selection-driven **Animation transport** driver, like the **AnimationPlayer** and the **GLB animation driver** (ADR-0012, ADR-0014). By default it shows the authored `frame` **statically**. Only when its tree row is selected does the Animation dock list its clips and let the user play, pause and scrub. Playback maps the transport playhead to a frame index (`frameAtTime`). Unlike the other two drivers it owns no `THREE.AnimationMixer`. It swaps the texture of the quad, so it reads `playState` and `time` directly and reports time back for the scrubber.

Rejected: an **autonomous loop** that plays every multi-frame sprite on load. This previewer mirrors the Godot **editor**. Its 2D viewport shows the current frame of an AnimatedSprite2D statically and previews animation only in the SpriteFrames panel, with its own play controls. An autonomous loop matches neither the editor nor Godot's *runtime*, which plays only when `autoplay` is set or a script calls `play()`. It also breaks the one-driver-at-a-time, starts-stopped, user-initiated model of the other two drivers, and makes every scene with a sprite non-deterministic.

## Considered options

- **Reuse `usePlaybackLoop`.** Rejected: that hook is bound to a `THREE.AnimationMixer` plus an `AnimationAction` that interpolates TRS, whereas sprite playback advances a discrete frame index and swaps a texture. AnimatedSprite2D reads the transport state in its own `useFrame` and computes `frameAtTime(time)`. No mixer, no shared loop.
- **Respect Godot's `autoplay` as auto-start.** Rejected for parity with the other drivers: the transport always starts stopped and pre-selects the authored `animation` in the clip dropdown. Play is user-initiated.

## Consequences

- A third transport driver type beside AnimationPlayer (ADR-0011, ADR-0012) and the GLB driver (ADR-0014). The Animation tab appears for a selected AnimatedSprite2D too.
- The scrubber is **time-based** (0 to the clip duration in seconds, like the other drivers). Godot's SpriteFrames panel is frame-indexed. A frame-indexed scrubber for sprites is deferred.
- The default (stopped) render is the static authored frame, so it is byte-stable. Sprite-playback fixtures stay out of the visual-regression manifest while they play.
