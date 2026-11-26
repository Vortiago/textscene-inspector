# The directional atlas reads Godot's depth from a stored depth

- Status: Accepted.
- Related: ADR-0076 (Godot's shaders run through one transpiler), ADR-0093 (a program's storage buffers share one row texture).

## Context

Godot's scene shader reads its directional shadow atlas in two ways. A compare reads it through a shadow sampler. The soft shadow's blocker search and the transmittance read the raw depth through a linear sampler (`scene_forward_lights_inc.glsl:381-424`, `scene_forward_clustered.glsl:2539-2585`). WebGL 2 cannot read one depth texture both compared and raw.

The depth in the atlas also differs from Godot's. Godot's depth is 1 at the near side of a split box and 0 at the far side, and the depth pass flattens a caster nearer the light onto the near side (`scene_forward_clustered.glsl:679-682`). three draws the depth 0 at its near plane, which the previewer moves the caster reach past Godot's near side.

## Decision

**The template reads Godot's depth, and each read of the atlas maps it to the depth three stores.**

- `shadow_matrix1` to `4` give Godot's depth `g = c * (1 - t)`, where `t` is the stored depth and `c` is the split box's own depth range divided by Godot's.
- A compare reads the depth texture with the reference `t = 1 - g / c`.
- A raw read takes the stored depth from the atlas's colour, which holds it as two bytes. It filters four texels as a linear sampler does, and clamps `g` to Godot's flattened depth, 0.9999.
- A read finds its split's `c` from the cell of the lights' grid that its UV falls in (`light_storage.cpp:2577-2597`), and then from the quadrant or half of the split.
- `readStoredDepth` hooks the translator's texture calls, so the template's text is not changed.

## Consequences

- The colour holds 16 bits of depth, where the depth texture holds 24. A raw read is coarser than a compare.
- Each program binds one more texture, the atlas's colour, and a grid size and two uniform arrays for its layout.
- When the depth pass flattens casters as Godot does, `c` becomes 1 and the map is `g = 1 - t`.
