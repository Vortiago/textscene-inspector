# The render wait

The Godot capture harness saves a 3D, 2D or root picture only after `_await_rendered` in
`run.mjs` sees nothing pending. Godot signals none of the pending work, so the wait reads what
each kind changes. It returns when the picture and the pending counters have held still for
`RENDER_QUIET_FRAMES` frames in a row. A scene that never settles is captured as it stands, with a
warning on stderr. The longest wait is `RENDER_WAIT_MAX_FRAMES`.

## What is pending

**Pipeline compilation.** Godot compiles a material's pipeline in the background and draws the
ubershader until it lands (`render_forward_clustered.cpp:509-514`). The ubershader culls with
`gl_FrontFacing` (`scene_forward_clustered.glsl:3010-3016`), which is true for a point, so a
cull-front point is missing from a capture taken too early. Nothing counts the compilations that
finish, only the ones queued (`pipeline_hash_map_rd.h:114-116`,
`rendering_server_default.cpp:307-317`). The wait sums the five queued-compilation counters.

**Texture loading.** `load()` returns a finished resource, so every texture the scene names is read
before the first draw (`resource_loader.cpp:541`). Godot 4.6.3 streams none in afterwards. A texture
made later, such as a viewport's target, moves `RENDERING_INFO_TEXTURE_MEM_USED`
(`renderer_rd/storage_rd/utilities.cpp:303-304`). Godot refreshes that value every frame
(`rendering_server_default.cpp:205`).

**Temporal volumetric fog.** The fog mixes `temporal_reprojection_amount` of a history that starts
black (`volumetric_fog_process.glsl:683`, `fog.cpp:482`). It jitters each frame by `frame % 16`
(`fog.cpp:1113`). The picture must repeat the one a jitter cycle earlier, so the wait compares each
picture with the one `FOG_JITTER_CYCLE_FRAMES` frames back.

**Anything else.** Any other change shows in the picture, which must repeat the one before it.

## The time scale

A paused tree gives the wait frames no simulated time, but a shader's `TIME` advances by the frame
step the main loop hands the renderer (`main.cpp:4841,4990-4994`). A sprite that sways a pixel in
30 ms would then decide the picture, so the wait sets `Engine.time_scale` to 0. The process quits
after it saves the picture, so nothing restores the scale.

An unpaused tree (`--no-previews`) runs its physics on, so only a fog history draws on there.

## The quiet window

At 12 frames, the seven point materials of the `point-mesh` fixture had not all landed their
pipelines. A frame takes about 50 ms under lavapipe, and 30 frames is two and a half times that
measure.
