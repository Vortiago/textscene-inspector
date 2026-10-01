# Directional shadow fitting

The fitter fits each shadow-casting directional light's shadow to the viewing camera, in one,
two or four splits by `directional_shadow_mode`. It ports Godot 4.6.3's
`RendererSceneCull::_light_instance_setup_directional_shadow`
(`servers/rendering/renderer_scene_cull.cpp:2134-2353`), the split lookup of
`scene_forward_clustered.glsl:2403-2478` and the distance fade of `:2491`.

## Who does what

- A light declares its shadow on `userData` through `directionalShadowUserData`
  (`declaration.ts`). The DirectionalLight3D component and the preview sun do this. Neither
  sets a shadow camera. The declaration carries the split count, the three split offsets,
  `directional_shadow_blend_splits`, `directional_shadow_fade_start` and whether the light
  shares the atlas. A DirectionalLight3D defaults to four splits
  (`light_3d.cpp:606`), and so does the editor's preview sun (`node_3d_editor_plugin.cpp:10383`).
- `<DirectionalShadowFitter>` is mounted inside `<TscnSceneContents>`, so the web previewer,
  the VS Code extension and the visual harness all mount it. It fits every declared light in Godot's
  list of shadowed lights to the camera of each render of the scene. It also writes each shadow's fade for
  that render, through `scene.onBeforeRender` (`r3f/sceneRenderCamera.ts`). three calls that
  hook after it updates the world matrices and before the shadow pass. So each render gets a fit
  to its own camera: the main view, a SubViewport pass that renders the shared world, and a
  screenshot. No render order matters.
- A 3D SubViewport that renders its own portal scene hooks that scene with
  `useDirectionalShadowFit`. Its unmount hands every declared light its own shading and layers
  back.
- Every light in the shadow list draws into its share of one atlas texture (`shadowAtlas.ts`), and
  every lit program samples that texture through one sampler (`shadowAtlasChunk.ts`).
- A light without a declaration keeps its shadow camera and its map as three built them.

## Godot's light lists

Godot draws the first eight visible directional lights on a visible layer, in scenario order, and
stops there (`renderer_scene_cull.cpp:3257-3262`). Of those eight, a light whose shadow is on and
whose `sky_mode` is not Sky Only joins `lights_with_shadow` (`:3271-3273`). Only a light in that
list has a shadow. `lightLists.ts` builds both lists from the visible declared lights in pre-order.

- A light in the shadow list casts in its share of the atlas through a split sun, in one, two or
  four splits.
- A light among the eight but outside the shadow list gets no fit and no split sun. Its declarer
  derives `castShadow` from the same declaration, so that is off.
- A visible light past the eighth leaves three's render through its layers (`droppedLight.ts`), so
  it neither lights nor casts, as in Godot.
- A hidden light gets no fit and keeps no split sun, as three renders neither.

Godot builds the lists per camera, from the layers that camera sees (`:3258`). The previewer maps
neither `cull_mask` nor `layers` onto three's layers, so every camera that renders a scene sees every
light. The main view, a SubViewport pass and a screenshot all keep three's default layer. Only the 2D
light accumulation pass changes its camera's layers, and it renders a 2D canvas, which has no fitter.
So the lists ignore layers, and every render of a steady scene gets the same lists.

Lists per camera would cost more where two cameras differ. Each render would attach or release a
split sun and move every share of the atlas. three keys a program by `NUM_SUN_LIGHT_SHADOWS`
(r186 `WebGLPrograms.js:483`) and keeps each program a material compiled (`WebGLRenderer.js:2201-2223`).
So the first change compiles every lit material again, and each later change switches every
material's program and uploads its uniforms again, since the lights' state version moves
(`WebGLLights.js:493-545`).

## The port

1. The slice runs from the camera's near plane to the shadow max distance or the camera's far
   plane, whichever is nearer (`:2143-2149`). An orthogonal camera ignores the max distance.
2. The splits cut the slice at `split_1`, `split_2` and `split_3` of its length (`:2170-2175`).
   The last split always ends at the slice's far end, so a light with two splits never reads
   `split_2`. With blending on, each split after the first starts where the previous one starts
   (`:2197`, `:2200`).
