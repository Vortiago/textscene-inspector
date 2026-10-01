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
  the VS Code extension and the visual harness all mount it. It fits every declared, casting
  light in the scene before each render of it, to that render's camera, and writes each
  shadow's fade for that render, through
  `scene.onBeforeRender` (`r3f/sceneRenderCamera.ts`). three calls that hook after it updates the
  world matrices and before the shadow pass, so each render gets a fit to its own camera: the main
  view, a SubViewport pass that renders the shared world, and a screenshot. No render order
  matters.
- A SubViewport with its own world hooks that world with `useDirectionalShadowFit`. Its unmount
  hands every split light its own shading back.
- The fitter sizes each declared light's shadow map to its share of the atlas, which need not be
  square. three builds a map once, so the fitter frees the old one only when the share changes
  size (`shadowMapAllocation.ts`). A light that takes no share keeps a whole atlas of its own.
- A light without a declaration keeps its shadow camera and its map as three built them.

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
   shadow size of 4096 texels square (`rendering_server.cpp:3704`). A light whose `sky_mode`
   is Sky Only takes no share, and only the first eight directional lights count
   (`renderer_scene_cull.cpp:3257-3282`). The atlas splits into a grid that doubles its
   columns, then its rows, until it holds every light, so two lights take its halves by width
   at full height (`light_storage.cpp:2577-2597`). Within a light's share, two splits take its
   halves by height and four take its quadrants (`render_forward_clustered.cpp:2610-2630`). A
   split counts its texels against the larger side of its rectangle (`light_storage.cpp:2603-2623`):
   4096 for one light with one or two splits, 2048 for four. The normal bias counts in those
   texels (`:2347`, `light_storage.cpp:724`), so the fitter turns it into world units for each
   box.
6. The far side of each box sits one radius past its centre. The near side sits one radius plus
   `directional_shadow_pancake_size` towards the light (`:2284`, `:2327`).
7. The shadow fades out across the far end of the last split, from
   `directional_shadow_fade_start` of its far depth to that depth (`light_storage.cpp:752-754`).
   Past it nothing is shadowed (`scene_forward_clustered.glsl:2491`), although the boxes reach
   further.

## The fade

three shadows every receiver inside a shadow camera's box, and each box is a square round a
sphere, so the last one reaches past the slice's far end. `shadowFade.ts` patches three's
chunks to mix each directional and sun shadow towards unshadowed by the receiver's view depth,
as Godot does.

- Godot's fade runs from `fade_start` of `shadow_split_offsets[3]` to that depth. Slot 3 holds
  the last split's far end in every mode (`light_storage.cpp:711`), which is the slice's far end
  (`renderer_scene_cull.cpp:2175`). The fade mixes whichever split the fragment sampled, after
  the split lookup. So an orthogonal light and a light with splits fade over the same depths,
  and a small `fade_start` reaches into the nearer splits too.
- `installDirectionalShadowFade` runs once, when `TscnCanvas` is imported. It declares one
  `vec2` uniform array with an entry per directional shadow and per sun shadow, outside both of
  three's shadow blocks, and gives every built-in lit material that uniform.
- The uniform's value is one shared `Float32Array`. `UniformsUtils.cloneUniforms` keeps a typed
  array by reference, so each material's clone reads the same buffer.
- three counts directional shadows and sun shadows apart (`WebGLLights.js:289-356`). The
  directional loop reads entry `i`, and the sun loop reads entry `NUM_DIR_LIGHT_SHADOWS + i`.
- The fitter writes the buffer before each render, after it fits every light, in the order three
  indexes its shadow uniforms: casting lights in visible pre-order, where the camera's layers
  include them. A light with splits fails that layer test, so its `SplitSunLight` takes the
  light's fade at the sun's index. An undeclared caster keeps its index with no fade.
- A `ShaderMaterial` with `lights: true` lacks the uniform. Its shadow reads zeros, which the
  shader treats as no fade.
- The fade and the split lookup both edit `shadowmap_pars_fragment`. The fade inserts after
  `#ifdef USE_SHADOWMAP`, and the split lookup rewrites only the sun block, so either install
  order gives the same chunk. Each install changes nothing on a second call.

## The split lookup

A fragment takes the first split whose far end lies past its view depth, and the last split
takes everything beyond the third far end (`:2408-2440`). The far ends are Godot's
`shadow_split_offsets`, and a light with two splits repeats its last far end in the slots past
it (`light_storage.cpp:704`, `:711`).

