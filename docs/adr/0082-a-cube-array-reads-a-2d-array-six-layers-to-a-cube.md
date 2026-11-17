# A cube array reads a 2D array, six layers to a cube

- Status: Accepted.
- Related: ADR-0076 (Godot's shaders run through one transpiler), ADR-0081 (a sampler reads its own copy of the material texture).

## Context

Godot's `samplerCubeArray` reads a `CubemapArray`. WebGL 2 has no cube array texture, and three r187 has no cube array sampler. Godot measures on Mesa lavapipe, which samples a cube array with Vulkan's seamless cube rules: a filter footprint past a face edge reads the next face, and a footprint at a cube corner gives the corner texel's weight to the three other texels (`lp_bld_sample_soa.c:1559`).

## Decision

**A `samplerCubeArray` reads a `DataArrayTexture` with six layers to a cube, in Godot's face order +x, -x, +y, -y, +z, -z. Each read is a TSL composite of texel loads, `CubeArrayReadNode`, that ports Vulkan's cube sampling as lavapipe runs it.**

- The node picks the face with Vulkan's face table, and the cube with the layer rounded half to even and clamped to the cubes the texture holds.
- The level comes from the call, or from the derivatives of the direction in texels of the face, with the bias. A filter without `_mipmap` reads level 0. A filter with it blends two levels, or reads the nearest level where the sampler's mipmap filter is nearest.
- A linear filter reads four texels. A texel past a face edge is read on the next face. At a cube corner, the three other texels share the corner texel's weight.
- The node reads the filter of the texture bound when three builds the program, as `IntegerReadNode` does.
- `textureSize(samplerCubeArray, int)` gives GLSL's `ivec3(width, height, cubes)`, though Godot declares an `ivec2`. Godot writes the call through, so GLSL's type rules decide each use. `glslTypes.ts` follows the `ivec3` through swizzles, constructors, operators and calls, and refuses each use that GLSL refuses.
- The port lives in `shaders/language/cubeArray.ts`, `cubeFaces.ts`, `textureQueries.ts`, `textureSize.ts` and `glslTypes.ts`.

## Consequences

- A cube array read equals Godot's bits, except where lavapipe blends with a fused multiply-add. GLSL ES 3.00 has no `fma`, so those lanes differ by 1 ULP. `knownProbeDifferences.mjs` lists them with Mesa's lines.
- A read costs up to eight texel loads for two levels, where a native cube array costs one sample.
- An anisotropic filter reads a cube array without anisotropy (#1970).
- WebGPU has a cube array texture, and the composite is untested there (#1788).
