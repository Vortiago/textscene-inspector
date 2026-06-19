# AnimatedSprite2D frame playback is a transport driver, not an autonomous loop

AnimatedSprite2D plays a `SpriteFrames` flipbook. We drive it the same way as the **AnimationPlayer** and **GLB animation driver** — as a selection-driven **Animation transport** driver (ADR-0012, ADR-0014): by default it shows the authored `frame` **statically**, and only when its tree row is selected does the Animation dock list its clips and let the user play/pause/scrub. Playback maps the transport playhead to a frame index (`frameAtTime`); unlike the other two drivers it owns no `THREE.AnimationMixer` — it swaps the quad's texture, so it reads `playState`/`time` directly and reports time back for the scrubber.

We reject an **autonomous loop** (the first implementation, which played every multi-frame sprite on load). This previewer mirrors the Godot **editor**, whose 2D viewport shows an AnimatedSprite2D's current frame statically and previews animation only in the SpriteFrames panel (with its own play controls); always-looping matched neither the editor nor Godot's *runtime* (which plays only when `autoplay` is set or a script calls `play()`). It also broke the one-driver-at-a-time, starts-stopped, user-initiated model the other two drivers already share, and made every sprite-bearing scene non-deterministic.

## Considered options

- **Reuse `usePlaybackLoop`.** Rejected: that hook is bound to a `THREE.AnimationMixer` + `AnimationAction` interpolating TRS; sprite playback advances a discrete frame index and swaps a texture. AnimatedSprite2D instead reads the transport state in its own `useFrame` and computes `frameAtTime(time)` — no mixer, no shared loop.
- **Respect Godot's `autoplay` as auto-start.** Rejected for parity with the other drivers: the transport always starts STOPPED and pre-selects the authored `animation` in the clip dropdown; play is user-initiated.

## Consequences

- A third transport driver type alongside AnimationPlayer (ADR-0011/0012) and the GLB driver (ADR-0014); the Animation tab now appears for a selected AnimatedSprite2D too.
- The scrubber is **time-based** (0…clip duration in seconds, matching the other drivers). Godot's SpriteFrames panel is frame-indexed; a frame-indexed scrubber for sprites is deferred.
- The default (stopped) render is the static authored frame, so it is byte-stable again (the autonomous version was not) — sprite-playback fixtures still stay out of the visual-regression manifest while playing.