3. Each split's eight corners give a centre and a radius. The radius grows by one texel on each
   side (`:2282`).
4. Each box is the sphere's square across the light, with each edge snapped to four radii over
   the split's texture size (`:2303-2307`). The snap keeps the shadow's texel grid still while
   the camera moves.
5. Every visible shadowed directional light shares one atlas, Godot's default directional
   shadow size of 4096 texels square (`rendering_server.cpp:3704`). Only a light in Godot's
   shadow list takes a share (`renderer_scene_cull.cpp:3257-3282`). The atlas splits into a grid that doubles its
   columns, then its rows, until it holds every light (`light_storage.cpp:2577-2597`). So two
   lights take its halves by width at full height.

   Within a light's share, two splits take its halves by height and four take its quadrants
   (`render_forward_clustered.cpp:2610-2630`). A split counts its texels against the larger
   side of its rectangle (`light_storage.cpp:2603-2623`): 4096 for one light with one or two
   splits, 2048 for four. The normal bias counts in those texels (`:2347`,
   `light_storage.cpp:724`), so the fitter turns it into world units for each box.
6. The far side of each box sits one radius past its centre. The near side sits one radius plus
   `directional_shadow_pancake_size` towards the light (`:2284`, `:2327`).
7. The shadow fades out across the far end of the last split, from
   `directional_shadow_fade_start` of its far depth to that depth (`light_storage.cpp:752-754`).
   Past it nothing is shadowed (`scene_forward_clustered.glsl:2491`), although the boxes reach
   further.

## The fade

three shadows every receiver inside a shadow camera's box. Each box is a square round a sphere,
so the last one reaches past the slice's far end. `shadowFade.ts` patches three's chunks to mix
each directional and sun shadow towards unshadowed by the receiver's view depth, as Godot does.

- Godot's fade runs from `fade_start` of `shadow_split_offsets[3]` to that depth. Slot 3 holds
  the last split's far end in every mode (`light_storage.cpp:711`), which is the slice's far end
  (`renderer_scene_cull.cpp:2175`). The fade mixes whichever split the fragment sampled, after
  the split lookup. So an orthogonal light and a light with splits fade over the same depths,
  and a small `fade_start` reaches into the nearer splits too.
- `installDirectionalShadowFade` runs once, when `TscnCanvas` is imported. It declares one
  `vec2` uniform array outside both of three's shadow blocks, with an entry per directional
  shadow and per sun shadow. It gives every built-in lit material that uniform.
- The uniform's value is one shared `Float32Array`. `UniformsUtils.cloneUniforms` keeps a typed
  array by reference, so each material's clone reads the same buffer. The buffer has 32 entries.
  The sun shadows are at most eight. An undeclared directional light binds its own sampler, so
  texture units bound those, and a desktop GPU commonly reports 32.
- three counts directional shadows and sun shadows apart (`WebGLLights.js:289-356`). The
  directional loop reads entry `i`, and the sun loop reads entry `NUM_DIR_LIGHT_SHADOWS + i`.
- The fitter writes the buffer before each render, after it fits every light. It writes in the
  order three indexes its shadow uniforms: casting lights in visible pre-order, where the
  camera's layers include them. A light in the shadow list fails that layer test, so its
  `SplitSunLight` takes the light's fade at the sun's index. A dropped light fails it too, and
  takes no index. An undeclared caster keeps its index with no fade.
- A `ShaderMaterial` with `lights: true` lacks the uniform. Its shadow reads zeros, which the
  shader treats as no fade.
- The fade and the split lookup both edit `shadowmap_pars_fragment`. The fade inserts after
  `#ifdef USE_SHADOWMAP`, and the split lookup rewrites only the sun block, so either install
  order gives the same chunk. Each install changes nothing on a second call.

## The split lookup

A fragment takes the first split whose far end lies past its view depth (`:2408-2440`). The last
split takes everything beyond the third far end. The far ends are Godot's
`shadow_split_offsets`, and a light with two splits repeats its last far end in the slots past
it (`light_storage.cpp:704`, `:711`).

