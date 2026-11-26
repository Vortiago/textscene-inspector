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
- A raw read takes the stored depth from the atlas's colour, which holds it as two bytes. It filters four texels as a linear sampler does. A hardware filter of the two bytes is not used: a GPU that filters 8-bit channels at 8 bits, as software GL does, loses the low byte and draws seams in the transmittance.
- `readStoredDepth` hooks the translator's texture calls, so the template's text is not changed.

## Consequences

- The colour holds 16 bits of depth, as Godot's default 16-bit atlas does. The depth texture holds 24.
- Each program binds one more texture, the atlas's colour.
- A raw read costs four texel loads, where Godot's costs one sample. A compare costs one sample, as in Godot.
