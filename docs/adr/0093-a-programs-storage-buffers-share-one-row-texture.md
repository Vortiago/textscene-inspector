# A program's storage buffers share one row texture

- Status: Accepted.
- Related: ADR-0076 (Godot's shaders run through one transpiler), ADR-0088 (a specialisation constant folds into its own program).

## Context

Godot's scene shaders read storage buffers: `buffer` blocks such as the omni and spot lights, the reflection probes, the lightmaps and the decals (`scene_forward_clustered_inc.glsl:193-250`). Godot binds each one through a Vulkan descriptor set. WebGL 2 has no storage buffers, so the translator reads each block from an integer texture. WebGL 2 guarantees 16 samplers in a fragment stage. A texture for each block cost the lit colour pass 6 of the 16.

## Decision

**Every storage buffer of a program is one region of one `RGBA32UI` texture, `RowStore`, read with `texelFetch`.**

- A row holds 1,024 texels of four 32-bit words. A region starts at the row in its `firstRow` int uniform, and the store moves the regions after a region that grows.
- The stages of one program share the store, so a block that both stages declare is one region.
- A draw that writes its own words uploads the whole texture before it draws, because three uploads a texture only after a draw of another material.

## Consequences

- The lit colour pass reads 11 fragment samplers, with 1 for every storage buffer. `litFit.test.ts` counts them against 16.
- A region that grows rebuilds the texture, as three allocates a texture's storage once.
- A per-draw write uploads every region, not only the drawn one.