Without blending, a split's filter radius scales by the first split's far end over its own
(`:2422-2443`). So a far split's blur keeps about the same world size as the first split's.
With blending, every split keeps the full radius and mixes in the next split's shadow over the
last tenth of its own depth (`:2445-2478`). The lookup samples the next split only inside that
band, where its weight is above zero. An orthogonal light never blends
(`light_storage.cpp:705`).

## The filter

Godot's PCF kernel is a Vogel disk whose radius is `soft_shadow_scale` atlas texels on each axis
(`scene_forward_clustered.glsl:2443`, `scene_forward_lights_inc.glsl:283-307`). For a light
without an angular size, `soft_shadow_scale` is `shadow_blur` times the quality radius
(`light_storage.cpp:697-703`), which is 2 at the default Soft Low quality
(`renderer_scene_render_rd.cpp:1204-1207`). So the default kernel reaches two texels. The fitter
writes that radius to the light's `shadow.radius` before each render (`godot/softShadowScale.ts`),
and a split sun copies it.

three r186 scales both axes of the kernel by one texel of the map's width. Every share lies in one
square atlas, so a texel is as tall as it is wide, and the kernel spans `soft_shadow_scale` atlas
texels on each axis, as Godot's does.

three's disk takes five taps, and Godot's Soft Low disk takes four. Both rotate the disk per pixel
by the same interleaved gradient noise, in opposite senses. So the soft edge's dither differs, and
its mean over a few pixels matches.

## The three.js design

three r186's WebGL renderer draws a shadow with several viewports only for a light on its sun path
(`isSunLight`). `WebGLShadowMap.js:287-358` renders one viewport per slot into one map, and
`WebGLLights.js:289-327` uploads one matrix and one vec4 per slot. So every light in the shadow list
shades through three parts, whatever its split count:

- `SplitSunLight` (`splitSun.ts`), a child of the declared light on the sun path. The fitter
  attaches it with the light's first successful fit, and then hides the declared light from the
  render through its layers. Each fit copies the declared light's colour, intensity and shadow
  strength onto it. A light that stops casting or leaves the shadow list, and the fitter's
  unmount, remove it and restore the declared light.
- `DirectionalSplitShadow` (`splitShadow.ts`), the sun's shadow: one orthographic camera per
  slot, and a world-to-atlas matrix per slot. It draws into the light's share of the atlas, with
  the splits where Godot puts them in that share. A slot past the light's last split draws nothing
  and repeats the last split's matrix.
- `splitShadowChunk.ts`, which replaces three's cascade walk in `shadowmap_pars_fragment` with
  Godot's split lookup, and gives every sun four slots. It installs once at import of
  `TscnCanvas.tsx`, before any program compiles.

`fitDirectionalShadowSplits.ts` holds the maths. It fits one box per split through
`directionalShadowBoxFitter`, which computes the light's axes and caster reach once. It returns
the boxes, the light's fade and the four slots the shader reads. Each slot holds its split's far
end, depth bias, normal bias and blend start. The lookup never reads slot 3's blend start.

A light with one split takes the same path as one with more. three computes a sun's shadow
coordinate per fragment, as Godot does (`scene_forward_clustered.glsl:2413`), where its directional
path computes it per vertex. The two differ only in float rounding.

The other two designs cost more. One `DirectionalLight` per split lights the scene once per
split, and still needs a shader patch to pick a split by depth. A hand-rolled atlas pass would
duplicate three's caster culling, its depth materials and its shadow uniforms. The sun path
keeps all three.

## The shared atlas

Godot keeps one directional shadow atlas, and every directional light samples it through one
binding (`light_storage.cpp:2572-2621`, `scene_forward_clustered_inc.glsl:374`). Here too, one
`WebGLRenderTarget` of 4096 texels square holds every share (`shadowAtlas.ts`):

- Each `DirectionalSplitShadow` holds the atlas as its `map` from construction. three builds a map
  only for a shadow that has none (r186 `WebGLShadowMap.js:203`), so every shadow keeps it.
- `mapSize` is one split's rectangle, and the frame extents are the atlas over that rectangle. So
  every shadow asks three for the atlas's own size, and three never resizes it
  (`WebGLShadowMap.js:281-285`). Each slot's viewport and matrix place the split at its texels in
  the atlas.
