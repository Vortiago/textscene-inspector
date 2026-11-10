---
type: SubViewport
category: 3D
renders_as: an offscreen render target, plus a boundary that scopes its canvas subtree
---

# SubViewport

A Viewport that renders its subtree into an offscreen target for a `ViewportTexture` to sample (ADR-0033). It draws nothing itself. Its Node3D descendants still draw in the parent's 3D view unless `own_world_3d` is set, and its CanvasItem descendants draw only in the target. A Control-only subtree renders through its own WebGL pass. Each target keeps its own positional shadow atlas, sized by `positional_shadow_atlas_size` and the four `positional_shadow_atlas_quad_*` keys, as each Godot viewport does. `msaa_3d` multisamples a 3D target and `msaa_2d` the frame that a canvas target is drawn through (ADR-0057). Each takes the closest count at or below the mode that the device supports for the target's own colour storage, as Godot's driver does (`rendering_device_driver_vulkan.cpp:1999`). `texture_mipmap_bias` sets the mip level offset of the 3D materials that the target renders, and an unset value takes the project's (`viewport.cpp:4904-4911`, `:5383`). `anisotropic_filtering_level` sets the anisotropy of the textures that only the target draws, and an unset value takes the project's (`viewport.cpp:5384`). A pass renders by its `render_target_update_mode` and clears by its `render_target_clear_mode` (see the two sections below). A ViewportTexture on a `.glb` surface override resolves its `viewport_path` from the GLB instance, its local scene in Godot (`packed_scene.cpp:707`).

## Offscreen target

<!-- compare: image=unit-sub-viewport status=limitation fixture=unit-sub-viewport.tscn -->

A target that holds canvas content, 2D-world items or Controls, stores 8-bit sRGB bytes, as Godot's non-HDR `R8G8B8A8_UNORM` target does (`texture_storage.cpp:3568-3569`). Translucent content blends in those stored numbers, as on the main canvas (`renderer_canvas_render_rd.cpp:671,729`). A target without `transparent_bg` reads as alpha 1 to every consumer, as Godot's `swizzle_a = ONE` view does (`texture_storage.cpp:3641-3642`). A SUB or MUL item in it never lets the parent show through. Each target offers Godot's two views of its storage. A canvas consumer filters the plain view's bytes and multiplies them in sRGB (`texture_storage.cpp:754`). A `source_color` material slot samples the sRGB view, which decodes each texel before the filter (`material_storage.cpp:1067,1073`). A 3D pass draws its world into a linear HDR buffer, which resolves its `msaa_3d` samples (`render_forward_clustered.cpp:2402`). Godot's tonemap pass then writes the target: glow, `adjustment_*`, auto exposure and the tone curve of the Environment of the world `find_world_3d()` resolves (`viewport.cpp:4670-4681`, `render_forward_clustered.cpp:2514`). A shared world is the parent's, so its first WorldEnvironment in tree order gives the Environment, inside the viewport or out (`world_environment.cpp:76-85`). Every shared-world viewport of a 2D scene draws the scene's one World3D, so each camera shows the nodes of all of them. A Camera3D's own `environment` replaces it while the pass renders through that camera. `use_debanding` dithers the tonemap pass's output as Godot does (`tonemap.glsl:950-957`). An `own_world_3d` world takes its own, or LINEAR without one. A 3D-content target stores its tonemapped render as sRGB bytes too (`renderer_scene_render_rd.cpp:744`). A canvas consumer filters those bytes, and a translucent 3D surface keeps its linear blend. With `use_hdr_2d` it stores linear half floats instead, as the HDR 3D world section shows.

A sub-viewport that holds 2D content and Controls draws both into its own target, in tree order, through its own camera (`viewport.cpp:5344-5345`). A Camera2D inside frames the Controls that no CanvasLayer holds. A 3D world's 2D items and Controls draw over its tonemapped render in the same target, blended in sRGB numbers. Every CanvasLayer draws over it, whatever its `layer`, and a Camera2D moves them but not the world (`renderer_viewport.cpp:380-715`). Controls lay out by the authored `size`, also where the target is smaller than the device allows (`viewport.cpp:1202-1210`).

A sub-viewport with 2D content lights its canvas with its own World2D (`viewport.cpp:5345`). Its Light2D nodes, LightOccluder2D nodes and CanvasModulate act on the items inside it, and the canvas around it acts on nothing inside. The pass runs through the target's own camera into buffers of the target's size. A DirectionalLight2D shadow map spans `Rect2(0, 0, size)` (`renderer_viewport.cpp:390`).

The target's canvas content samples with the sub-viewport's own `canvas_item_default_texture_filter` and `canvas_item_default_texture_repeat` where no ancestor sets a value, and not with the project settings (`viewport.cpp:3974-4017`).

Every Texture2D slot resolves a `ViewportTexture` the same way: a material slot, a canvas item, a Control, a theme icon, a tile and a decal. Godot sets a ViewportTexture up only when every resource between the node and the texture is local to scene (`packed_scene.cpp:701-704`, `core/io/resource.cpp:497-503`). One it never sets up samples the magenta and black 4x4 placeholder (`viewport.cpp:168-173`).

## 2D items over a 3D world

<!-- compare: image=unit-sub-viewport-3d-canvas-item status=done fixture=unit-sub-viewport-3d-canvas-item.tscn -->

A quad, a translucent Polygon2D and an opaque one share a SubViewport, and a CanvasLayer below the world's canvas holds a third. Godot draws the 3D render first and every canvas over it, so the CanvasLayer's polygon covers the quad and sits under the opaque Polygon2D.

