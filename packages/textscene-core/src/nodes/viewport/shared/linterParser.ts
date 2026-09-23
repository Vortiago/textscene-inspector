/**
 * Validators for the members `doc/classes/Viewport.xml` declares, registered under
 * the abstract key `'Viewport'` so the base-walk delivers them to SubViewport and
 * Window alike. Godot cannot instantiate `Viewport`, so it never appears in a `.tscn`
 * and has no slice of its own.
 */

// The base chain. Registration happens on import, so a test that loads only
// this slice resolves an inherited key only if the ancestor is imported too.
import '../../node/linterParser.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { layerBitmask, v } from '../../../linter/validators/index.js';

const MSAA = { 0: 'DISABLED', 1: '2X', 2: '4X', 3: '8X' };

/** 4.7.2: viewport.h:200-206. DEFAULT_CANVAS_ITEM_TEXTURE_REPEAT_MAX = 4. */
const TEXTURE_REPEAT = { 0: 'DISABLED', 1: 'ENABLED', 2: 'MIRROR', 3: 'PARENT_NODE' };

/** viewport.h:137-142. SCREEN_SPACE_AA_MAX = 3. */
const SCREEN_SPACE_AA = { 0: 'DISABLED', 1: 'FXAA', 2: 'SMAA' };

/** viewport.h:203-209. SDF_OVERSIZE_MAX = 4. */
const SDF_OVERSIZE = { 0: '100_PERCENT', 1: '120_PERCENT', 2: '150_PERCENT', 3: '200_PERCENT' };

/** viewport.h:211-216. SDF_SCALE_MAX = 3. */
const SDF_SCALE = { 0: '100_PERCENT', 1: '50_PERCENT', 2: '25_PERCENT' };

/**
 * viewport.h:108-117. SHADOW_ATLAS_QUADRANT_SUBDIV_MAX = 7. Shared by all four
 * `positional_shadow_atlas_quad_*` keys, which differ only in which quadrant
 * index they write, not in what value they accept.
 */
const SHADOW_ATLAS_QUADRANT_SUBDIV = {
  0: 'DISABLED',
  1: '1',
  2: '4',
  3: '16',
  4: '64',
  5: '256',
  6: '1024',
};

/** viewport.h:128-135. ANISOTROPY_MAX = 5. */
const ANISOTROPIC_FILTERING = { 0: 'DISABLED', 1: '2X', 2: '4X', 3: '8X', 4: '16X' };

/** viewport.h:99-106. SCALING_3D_MODE_MAX = 5. */
const SCALING_3D_MODE = {
  0: 'BILINEAR',
  1: 'FSR',
  2: 'FSR2',
  3: 'METALFX_SPATIAL',
  4: 'METALFX_TEMPORAL',
};

/** viewport.h:222-227. VRS_MAX = 3. */
const VRS_MODE = { 0: 'DISABLED', 1: 'TEXTURE', 2: 'XR' };

/** viewport.h:229-234. VRS_UPDATE_MAX = 3. */
const VRS_UPDATE_MODE = { 0: 'DISABLED', 1: 'ONCE', 2: 'ALWAYS' };

/**
 * viewport.h:158-186. No `DEBUG_DRAW_MAX` sentinel exists (the enum just ends),
 * so the ceiling is the last member's own value: 27 labels, 0-26.
 */
const DEBUG_DRAW = {
  0: 'DISABLED',
  1: 'UNSHADED',
  2: 'LIGHTING',
  3: 'OVERDRAW',
  4: 'WIREFRAME',
  5: 'NORMAL_BUFFER',
  6: 'VOXEL_GI_ALBEDO',
  7: 'VOXEL_GI_LIGHTING',
  8: 'VOXEL_GI_EMISSION',
  9: 'SHADOW_ATLAS',
  10: 'DIRECTIONAL_SHADOW_ATLAS',
  11: 'SCENE_LUMINANCE',
  12: 'SSAO',
  13: 'SSIL',
  14: 'PSSM_SPLITS',
  15: 'DECAL_ATLAS',
  16: 'SDFGI',
  17: 'SDFGI_PROBES',
  18: 'GI_BUFFER',
  19: 'DISABLE_LOD',
  20: 'CLUSTER_OMNI_LIGHTS',
  21: 'CLUSTER_SPOT_LIGHTS',
  22: 'CLUSTER_DECALS',
  23: 'CLUSTER_REFLECTION_PROBES',
  24: 'OCCLUDERS',
  25: 'MOTION_VECTORS',
  26: 'INTERNAL_BUFFER',
};