- three binds and clears a shadow's whole map before it draws the shadow (`:338-339`). Before
  that, it asks the shadow for its matrices (`:291`), where the shadow sets the atlas's scissor to
  its own share. three binds a target with the target's scissor (`WebGLRenderer.js:3040-3071`), so
  each light clears and draws only its share.
- `shadowAtlasChunk.ts` replaces three's array of sun shadow samplers with one sampler,
  `directionalShadowAtlas`, in `shadowmap_pars_fragment`, `lights_fragment_begin` and
  `shadowmask_pars_fragment`. It gives every lit `ShaderLib` entry and `UniformsLib.lights` that
  uniform. three no longer finds a `sunShadowMap` uniform in the program, so it binds no unit for
  it (`WebGLRenderer.js:2657-2661`).
- `cloneUniforms` clones a texture for each material (`UniformsUtils.js:28-39`). The atlas's
  depth texture answers a clone with itself, so every material samples the one atlas.
- A `ShaderMaterial` with `lights: true` that does not merge `UniformsLib.lights` lacks the
  uniform. It samples three's empty shadow texture, which shadows nothing
  (`WebGLUniforms.js:571-584`).
- A shadow lets go of the atlas when its sun is removed. The last holder frees the atlas's GPU
  memory, and three builds it again at the next shadow pass that draws into it.
- The atlas holds three's PCF map: a 24-bit depth texture that compares less-or-equal
  with linear filtering (`WebGLShadowMap.js:253-266`). `TscnCanvas` asks for soft shadows, which
  three r186 draws as PCF (`:99-102`), and it never reverses the depth buffer.
- `splitShadow.test.ts` reads three's shadow pass and `setRenderTarget`, and fails on a release
  that changes what the atlas relies on.

### Texture units

WebGL 2 guarantees 16 texture units per program (`MAX_TEXTURE_IMAGE_UNITS`). Measured from the
active samplers of programs three r186 linked in the visual harness's Chromium, with every chunk
patch `TscnCanvas` installs, for a light with four splits:

| Shadowed suns | `MeshStandardMaterial` | `MeshPhysicalMaterial` with seven maps, an environment and transmission | The same, with an omni and a spot shadow |
| --- | --- | --- | --- |
| 0 | 1 | 10 | 12 |
| 1 | 2 | 11 | 13 |
| 4 | 2 | 11 | 13 |
| 8 | 2 | 11 | 13 |

A light with one split counts the same. The one unit of a plain material is three's `dfgLUT`. Every
omni and spot shadow still binds a unit of its own, where Godot keeps them in one positional atlas.

A sampler per sun would take 9 units with eight suns and the plain material, 18 with the physical
one, and 20 with the omni and spot shadows too. A GPU with only 16 units fails to link the last
two, and the scene draws nothing lit.

### The other designs

- A cap on the shadowed suns, tied to the material's own sampler count, drops shadows that Godot
  draws. three also sets up one light state per render (`WebGLLights.js:221-549`), so a cap that
  differs between materials needs a light list per material.
- A depth texture array, one layer per light, sampled through one `sampler2DArrayShadow`. three
  r186 draws a light's shadow only into a 2D or a cube target, so it needs a shadow pass of its
  own. Each layer is the full atlas, so eight lights take eight times the memory.
- A copy of each light's own map into an atlas after the shadow pass. It samples one texture, but
  it keeps every texel twice, about 256 MiB, and adds a copy pass to each render.
- An orthogonal light on three's directional path keeps a sampler of its own beside the atlas. A
  patch that made that path sample the atlas would also do so for an undeclared light, which draws
  into its own map.

## Cost

Measured on a synthetic scene of 1,000 shadow-casting boxes on a ground plane, at 955 × 756,
in the headless Chromium and SwiftShader of the visual harness:

| Mode | Draw calls per frame | Fit per render |
| --- | --- | --- |
| 0 (one split) | 1,458 | 23 to 32 µs |
| 1 (two splits) | 1,503 | 25 to 38 µs |
| 2 (four splits) | 2,579 | 26 to 30 µs |

