# AnimatedSprite2D frame playback is a transport driver, not an autonomous loop

AnimatedSprite2D plays a `SpriteFrames` flipbook. We drive it the same way as the **AnimationPlayer** and **GLB animation driver**, as a selection-driven **Animation transport** driver (ADR-0012, ADR-0014). By default it shows the authored `frame` **statically**. Only when its tree row is selected does the Animation dock list its clips and let the user play, pause and scrub. Playback maps the transport playhead to a frame index (`frameAtTime`). Unlike the other two drivers it owns no `THREE.AnimationMixer`. It swaps the quad's texture, so it reads `playState` and `time` directly and reports time back for the scrubber.

We reject an **autonomous loop** (the first implementation, which played every multi-frame sprite on load). This previewer mirrors the Godot **editor**. Its 2D viewport shows an AnimatedSprite2D's current frame statically and previews animation only in the SpriteFrames panel, with its own play controls. Always-looping matched neither the editor nor Godot's *runtime*, which plays only when `autoplay` is set or a script calls `play()`. It also broke the one-driver-at-a-time, starts-stopped, user-initiated model the other two drivers already share, and made every sprite-bearing scene non-deterministic.

## Considered options

- **Reuse `usePlaybackLoop`.** Rejected: that hook is bound to a `THREE.AnimationMixer` plus `AnimationAction` interpolating TRS, whereas sprite playback advances a discrete frame index and swaps a texture. AnimatedSprite2D instead reads the transport state in its own `useFrame` and computes `frameAtTime(time)`. No mixer, no shared loop.
- **Respect Godot's `autoplay` as auto-start.** Rejected for parity with the other drivers: the transport always starts STOPPED and pre-selects the authored `animation` in the clip dropdown. Play is user-initiated.

## Consequences

- A third transport driver type alongside AnimationPlayer (ADR-0011, ADR-0012) and the GLB driver (ADR-0014). The Animation tab now appears for a selected AnimatedSprite2D too.
- The scrubber is **time-based** (0 to clip duration in seconds, matching the other drivers). Godot's SpriteFrames panel is frame-indexed. A frame-indexed scrubber for sprites is deferred.
- The default (stopped) render is the static authored frame, so it is byte-stable (the autonomous version was not). Sprite-playback fixtures still stay out of the visual-regression manifest while playing.