/**
 * scene/main/viewport.h:188-193. LINEAR_WITH_MIPMAPS is 2 and
 * NEAREST_WITH_MIPMAPS is 3, the opposite of the order the two names suggest.
 */
const TEXTURE_FILTER = {
  0: 'NEAREST',
  1: 'LINEAR',
  2: 'LINEAR_WITH_MIPMAPS',
  3: 'NEAREST_WITH_MIPMAPS',
  4: 'PARENT_NODE',
};

validatorRegistry.registerAll('Viewport', {
  own_world_3d: v.boolean('own_world_3d'),
  disable_3d: v.boolean('disable_3d'),
  transparent_bg: v.boolean('transparent_bg'),
  handle_input_locally: v.boolean('handle_input_locally'),
  use_debanding: v.boolean('use_debanding'),
  audio_listener_enable_2d: v.boolean('audio_listener_enable_2d'),
  gui_embed_subwindows: v.boolean('gui_embed_subwindows'),
  // viewport.cpp:5166: PROPERTY_HINT_ENUM, 4 labels. set_msaa_3d
  // (viewport.cpp:3763) enforces `ERR_FAIL_INDEX(p_msaa, MSAA_MAX)`, with
  // MSAA_MAX=4 (scene/main/viewport.h:119-125).
  msaa_3d: v.enumInt('msaa_3d', 0, 3, MSAA, { enforced: 'viewport.cpp:3763' }),
  // 4.7.2: viewport.cpp:4101 `ERR_FAIL_INDEX(p_filter,
  // DEFAULT_CANVAS_ITEM_TEXTURE_FILTER_MAX)`, MAX = 5 (viewport.h:191-198).
  // 4.6.3 stops one lower, without PARENT_NODE.
  canvas_item_default_texture_filter: v.enumInt(
    'canvas_item_default_texture_filter',
    0,
    4,
    TEXTURE_FILTER,
    { enforced: 'viewport.cpp:4101' }
  ),

  // Top-level bools, viewport.cpp:5154-5163. Bare assigns, no format beyond
  // true/false.
  use_xr: v.boolean('use_xr'),
  snap_2d_transforms_to_pixel: v.boolean('snap_2d_transforms_to_pixel'),
  snap_2d_vertices_to_pixel: v.boolean('snap_2d_vertices_to_pixel'),

  // "Rendering" group, viewport.cpp:5164-5173.
  // viewport.cpp:3748: `ERR_FAIL_INDEX(p_msaa, MSAA_MAX)`, same enum and
  // guard shape as msaa_3d above.
  msaa_2d: v.enumInt('msaa_2d', 0, 3, MSAA, { enforced: 'viewport.cpp:3748' }),
  // viewport.cpp:3778: `ERR_FAIL_INDEX(p_screen_space_aa, SCREEN_SPACE_AA_MAX)`.
  screen_space_aa: v.enumInt('screen_space_aa', 0, 2, SCREEN_SPACE_AA, {
    enforced: 'viewport.cpp:3778',
  }),
  use_taa: v.boolean('use_taa'),
  use_occlusion_culling: v.boolean('use_occlusion_culling'),
  // viewport.cpp:5171 hints RANGE "0,1024,0.1", both ends closed. set_mesh_lod_threshold
  // (viewport.cpp:3819-3823) bare-assigns, so this is hinted, not enforced.
  mesh_lod_threshold: v.float('mesh_lod_threshold', { min: 0, max: 1024, hinted: 'viewport.cpp:5171' }),
  // viewport.cpp:5172, PROPERTY_HINT_ENUM with 27 labels (0-26, no MAX
  // sentinel). set_debug_draw (viewport.cpp:3847-3850) bare-assigns.
  debug_draw: v.enumInt('debug_draw', 0, 26, DEBUG_DRAW, { hinted: 'viewport.cpp:5172' }),
  use_hdr_2d: v.boolean('use_hdr_2d'),

  // "Scaling 3D" group, viewport.cpp:5177-5181.
  // viewport.cpp:5177, PROPERTY_HINT_ENUM 5 labels. set_scaling_3d_mode
  // (viewport.cpp:4855-4862) bare-assigns, no ERR_FAIL_INDEX.
  scaling_3d_mode: v.enumInt('scaling_3d_mode', 0, 4, SCALING_3D_MODE, {
    hinted: 'viewport.cpp:5177',
  }),
  // `CLAMP(p, 0.1, 2.0)` (viewport.cpp:4875) against the hint `0.25,2.0,0.01`
  // (viewport.cpp:5178): below 0.1 is altered and errors, and [0.1, 0.25) loads
  // but the inspector excludes it, so it warns. Both ceilings are 2.0, so
  // above it only the clamp's error applies.
  scaling_3d_scale: v.float('scaling_3d_scale', {
    min: 0.25,
    max: 2.0,
    enforcedMin: { at: 0.1 },
    enforced: { min: 'viewport.cpp:4875', max: 'viewport.cpp:4875' },
    hinted: { min: 'viewport.cpp:5178' },
  }),
  // viewport.cpp:5179 hints RANGE "-2,2,0.001". set_texture_mipmap_bias
  // (viewport.cpp:4904-4912) bare-assigns.
  texture_mipmap_bias: v.float('texture_mipmap_bias', {
    min: -2,
    max: 2,
    hinted: 'viewport.cpp:5179',
  }),
  // viewport.cpp:5180, PROPERTY_HINT_ENUM 5 labels. set_anisotropic_filtering_level
  // (viewport.cpp:4919-4926) bare-assigns, no ERR_FAIL_INDEX.
  anisotropic_filtering_level: v.enumInt('anisotropic_filtering_level', 0, 4, ANISOTROPIC_FILTERING, {
    hinted: 'viewport.cpp:5180',
  }),
  // set_fsr_sharpness (viewport.cpp:4885-4897) clamps the floor to 0 (error).
  // The ceiling comes only from the RANGE hint "0,2,0.1" (viewport.cpp:5181),
  // which the setter never checks (warning).
  fsr_sharpness: v.float('fsr_sharpness', {
    min: 0,
    max: 2,
    enforced: { min: 'viewport.cpp:4891' },
    hinted: { max: 'viewport.cpp:5181' },
  }),

  // "Variable Rate Shading" group, viewport.cpp:5183-5185. set_vrs_mode and
  // set_vrs_update_mode (viewport.cpp:4027-4067) both bare-assign the member
  // before the switch that reports to RenderingServer, so an out-of-hint value
  // is stored as written: hinted, not enforced.
  vrs_mode: v.enumInt('vrs_mode', 0, 2, VRS_MODE, { hinted: 'viewport.cpp:5183' }),
  vrs_update_mode: v.enumInt('vrs_update_mode', 0, 2, VRS_UPDATE_MODE, {
    hinted: 'viewport.cpp:5184',
  }),
  // viewport.cpp:5185, PROPERTY_HINT_RESOURCE_TYPE "Texture2D". set_vrs_texture
  // (viewport.cpp:4074-4081) bare-assigns; Godot omits the key when cleared.
  vrs_texture: v.resourceReference('vrs_texture'),

  // 4.7.2: viewport.cpp:4184 `ERR_FAIL_INDEX(p_repeat,
  // DEFAULT_CANVAS_ITEM_TEXTURE_REPEAT_MAX)`, MAX = 4 (viewport.h:200-206).
  canvas_item_default_texture_repeat: v.enumInt(
    'canvas_item_default_texture_repeat',
    0,
    3,
    TEXTURE_REPEAT,
    { enforced: 'viewport.cpp:4184' }
  ),

  // "Audio Listener" group, viewport.cpp:5193. Bare bool assign, same shape as
  // audio_listener_enable_2d above.
  audio_listener_enable_3d: v.boolean('audio_listener_enable_3d'),

  // "Physics" group, viewport.cpp:5197-5199. All three bare-assign
  // (viewport.cpp:3609-3643). The `_picking_viewports` group toggle on
  // physics_object_picking is not a value guard.
  physics_object_picking: v.boolean('physics_object_picking'),
  physics_object_picking_sort: v.boolean('physics_object_picking_sort'),
  physics_object_picking_first_only: v.boolean('physics_object_picking_first_only'),

  // "GUI" group, viewport.cpp:5202-5205.
  gui_disable_input: v.boolean('gui_disable_input'),
  gui_snap_controls_to_pixels: v.boolean('gui_snap_controls_to_pixels'),
  // viewport.cpp:5205 carries no PROPERTY_HINT_RANGE, and set_drag_threshold
  // (viewport.cpp:4171-4174) bare-assigns: nothing to ground beyond "integer".
  gui_drag_threshold: v.int('gui_drag_threshold'),

  // "SDF" group, viewport.cpp:5207-5208.
  // viewport.cpp:4202: `ERR_FAIL_INDEX(p_sdf_oversize, SDF_OVERSIZE_MAX)`.
  sdf_oversize: v.enumInt('sdf_oversize', 0, 3, SDF_OVERSIZE, { enforced: 'viewport.cpp:4202' }),
  // viewport.cpp:4214: `ERR_FAIL_INDEX(p_sdf_scale, SDF_SCALE_MAX)`.
  sdf_scale: v.enumInt('sdf_scale', 0, 2, SDF_SCALE, { enforced: 'viewport.cpp:4214' }),

  // "Positional Shadow Atlas" group, viewport.cpp:5210-5215.
  // viewport.cpp:5210 carries no hint, and set_positional_shadow_atlas_size
  // (viewport.cpp:1385-1389) bare-assigns.
  positional_shadow_atlas_size: v.int('positional_shadow_atlas_size'),
  positional_shadow_atlas_16_bits: v.boolean('positional_shadow_atlas_16_bits'),
  // set_positional_shadow_atlas_quadrant_subdiv (viewport.cpp:1410-1413):
  // `ERR_FAIL_INDEX(p_subdiv, SHADOW_ATLAS_QUADRANT_SUBDIV_MAX)` on the value.
  // Its `ERR_FAIL_INDEX(p_quadrant, 4)` is fixed per key and never fails here.
  positional_shadow_atlas_quad_0: v.enumInt(
    'positional_shadow_atlas_quad_0',
    0,
    6,
    SHADOW_ATLAS_QUADRANT_SUBDIV,
    { enforced: 'viewport.cpp:1413' }
  ),
  positional_shadow_atlas_quad_1: v.enumInt(
    'positional_shadow_atlas_quad_1',
    0,
    6,
    SHADOW_ATLAS_QUADRANT_SUBDIV,
    { enforced: 'viewport.cpp:1413' }
  ),
  positional_shadow_atlas_quad_2: v.enumInt(
    'positional_shadow_atlas_quad_2',
    0,
    6,
    SHADOW_ATLAS_QUADRANT_SUBDIV,
    { enforced: 'viewport.cpp:1413' }
  ),
  positional_shadow_atlas_quad_3: v.enumInt(
    'positional_shadow_atlas_quad_3',
    0,
    6,
    SHADOW_ATLAS_QUADRANT_SUBDIV,
    { enforced: 'viewport.cpp:1413' }
  ),

  // viewport.cpp:5218, PROPERTY_HINT_LAYERS_2D_RENDER: a UI-control hint, so
  // out-of-range is a warning, never an error. set_canvas_cull_mask
  // (viewport.cpp:4242-4246) bare-assigns.
  canvas_cull_mask: layerBitmask('canvas_cull_mask', { hinted: 'viewport.cpp:5218', width: 'uint32' /* viewport.h:717 */ }),

  oversampling: v.boolean('oversampling'),
  // viewport.cpp:5221 hints RANGE "0,16,0.0001,or_greater": `or_greater` opens
  // the ceiling, so only the floor is a bound. set_oversampling_override
  // (viewport.cpp:1086-1093) bare-assigns.
  oversampling_override: v.float('oversampling_override', { min: 0, hinted: 'viewport.cpp:5221' }),

  // viewport.cpp:5157, PROPERTY_HINT_RESOURCE_TYPE "World3D". set_world_3d
  // (viewport.cpp:4683-4717) bare-assigns the Ref; Godot omits the key when
  // cleared, so it is never `null` in a written scene.
  world_3d: v.resourceReference('world_3d'),
});
