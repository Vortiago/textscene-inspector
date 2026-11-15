# Every shadowed PointLight2D samples the polar map with renderer_rd's taps

- Status: Accepted
- Supersedes: ADR-0030's gate, its tap kernel and its texture state. ADR-0030's CPU map build
  and its `shadow_color` split stay.
- Related: `r3f/lighting2d/shadowMap/shadowShader.ts`, `r3f/lighting2d/shadowMap/shadowSampling.ts`,
  `r3f/lighting2d/shadowMap/shadowPolarMap.ts`, `nodes/2d/pointlight2d/`.

## Context

ADR-0030 sent a NONE light through stencilled shadow volumes, whose edge is the exact
geometric ray. It sent a PCF5 or PCF13 light through the polar map with the GLES3 tap on a
half-float map behind `LinearFilter`.

The Godot reference renderer is renderer_rd (Vulkan). It reads every filter from one map:

- NONE floors `tex_ofs` to its bin and steps against that one bin (`canvas.glsl:507-510`). The
  edge is a staircase of bins, which widens with distance from the light.
- PCF5 and PCF13 average 5 or 13 taps of `texture_shadow` (`canvas.glsl:511-535`). Each tap
  floors to bin i, reads bins i−1 and i, and mixes their steps by the fraction past the floor
  (`canvas.glsl:392-399`).
- The floor takes the canvas-wide bin, `1 / rendering/2d/shadow_atlas/size`
  (`renderer_canvas_render_rd.cpp:727`). The PCF tap offset takes the light's
  `(1 + shadow_filter_smooth) / size` (`:629`).
- The atlas is `R32_SFLOAT` (`:975-980`) behind a nearest sampler that repeats on u
  (`:1930-1934`).

Measured with `pnpm ref:diff` on the base of #1243: the dungeon's candle lights (NONE) drew 423
pixels more than 5/255 from Godot, and its PCF5 lights 390. The PCF goldens were 4064 to 5951
pixels more than 1/255 apart.

## Decision

**Every shadowed PointLight2D builds the polar map and reads it per fragment with
renderer_rd's taps.** The stencil path, its volumes and its stencil buffer are gone.

- `shadowShader.ts` holds the taps once, and `shadowSampleGlsl` joins them with the bin rule of
  each light kind, since the maps differ only past their ends: the point map wraps, and the
  directional map clamps and reads an empty bin as lit.
- A map holds `rendering/2d/shadow_atlas/size` bins, 2048 by default. The project setting
  reaches the CPU build and the texture, and the shader reads the bin count from the texture's
  width, so the two cannot disagree.
- The point map is float32, nearest and repeating on u. A half float rounds the stored depth,
  and a fragment on the occluder line then reads as shadowed where Godot lights it.

## Consequences

- A NONE edge far from its light is a staircase of bins, as in Godot. The goldens
  `unit-pointlight2d-shadow-none-bins` and `-pcf5-bins` pin it.
- A NONE light now pays the map build and one tap per fragment. The pass draws no volume mesh
  and allocates no stencil buffer.
