# A sampler reads its own copy of the material texture

- Status: Accepted.
- Related: ADR-0072 (Godot's shaders are one module that imports only three), ADR-0076 (Godot's shaders run through one transpiler), ADR-0080 (a shader uniform reaches the GPU as its bits).

## Context

Godot keeps the filter and the repeat of a texture read on the sampler. The shader names them with a hint, or the shader type gives its default (`material_storage.cpp:2454`). One texture can be read by two samplers with two filters.

three r187 keeps the filter, the wrap, the anisotropy, the origin and the colour space on the `Texture`. The GLSL sampler type also follows the texture, so a `usampler2D` over an RGBA8 texture is declared as a `sampler2D`. three uploads only level 0 of a `DataArrayTexture` (`WebGLTextures.js:1229`) and of a `Data3DTexture` (`:1272`), and it has no sampler for a cube array.

## Decision

**Each sampler element reads a copy of the material's texture. The copy shares the texture's image, and holds the sampler's filter, wrap and anisotropy, Godot's top-left origin, and the sRGB view of a `source_color` sampler.**

- `set` takes a three `Texture`, a list of them or null, as `set_shader_parameter` takes a texture. The binding keeps one copy per texture while the texture lives.
- The node of a 2D array or a 3D texture copies each level after the first into its GL texture with `copyTextureToTexture`, before each draw that follows a new version of the texture. This holds for every format. A WebGL renderer only does this, and WebGPU is untested (#1788).
- An integer sampler over a texture of normalised or float texels reads each texel's float bits, as Godot's Vulkan driver (Mesa lavapipe) returns them. The texture call reads them back with `floatBitsToInt` or `floatBitsToUint`.
- A sampler array element at a computed index is a call on each element, picked by the index: GLSL ES 3.0 indexes a sampler array by a constant only.
- The port lives in `shaders/uniforms/samplerUniform.ts` and `shaders/language/textureCalls.ts`.

## Consequences

- A material texture can be read by two samplers with two filters, as in Godot.
- three keys a GL texture by the image and its sampler state (`WebGLTextures.js:588`). Two samplers with the same state share one GL texture, and each other state uploads the image once more.
- An integer read of a normalised texture is undefined in Vulkan. The port follows the driver Godot is measured on, and another Vulkan driver can return other values.
- The decision depends on three keeping sampler state on the texture. The texture probes of `pnpm test:shaders:gpu` fail if three moves it, and WebGPU is untested (#1788).
