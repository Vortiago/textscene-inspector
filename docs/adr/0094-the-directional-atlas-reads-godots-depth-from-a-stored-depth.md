# The directional atlas reads Godot's depth from a stored depth

- Status: Accepted.
- Related: ADR-0076 (Godot's shaders run through one transpiler), ADR-0093 (a program's storage buffers share one row texture).

## Context

Godot's scene shader reads its directional shadow atlas in two ways. A compare reads it through a shadow sampler. The soft shadow's blocker search and the transmittance read the raw depth through a linear sampler (`scene_forward_lights_inc.glsl:381-424`, `scene_forward_clustered.glsl:2539-2585`). WebGL 2 cannot read one depth texture both compared and raw.

The depth in the atlas also runs the other way. Godot's depth is 1 at the near side of a split box and 0 at the far side. three's depth is 0 at its near plane and 1 at its far plane.

## Decision

**The template reads Godot's depth, and each read of the atlas maps it to the depth three stores.**

- Each split box's near plane is Godot's near side, `range_begin` (`renderer_scene_cull.cpp:2349`). So Godot's depth is `g = 1 - t`, where `t` is the stored depth.
- The depth draw flattens a caster nearer the light than the box to `g = 0.9999`, as Godot's depth pass does for a positive pancake size (`scene_forward_clustered.glsl:679-682`). The cull reaches 1e6 units past the near side (`renderer_scene_cull.cpp:2322`).
- `shadow_matrix1` to `4` give `g`. A compare reads the depth texture with the reference `t = 1 - g`.
- A raw read takes the stored depth from the atlas's colour, which holds it as two bytes. A GPU that filters each channel in floating point mixes the two bytes of four texels exactly, so the read takes one linear sample, as Godot's does. A GPU that rounds each filtered channel to 8 bits, as llvmpipe does, loses the low byte and draws seams in the transmittance. There the read filters four texels by hand. A probe renders one pixel per renderer to tell the two apart (`twoByteFilterProbe.ts`).
- `readStoredDepth` hooks the translator's texture calls, so the template's text is not changed.

## Consequences

- The colour and the depth texture hold 16 bits of depth, as Godot's default atlas does (`rendering_server.cpp:3708`). A project that sets `directional_shadow/16_bits` to false still gets 16 bits.
- Each program binds one more texture, the atlas's colour.
- A raw read costs one sample on a GPU that filters in floating point, as in Godot, and four texel loads on one that does not. On a desktop GPU the four loads cost the soft shadow scene about 23 ms of its 30 ms scene draw. A compare costs one sample, as in Godot.
