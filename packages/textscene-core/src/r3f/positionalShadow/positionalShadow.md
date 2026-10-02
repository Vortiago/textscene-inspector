# Positional shadow atlas

Every omni and spot shadow draws into one atlas texture, and every lit program samples it through
one sampler. It ports Godot 4.6.3's positional shadow atlas: the slot allocation
(`light_storage.cpp:2155-2522`), the spot shadow pass into its slot
(`render_forward_clustered.cpp:2712-2718`), the omni cube and its copy into two paraboloids
(`:2676-2695`, `:2722-2738`, `copy_effects.cpp:1082-1119`) and both lookups
(`scene_forward_lights_inc.glsl:310-379`, `:474-597`, `:776-847`).

## Who does what

- A light declares its shadow on `userData` through `positionalShadowUserData` (`declaration.ts`).
  OmniLight3D and SpotLight3D do this.
- `<PositionalShadowFitter>` and `usePositionalShadowFit` hook each render of a scene, as the
  directional fitter does (`../directionalShadow/directionalShadow.md`). Each render asks the atlas
  of the viewport that renders for slots, in Godot's order (`fitScenePositionalShadows.ts`).
- The first fit gives the light the shadow that draws into the atlas (`adoptAtlasShadow.ts`): an
  `AtlasSpotShadow` or an `AtlasOmniShadow`. The new shadow copies what the light's component set
  on the old one.
- `<PositionalShadowFitter>` also wraps the canvas renderer's shadow pass
  (`positionalShadowPass.ts`), which copies each omni cube into the atlas.
- `positionalShadowChunk.ts` replaces three's omni and spot lookups with Godot's
  (`positionalShadowLookup.ts`). It installs once at import of `TscnCanvas.tsx`, before any program
  compiles.

## The atlas texture

`shadowAtlasTarget.ts` holds one render target for every viewport. Each `ViewportShadowAtlas` holds
it at the side of its own atlas, and the target takes the largest side: 4096 for the root, and
2048 for a SubViewport by default. Each viewport lays its slots out from the texture's origin, in
texels, so a SubViewport's slots use the texture's lower-left quarter.

One texture serves every viewport because each render draws its own slots before it samples them.
three runs the shadow pass at the start of each `render` call (r186 `WebGLRenderer.js:1737`). So a
SubViewport pass draws its slots, samples them, and the main view then draws its own.

- The depth is 16-bit, as Godot's atlas stores it by default (`light_storage.cpp:2531-2533`).
- A linear filter compares it, as Godot's `shadow_sampler` does
  (`scene_shader_forward_clustered.cpp:995-1001`). Godot compares `GREATER` on its reversed depth,
  so here a receiver reads as lit only where it is strictly nearer than the caster: `Less`.
- three needs a colour attachment beside the depth, so the target carries one 8-bit channel.
- The depth texture answers a uniform clone with itself, so every material samples the one atlas
  (`UniformsUtils.js:28-41`).
- The last holder frees the target's GPU memory, and three builds it again at its next use.

## Spot shadows

An `AtlasSpotShadow` holds the atlas as its `map`. three builds a map only for a shadow that has
none (`WebGLShadowMap.js:203`), so it never builds one. Its `mapSize` is the slot, and its frame
extents are the atlas over the slot, so three asks for the atlas's own size and never resizes it.
Its one viewport is the slot.

three calls `updateMatrices` before it binds and clears the atlas for the light
(`WebGLShadowMap.js:291`, `:338-339`). The shadow then:

1. Turns its camera to the light's own axes, as Godot's spot camera takes the light's transform
   (`renderer_scene_cull.cpp:2582`). three aims at the target with the world's up, which rolls the
   slot's texels about the light's axis.
2. Builds its matrix with the slot's rectangle, so the lookup reads the slot, as Godot's
   `atlas_rect` places it (`scene_forward_lights_inc.glsl:846`).
3. Sets the atlas's scissor to the slot. three binds a target with its own scissor
   (`WebGLRenderer.js:3040-3071`), so the clear stays inside the slot.

## Omni shadows

Godot's default omni mode is Cube (`light_3d.cpp:647-650`). It renders a cube of half the slot per
face, and then copies the cube into two paraboloids in neighbouring slots
(`render_forward_clustered.cpp:2680`, `:2732-2734`). The second slot is the next one in the row, or
the first of the next row after a row's last slot (`light_storage.h:683-691`).

