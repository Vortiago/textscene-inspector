# Directional shadow fitting

The fitter gives each shadow-casting directional light one orthogonal shadow map over the
viewing camera's view. It ports Godot 4.6.3's
`RendererSceneCull::_light_instance_setup_directional_shadow`
(`servers/rendering/renderer_scene_cull.cpp:2134-2353`) for `directional_shadow_mode = 0`.

## Who does what

- A light declares its shadow on `userData` through `directionalShadowUserData`
  (`declaration.ts`). The DirectionalLight3D component and the preview sun do this. Neither
  sets a shadow camera.
- `<DirectionalShadowFitter>` is mounted inside `<TscnSceneContents>`, so the web previewer,
  the VS Code extension and the visual harness all mount it. It fits every declared, casting
  light in the scene before each render of it, to that render's camera, through
  `scene.onBeforeRender` (`r3f/sceneRenderCamera.ts`). three calls that hook after it updates the
  world matrices and before the shadow pass, so each render gets a fit to its own camera: the main
  view, a SubViewport pass that renders the shared world, and a screenshot. No render order
  matters.
- A SubViewport with its own world hooks that world with `useDirectionalShadowFit`.
- A light without a declaration keeps its shadow camera as three built it.

## The port

1. The slice runs from the camera's near plane to the shadow max distance or the camera's far
   plane, whichever is nearer (`:2143-2149`). An orthogonal camera ignores the max distance.
2. The eight slice corners give a centre and a radius. The radius grows by one texel on each
   side (`:2282`).
3. The box is the sphere's square across the light, with each edge snapped to four radii over
   the map size (`:2303-2307`). The snap keeps the shadow's texel grid still while the camera
   moves.
4. The map is Godot's default directional shadow size, 4096 texels square
   (`rendering_server.cpp:3704`). The normal bias counts in texels of it (`:2347`,
   `light_storage.cpp:724`), so the fitter turns it into world units for each box.
5. The far side sits one radius past the centre. The near side sits one radius plus
   `directional_shadow_pancake_size` towards the light (`:2284`, `:2327`).

## Where it differs from Godot

- **Axes.** Godot snaps along the light node's own X and Y axes. three builds the shadow
  camera with `lookAt` and the camera's `up`, which can roll the square about the light
  direction. The box covers the same slice. Only the snap grid turns.
- **Pancaking.** Godot flattens a caster nearer the light than the near plane onto that plane
  (`scene_forward_clustered.glsl:679-682`), for any positive pancake size
  (`render_forward_clustered.cpp:2606`). three clips such a caster. So the fitter moves the near
  plane one slice diameter further towards the light. A caster beyond that casts nothing here.
- **Bias.** Godot spends the depth bias over its own depth range (`:2348`). When the near plane
  moves out, three's range is longer, so the fitter divides the declared bias by the same
  factor. The bias then holds the same size in world units.
- **Soft-shadow widening.** Godot widens the box by `tan(light_angular_distance)` times its
  depth (`:2286-2299`) to fit its soft-shadow blur. The previewer draws no angular soft shadow,
  so the box omits it.
- **Splits.** Modes 1 and 2 get the same single map over the whole slice.