The shadow pass culls casters against each split's box, so a split draws only the casters in
its own box, as Godot's does. The extra draw calls are the casters that fall in more than one
split's box. A slot past the last split culls every caster three tests against a frustum, so one
split draws as many calls as three's own directional shadow. A caster with `frustumCulled` off
skips that test (`WebGLShadowMap.js:526`), so it draws into every slot, and into an undrawn one
at no size. The fit costs microseconds in every mode, far below the draw. Most of it is the one
walk of the scene that finds the lights.

The atlas is one 4096 target, as three builds a shadow map: an RGBA colour attachment beside a
24-bit depth texture, so it takes about 128 MiB. Godot's atlas takes 32 MiB, since it stores 16-bit
depth and nothing else (`rendering_server.cpp:3708`). A change in how many lights share the atlas
moves each light's share and keeps the atlas.

### Fragment uniforms

WebGL 2 guarantees 224 fragment uniform vectors (`MAX_FRAGMENT_UNIFORM_VECTORS`), and ANGLE
packs a WebGL program's uniforms by the rule of GLSL ES 1.00 Appendix A.7. Every sun shadow
declares four slots, since the shader finds a light's slots at `shadowIndex * SUN_LIGHT_CASCADES`.
Each slot takes a matrix (four vectors) and a vec4. With the sun's light, its shadow and its fade, a
shadowed sun takes about 24 vectors, whatever its split count.

The shadow list holds at most eight lights, so a program samples at most eight sun shadows. Packed
from the active uniforms of a program three r186 linked in the visual harness's Chromium:

| Shadowed suns | `MeshStandardMaterial` | With every map, an environment and fog |
| --- | --- | --- |
| 0 | 4 | 15 |
| 1 | 31 | 38 |
| 8 | 196 | 203 |
| 9 | 219 | 226 |

A sun with one or two splits costs the same as one with four. A slot count that varied by scene
would need a define three's program key does not hold (`WebGLPrograms.js:476-483`), so a material would
reuse a program compiled for another count.

## Where it differs from Godot

- **Axes.** Godot snaps along the light node's own X and Y axes. three builds each shadow
  camera with `lookAt` and the camera's `up`, which can roll the square about the light
  direction. The box covers the same slice. Only the snap grid turns.
- **Pancaking.** Godot flattens a caster nearer the light than the near plane onto that plane
  (`scene_forward_clustered.glsl:679-682`), for any positive pancake size
  (`render_forward_clustered.cpp:2606`). three clips such a caster. So the fitter moves every
  box's near plane to one diameter of the whole view slice's sphere past that slice's near face.
  Every split takes this same reach, so a caster casts into all of them or into none. A caster
  beyond it casts nothing.
- **Bias.** Godot spends the depth bias over its own depth range (`:2348`). When the near plane
  moves out, three's range is longer, so the fitter divides the declared bias by the same
  factor. The bias then holds the same size in world units.
- **Normal bias direction.** three moves the lookup along the whole world normal
  (`shadowmap_vertex.glsl.js:35`). Godot scales the normal by `1 - max(0, -N·L)`, which is 1 on a
  lit face, and removes its component along the light (`scene_forward_clustered.glsl:2301-2307`).
  So its offset is never longer than three's. The offset is two texels. In Truck Town, even a zero
  normal bias changes only acne and shadow edges one pixel wide, not the extent of a shadow.
- **Soft-shadow widening.** Godot widens the box by `tan(light_angular_distance)` times its
  depth (`:2286-2299`) to fit its soft-shadow blur. The previewer draws no angular soft shadow,
  so the box omits it.
- **Last of two splits.** With blending on, Godot's last split of two blends towards a third
  slot it never set up. Here the last split never blends.
- **Clip planes.** Godot's editor camera clips at 0.05 and 4000 (`editor_settings.cpp:931-932`),
  and framing a node keeps both. The previewer's editor camera starts at react-three-fiber's 0.1
  and 1000. Framing sets its clip planes to a two-hundredth and two hundred times the framing
  distance (`frameSceneBounds.ts`, ADR-0029). The slice, the split ends and the fade follow those
  planes. An authored Camera3D keeps its own planes, as in Godot.
