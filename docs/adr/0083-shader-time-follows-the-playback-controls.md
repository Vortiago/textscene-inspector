# Shader time follows the playback controls

- Status: Accepted.
- Related: ADR-0072 (Godot's shaders are one module that imports only three), ADR-0076 (Godot's shaders run through one transpiler).

## Context

`TIME` is the shader time in seconds. Godot adds the frame's step to it before each frame draws, in a double, and wraps it at the project setting `rendering/limits/time/time_rollover_secs`, 3600 by default (`renderer_compositor_rd.cpp:108`, `rasterizer_gles3.cpp:97`, `rendering_server.cpp:3700`). Godot's `TIME` never stops: an AnimationPlayer that pauses or seeks leaves it alone.

The previewer shows a scene with playback controls: play, pause, stop and a playhead the user drags. A shader that moves while the animation is paused shows a frame that the user cannot hold, step or compare with Godot's.

## Decision

**`ShaderClock` keeps Godot's sum and wrap. In the previewer, `PlaybackShaderTime` moves the clock with the playback controls, where Godot's keeps running.**

- `ShaderClock.advance(step)` adds the step and wraps it with `%`, which is Godot's `Math::fmod` for doubles. `set(seconds)` wraps a value in the same way. The caller gives the rollover, which is the project's setting.
- `PlaybackShaderTime.frame(playback, step)` gives `TIME` for one frame:
  - Play advances the clock by the step.
  - Pause holds it.
  - A seek sets it to the playhead. The controls count each seek, so a seek to the playhead it is at sets it too.
  - Stop sets it to 0.
  - A scene with no AnimationPlayer has no controls, so the clock advances every frame, as Godot's does.
- A plain three.js app calls `ShaderClock` itself and writes its `time` to the material, as `writeSkyBindings` takes it.
- The port lives in `shaders/time/shaderClock.ts`.

## Consequences

- In a scene with an AnimationPlayer, `TIME` differs from Godot's while the animation is paused, stopped or sought. During play it advances as Godot's does, from the value it had.
- A paused frame stays still, so a screenshot of the previewer is repeatable.
- The sky value check compares `TIME` with Godot at 0, at 4/3 s and past the rollover. It runs Godot with `--fixed-fps` and the physics jitter fix off, because the jitter fix shortens some steps to meet the physics ticks. The previewer's steps come from its own frames, so the check feeds both clocks the same steps.