- three renders an `AtlasOmniShadow` into its own cube (`fitCube`). The copy reads the cube's depth
  at each texel, which a depth texture allows only unfiltered and uncompared, so the cube compares
  nothing and filters nothing. The copy filters the four nearest texels itself, as Godot's linear
  sampler does. A texel past a face's edge reads the neighbouring face.
- three gives the renderer no hook between its shadow pass and its draw. So
  `installPositionalShadowPass` wraps `renderer.shadowMap.render`: three's own pass, then each omni
  light's copy, before the draw uploads the lights (`WebGLRenderer.js:1737-1752`).
- `OmniShadowCopy` ports `cube_to_dp.glsl`. Each texel of a slot holds the distance to the light
  over its range, along the direction its paraboloid maps it to. The first slot holds the light's
  -Z half, and the second its +Z half. Godot's cube follows its own face convention, which its copy
  undoes by turning the lookup over in y. three's cube answers a world direction, so the copy turns
  the light's own direction into the world.
- A copy is a render of its own. It neither clears nor resets the frame's render info, and the
  pass restores the render target after the last copy.

The lookup reads the slot from the omni light's `pointShadowMatrix`. Its upper rows hold Godot's
world-to-light transform (`light_storage.cpp:989-991`). Its bottom row, which a light-space position
never needs, holds the first slot's corner and the step to the second, in units of the atlas
texture. three writes the matrix while it renders the cube (`WebGLShadowMap.js:320`), so the pass
writes it after the copy. three hands each light's own matrix to the lit programs by reference
(`WebGLLights.js:446`).

## The lookups

`positionalShadowLookup.ts` ports Godot's lookups:

- The receiver offsets: the normal bias in ten texels of the slot, scaled by how far the surface
  turns from the light, and the depth bias in Godot's units (`:483-489`, `:586-595`, `:780-787`).
- `sample_pcf_shadow` for a spot light: `soft_shadow_scale` atlas texels (`:310-335`, `:847`).
- `sample_omni_pcf_shadow` for an omni light, inside a paraboloid inset one texel per side. A tap
  that leaves the unit disc reads the other paraboloid (`:337-379`, `:476-478`).
- Godot's Soft Low kernel: four taps of `get_vogel_disk` (`renderer_scene_render_rd.cpp:45-55`,
  `:1157-1160`), as `godot/softShadowKernel.ts` computes them.
- The kernel's turn: `quick_hash` of the fragment's position (`:278-281`, `:343-350`). Vulkan counts
  `gl_FragCoord` rows from the top and WebGL from the bottom, so the lookups count from the top of
  the framebuffer the render draws into (`../shadowFilter/framebufferRows.ts`). The same pixel then
  takes the same turn as in Godot.

The kernel, its turn and the spot PCF are one GLSL block in `../shadowFilter/softShadowFilter.ts`,
which the directional lookup shares (`../directionalShadow/directionalShadow.md`).

## Texture units

WebGL 2 guarantees 16 texture units per program (`MAX_TEXTURE_IMAGE_UNITS`). Measured from the
active samplers of programs three r186 linked in the visual harness's Chromium, with every chunk
patch `TscnCanvas` installs and one shadowed sun:

| Omni and spot shadows | `MeshStandardMaterial` | `MeshPhysicalMaterial` with seven maps, an environment and transmission |
| --- | --- | --- |
| None | 2 | 11 |
| 1 and 1 | 3 | 12 |
| 4 and 4 | 3 | 12 |
| 8 and 8 | 3 | 12 |

A sampler per shadow takes 18 units with eight of each and the plain material, and 27 with the
physical one. A GPU with only 16 units fails to link both, and the scene draws nothing lit.

## Where it differs from Godot

- **Cube faces.** three renders the cube along the world's axes, and Godot along the light's
  (`renderer_scene_cull.cpp:2451-2468`). The copy reads either through the light's own directions,
  so only the cube's texel centres differ, by under a texel, for a turned light.
- **Dual Paraboloid mode.** Godot draws each caster straight into the two paraboloids, and bends
  its vertices (`render_forward_clustered.cpp:2695-2710`). Here every omni light takes the Cube
  path.
- **Shared texture.** A PCF tap at a slot's edge can read the neighbouring slot. In Godot that slot
  holds a light of the same viewport. Here it can hold another viewport's light.
- **Memory.** At 4096 the atlas takes 48 MiB, where Godot's takes 32 MiB, because three needs the
  colour attachment.
- **Depth convention.** The copy writes depth for three's standard depth buffer. `TscnCanvas` never
  reverses it.
- **Spot projector.** A spot light's matrix maps into its slot, and three reads a spot light's
  projector `map` through the same matrix. No node gives a spot light one.
