# The frame profile times render steps in segments

- Status: Accepted
- Related: ADR-0006 (the viewport mode and its Display toggles), ADR-0033 (sub-viewport passes).

## Context

A slow preview needs a number per render step: how long the shadow pass, the volumetric fog or the
compositor takes, on the CPU and on the GPU. The steps nest. The fog's prepare runs inside the
shadow pass, the shadow pass inside a scene draw, and a scene draw inside a sub-viewport pass or the
compositor. WebGL 2 runs one `TIME_ELAPSED_EXT` query at a time, so nested GPU queries are not
possible. A measurement must also cost nothing while nobody looks at it.

## Decision

The Display menu has a Performance toggle, off by default and persisted like Grid. While it is on,
each top-level canvas runs a frame profile (`r3f/frameProfile/`) and the overlay shows its latest
window.

- Each call site marks its step with `beginStep` and `endStep`. With no profile on the renderer, a
  marker is one `WeakMap` lookup and records nothing. The scene-draw and compositor markers mount
  only while the toggle is on.
- The profile splits the frame into segments at each marker. A segment's time belongs to the
  innermost open step, so each step reports its own time and the steps sum to the frame.
- Each segment is one GPU timer query (`EXT_disjoint_timer_query_webgl2`). The results arrive some
  frames later, and a disjoint flag drops every frame in flight. Without the extension, the overlay
  shows CPU time only.
- A step that runs again inside itself counts as one run, and a render with no light times no
  Shadows step, so the fog's own passes do not multiply the counts.
- A render through the canvas's camera at the frame's top level, or in the compositor, is the Scene
  draw. A render inside another step belongs to that step.

## Consequences

A step's CPU time is the time to submit its commands, and its GPU time is the time to run them.
A step that the GPU bounds shows a small CPU time and a large GPU time.

Per-fragment fog and lighting run inside the materials, so their cost shows in Scene draw, not in
Fog. The Fog step times the fog's own passes, which a static scene skips once its volume settles.

The timer queries add a little GPU work per segment while the profile runs.
