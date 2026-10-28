---
type: SubViewport
category: 3D
status: limitation
fixture: unit-sub-viewport.tscn
image: unit-sub-viewport
renders_as: an offscreen render target, plus a boundary that scopes its canvas subtree
---

# SubViewport

A Viewport that renders its subtree into an offscreen target for a `ViewportTexture` to sample (ADR-0033). It draws nothing itself. Its Node3D descendants still draw in the parent's 3D view unless `own_world_3d` is set, and its CanvasItem descendants draw only in the target. A Control-only subtree renders through its own WebGL pass. Each target keeps its own positional shadow atlas, sized by `positional_shadow_atlas_size` and the four `positional_shadow_atlas_quad_*` keys, as each Godot viewport does. `msaa_3d` multisamples a 3D target and `msaa_2d` the frame that a canvas target is drawn through (ADR-0057). Each takes the closest count at or below the mode that the device supports for the target's own colour storage, as Godot's driver does (`rendering_device_driver_vulkan.cpp:1999`). `texture_mipmap_bias` sets the mip level offset of the 3D materials that the target renders, and an unset value takes the project's (`viewport.cpp:4904-4911`, `:5383`). `anisotropic_filtering_level` sets the anisotropy of the textures that only the target draws, and an unset value takes the project's (`viewport.cpp:5384`). A ViewportTexture on a `.glb` surface override resolves its `viewport_path` from the GLB instance, its local scene in Godot (`packed_scene.cpp:707`).

A target that holds canvas content, 2D-world items or Controls, stores 8-bit sRGB bytes, as Godot's non-HDR `R8G8B8A8_UNORM` target does (`texture_storage.cpp:3568-3569`). Translucent content blends in those stored numbers, as on the main canvas (`renderer_canvas_render_rd.cpp:671,729`). Each target offers Godot's two views of its storage. A canvas consumer filters the plain view's bytes and multiplies them in sRGB (`texture_storage.cpp:754`). A `source_color` material slot samples the sRGB view, which decodes each texel before the filter (`material_storage.cpp:1067,1073`). A 3D pass draws its world into a linear HDR buffer, which resolves its `msaa_3d` samples (`render_forward_clustered.cpp:2402`). Godot's tonemap pass then writes the target: glow, `adjustment_*`, auto exposure and the tone curve of the Environment of the world `find_world_3d()` resolves (`viewport.cpp:4670-4681`, `render_forward_clustered.cpp:2514`). A shared world is the parent's, so its first WorldEnvironment in tree order gives the Environment, inside the viewport or out (`world_environment.cpp:76-85`). A Camera3D's own `environment` replaces it while the pass renders through that camera. `use_debanding` dithers the tonemap pass's output as Godot does (`tonemap.glsl:950-957`). An `own_world_3d` world takes its own, or LINEAR without one. A 3D-content target stores its tonemapped render as sRGB bytes too (`renderer_scene_render_rd.cpp:744`). A canvas consumer filters those bytes, and a translucent 3D surface keeps its linear blend.

A sub-viewport with 2D content lights its canvas with its own World2D (`viewport.cpp:5345`). Its Light2D nodes, LightOccluder2D nodes and CanvasModulate act on the items inside it, and the canvas around it acts on nothing inside. The pass runs through the target's own camera into buffers of the target's size. A DirectionalLight2D shadow map spans `Rect2(0, 0, size)` (`renderer_viewport.cpp:390`).

The target's canvas content samples with the sub-viewport's own `canvas_item_default_texture_filter` and `canvas_item_default_texture_repeat` where no ancestor sets a value, and not with the project settings (`viewport.cpp:3974-4017`).

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

- **Approximated** A sub-viewport holding both 2D and 3D content shows its 3D half only, since the renderer draws one workspace at a time.
- **Approximated** `render_target_update_mode` and `render_target_clear_mode` do not gate the pass, so the target is re-rendered and cleared every frame.
- **Approximated** A consumer surface inside its own viewport's frustum samples a target still being written, with a driver-defined result.
- **Not drawn** A `TextureRect` draws nothing for a `ViewportTexture`, which only a material's texture slots and `Sprite2D.texture` accept.
- **Approximated** `use_hdr_2d` is not read, so an HDR canvas composites differently.
- **Needs runtime** A viewport whose camera or world is assigned by script shows only its clear colour in 3D, and frames from the origin in 2D.