Without blending, a split's filter radius scales by the first split's far end over its own
(`:2422-2443`), so a far split's blur keeps about the same world size as the first split's.
With blending, every split keeps the full radius and mixes in the next split's shadow over the
last tenth of its own depth (`:2445-2478`). An orthogonal light never blends
(`light_storage.cpp:705`).

## The filter

Godot scales its PCF kernel by one atlas texel on each axis (`renderer_scene_render_rd.cpp:1388-1389`,
`scene_forward_clustered.glsl:2443`). A light's map is its share of the atlas, so the kernel spans
the same number of texels across and down a share twice as tall as it is wide. three r186 scales
both axes by one texel of the map's width. `texelShadowFilter.ts` patches its PCF lookup to scale
each axis by its own texel, which changes nothing for a square map. It installs once at import of
`TscnCanvas.tsx`, and composes with the split lookup and the fade in any order.

## The three.js design

three r186's WebGL renderer draws a directional shadow atlas with several viewports only for a
light on its sun path (`isSunLight`). `WebGLShadowMap.js:287-358` renders one viewport per slot
into one map, and `WebGLLights.js:289-327` uploads one matrix and one vec4 per slot. So a light
with splits shades through three parts:

- `SplitSunLight` (`splitSun.ts`), a child of the declared light on the sun path. The fitter
  attaches it with the light's first successful split fit, and then hides the declared light
  from the render through its layers. Each fit copies the declared light's colour, intensity
  and shadow strength onto it. Mode 0, a light that stops casting, and the fitter's
  unmount remove it and restore the declared light.
- `DirectionalSplitShadow` (`splitShadow.ts`), the sun's shadow: one orthographic camera per
  slot, and a world-to-atlas matrix per slot. Its texture holds only the light's share of the
  atlas, with the splits where Godot puts them in that share. A slot past the light's last
  split draws nothing and repeats the last split's matrix.
- `splitShadowChunk.ts`, which replaces three's cascade walk in `shadowmap_pars_fragment` with
  Godot's split lookup, and gives every sun four slots. It installs once at import of
  `TscnCanvas.tsx`, before any program compiles.

`fitDirectionalShadowSplits.ts` holds the maths. It fits one box per split through
`fitDirectionalShadowBox`, and returns the boxes, the light's fade and the four slots the
shader reads. Each slot holds its split's far end, depth bias, normal bias
and blend start. The lookup never reads slot 3's blend start.

The other two designs cost more. One `DirectionalLight` per split lights the scene once per
split, and still needs a shader patch to pick a split by depth. A hand-rolled atlas pass would
duplicate three's caster culling, its depth materials and its shadow uniforms. The sun path
keeps all three.

## Cost

Measured on a synthetic scene of 1,000 shadow-casting boxes on a ground plane, at 955 × 756,
in the headless Chromium and SwiftShader of the visual harness:

| Mode | Draw calls per frame | Fit per render |
| --- | --- | --- |
| 0 (one map) | 1,458 | 13 to 16 µs |
| 1 (two splits) | 1,503 | 20 to 31 µs |
| 2 (four splits) | 2,579 | 21 to 26 µs |

The shadow pass culls casters against each split's box, so a split draws only the casters in
its own box, as Godot's does. The extra draw calls are the casters that fall in more than one
split's box. The fit costs microseconds in every mode, far below the draw.

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
  (`shadowmap_vertex.glsl.js:35`). Godot scales the normal by `1 - max(0, N·L)` and removes
  its component along the light (`scene_forward_clustered.glsl:2301-2307`), so its offset is
  never longer than three's. The offset is two texels. In Truck Town, even a zero normal bias
  changes only acne and shadow edges one pixel wide, not the extent of a shadow.
- **Soft-shadow widening.** Godot widens the box by `tan(light_angular_distance)` times its
  depth (`:2286-2299`) to fit its soft-shadow blur. The previewer draws no angular soft shadow,
  so the box omits it.
- **Sky Only.** Godot neither lights nor shadows a surface with a light whose `sky_mode` is
  Sky Only (`light_storage.cpp:632`). Here it does both, with a whole atlas of its own.
- **Last of two splits.** With blending on, Godot's last split of two blends towards a third
  slot it never set up. Here the last split never blends.
