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
- A raw read takes the stored depth from the atlas's colour, in one of three reads:
  - `sampled`: the colour is RG8 and holds the depth as two bytes. A GPU that filters each channel in floating point mixes the two bytes of four texels exactly, so the read takes one linear sample, as Godot's does.
  - `float`: a GPU that rounds each filtered channel to 8 bits loses the low byte and draws seams in the transmittance. Where it filters R32F (`OES_texture_float_linear`) and draws into it (`EXT_color_buffer_float`), the colour is R32F and holds the 16-bit depth as a float. The read takes one linear sample.
  - `fetched`: a GPU that does neither keeps the RG8 colour, and the read filters four texels by hand.
- A probe renders one pixel on the first renderer of the page to pick the read (`twoByteFilterProbe.ts`, `storedDepthRead.ts`). The colour format, the sun's depth draw and every program follow it. `?storedDepthRead=sampled`, `float` or `fetched` forces one read on any GPU, and `pnpm ref:diff --stored-depth-read` and a golden per read pass it on.
- Spot and area lights keep the RG8 colour in their own atlas.
- `readStoredDepth` hooks the translator's texture calls, so the template's text is not changed.

### How each format filters

`node scripts/gl-filter-precision/run.mjs` takes linear samples between two texels and gives the worst error in 16-bit depth steps. The pair 255 and 256 tests the low byte.

| Colour format | SwiftShader (the goldens) | lavapipe (`pnpm ref:diff`) |
| --- | --- | --- |
| RG8, two bytes | 0.004, the 8-bit filter weight of any GPU | 128.5: the filter rounds each channel to 8 bits |
| R16F | 0.75: a half float has 11 bits | 0.75 |
| R32F, with `OES_texture_float_linear` | 0 | 0 |
| R16, with `EXT_texture_norm16` | no extension | 0 |

No format WebGL 2 filters without an extension mixes 16-bit depths exactly on both. A depth texture filters only as a compare, and WebGL 2 has no `textureGather`. R32F is exact on both and costs one sample, but it needs the extensions and twice the colour memory. So the float read serves a GPU that rounds bytes, and the hand filter stays for a GPU without the extensions.

## Consequences

- The colour and the depth texture hold 16 bits of depth, as Godot's default atlas does (`rendering_server.cpp:3708`). A project that sets `directional_shadow/16_bits` to false still gets 16 bits (#1661).
- Each program binds one more texture, the atlas's colour.
- A raw read costs one sample, as in Godot, on a GPU that filters bytes in floating point or filters R32F. Only a GPU with neither pays four texel loads. On SwiftShader the sampled and fetched reads differ by 35 px, at most 1/255. On lavapipe the float read draws the fetched read's pixels against Godot 4.6.3, within 1 px, on the soft golden and 14 sun scenes. A compare costs one sample, as in Godot.
- The float colour of Godot's default 4096 atlas takes 64 MB, 32 MB more than RG8.