## HDR 2D canvas

<!-- compare: image=unit-sub-viewport-hdr-2d status=done fixture=unit-sub-viewport-hdr-2d.tscn -->

With `use_hdr_2d`, a sub-viewport draws its canvas in linear colour. The half-float target keeps values above 1 (`texture_storage.cpp:4541-4547`). Each colour of the canvas converts from sRGB to linear before it multiplies, and translucent items blend the linear values. A canvas item samples each texture through its decoding view. The SubViewportContainer shows the stored numbers as if they were sRGB bytes. So the left target draws darker than the sRGB target beside it. The bottom target keeps its value above 1 under the container's modulate of 0.5. The root viewport takes the project's `rendering/viewport/hdr_2d` the same way (`scene_tree.cpp:2088-2089`). The copy to the screen converts its linear canvas to sRGB and clamps it (`blit.glsl:136`).

## HDR 3D world

<!-- compare: image=unit-sub-viewport-hdr-3d-world status=done fixture=unit-sub-viewport-hdr-3d-world.tscn -->

With `use_hdr_2d`, the tonemap pass of a 3D world writes no sRGB encode and no debanding into a half-float target (`renderer_scene_render_rd.cpp:744,941`). A canvas over that world draws linear too. The SubViewportContainer shows the stored numbers as if they were sRGB bytes, so the left world draws darker than the sRGB world beside it. The bottom world keeps a value above 1 under the container's modulate of 0.5.

## HDR 2D canvas on a 3D surface

<!-- compare: image=unit-sub-viewport-hdr-2d-world status=done fixture=unit-sub-viewport-hdr-2d-world.tscn -->

A 3D material reads the same linear values with no decode, and a value above 1 reaches the tonemap. The top quad shows the HDR target and the bottom quad the sRGB one.

## Update mode

<!-- compare: image=unit-sub-viewport-update-mode status=done fixture=unit-sub-viewport-update-mode.tscn -->

Every sub-viewport is 32x32 with a red left half, and a 100x100 TextureRect shows it. A DISABLED viewport never renders, so its target holds (0, 0, 0, 0), which an opaque target shows as black. ONCE renders on the first frame after the scene loads. WHEN_VISIBLE renders from the frame after a consumer samples its target. WHEN_PARENT_VISIBLE renders in the frames its enclosing viewport renders, so a DISABLED parent stops it and not its WHEN_VISIBLE or ALWAYS siblings. A ONCE parent that samples a WHEN_VISIBLE child shows black where the child is, as the child has not rendered yet (`renderer_viewport.cpp:769-813`). A SubViewportContainer replaces the mode of its child: ALWAYS while the container is visible in the tree, DISABLED while it is not (`subviewport_container.cpp:116-128`). A viewport that holds nothing still gates the viewports inside it.

## Clear mode

<!-- compare: image=unit-sub-viewport-clear-mode status=done fixture=unit-sub-viewport-clear-mode.tscn -->

A red veil of alpha 0.25 covers the left half of each target. ALWAYS clears every render. NEVER draws a canvas over the bytes of the renders before, so the veil builds up toward its own colour. ONCE clears the first render and then acts as NEVER. A 3D render repaints the whole target, over opaque black where no clear set the colour, and `transparent_bg` still gives a transparent background (`renderer_viewport.cpp:373-378`, `renderer_scene_render_rd.cpp:1464-1469`). A 3D pass under ONCE keeps the clear colour of its one clear. The fixture shows a canvas on an opaque target, a canvas on a transparent target over white, and 3D content on an opaque target.

## ViewportTexture outside the local scene

<!-- compare: image=unit-viewport-texture-local-to-scene status=done fixture=unit-viewport-texture-local-to-scene.tscn -->

Two TextureRects draw one ViewportTexture through a CanvasTexture. Only the right CanvasTexture is local to scene, so Godot sets up only the right one. The left draws the magenta and black placeholder, stretched.

## Linting

<!-- lint:begin SubViewport -->
Strict parsing format-checks these `SubViewport` properties, plus 47 inherited from Viewport, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `render_target_clear_mode` | enum 0-2 (ALWAYS/NEVER/ONCE) | warning |
| `render_target_update_mode` | enum 0-4 (DISABLED/ONCE/WHEN_VISIBLE/WHEN_PARENT_VISIBLE/ALWAYS) | warning |
| `size` | Vector2i(x, y), both >= 2, or the Vector2 spelling Godot converts | error below |
| `size_2d_override` | Vector2i(x, y), or the Vector2 spelling Godot converts |  |
| `size_2d_override_stretch` | true or false |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
<!-- lint:end -->

Strict and lenient parsing diverge only on out-of-range enums. The lenient parser warns and falls back to Godot's default (`render_target_update_mode` 2, `render_target_clear_mode` 0, `msaa_2d` 0, `msaa_3d` 0, `canvas_item_default_texture_filter` 1, `canvas_item_default_texture_repeat` 0), while the strict parser reports an error. A `size` Godot cannot read at all falls back to `Vector2i(512, 512)`. A component below 2 is a strict error, because `Viewport::_set_size` raises it (`viewport.cpp:1120`).

## Known limitations

- **Approximated** A consumer surface inside its own viewport's frustum samples a target still being written, with a driver-defined result.
- **Needs runtime** A viewport whose camera or world is assigned by script shows only its clear colour in 3D, and frames from the origin in 2D.
