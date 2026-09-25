/**
 * The base tiers: `CanvasItem`, `Node`, `Node2D`/`Node3D`, `Control` and the
 * light bases. A base has no `parser.ts`, so every key it registers is
 * linter-only here, and `checkParity`'s base-walk hands one entry to every leaf.
 */

import type { AsymmetryEntry } from './types.js';

/**
 * Light3D base validators, registered under 'Light3D' in
 * 3d/lights/shared/linterParser.ts, that the shared parser helpers never read:
 * bake, cull and fine shadow tuning with no effect on the static preview.
 */
const LIGHT3D_LINTER_ONLY_KEYS = [
  'light_bake_mode', 'light_cull_mask', 'light_indirect_energy',
  'shadow_opacity', 'shadow_reverse_cull_face', 'shadow_transmittance_bias',
  // The physical-light-units trio, dead unless the project setting
  // `rendering/lights_and_shadows/use_physical_light_units` is on, which a
  // `.tscn` cannot carry. Light3D's `_validate_property` hides them too.
  'light_intensity_lumens', 'light_intensity_lux', 'light_temperature',
] as const;

/**
 * Light3D keys that change a frozen frame and that the shared parser helpers
 * do not read yet. `editor_only` sits here like its Light2D twin: the light is
 * disabled outside the editor, and this previewer always draws it.
 */
const LIGHT3D_RENDER_GAP_KEYS = [
  // Projects a texture through the light; nothing here samples it.
  'light_projector',
  // Soft-shadow radius and sun angular diameter: one PARAM_SIZE under two names
  // (light_3d.cpp:394 and :395). It defaults to 0 (light_3d.cpp:478), the hard
  // shadows already drawn, so the gap opens only once a scene sets it.
  'light_size',
  'light_angular_distance',
  // Which render layers cast into this light's shadow, distinct from
  // light_cull_mask's "what this light illuminates".
  'shadow_caster_mask',
  // The light LOD system: past distance_fade_begin the light fades out over
  // distance_fade_length and drops its shadow at distance_fade_shadow.
  'distance_fade_enabled', 'distance_fade_begin',
  'distance_fade_shadow', 'distance_fade_length',
  'editor_only',
] as const;

export const baseTypeAsymmetries: Readonly<Record<string, AsymmetryEntry>> = {
  // One entry covers every 2D leaf and every Control.
  CanvasItem: {
    linterOnly: [
      // Culling, clipping and sampler settings with no render equivalent:
      // `visibility_layer` and `clip_children` gate culling and stencil
      // clipping, and the texture sampler modes are set per material rather
      // than per node in three.js.
      'visibility_layer', 'clip_children',
      'texture_filter', 'texture_repeat',
      // canvas_item.cpp:637-656: a shader-reflected instance uniform, typed by
      // the attached ShaderMaterial's GLSL. This previewer has no ShaderMaterial
      // slice, so no parser has a uniform to reflect it onto.
      'instance_shader_parameters/*',
    ],
    reason: 'The CanvasItem base has no parser of its own; these five are culling, clipping, sampler and shader-uniform settings the r3f renderer expresses per material, has no surface for, or not at all, while the keys it DOES render (visible, modulate, z_index, top_level, material…) are read by each family parser.',
  },

  Node: {
    parserOnly: [
      // `parseNode` (node/parser.ts) reads `transform` for every node, and a
      // non-spatial type has no validator for it. On Control, Godot sometimes
      // writes a Transform2D that conflicts with the anchor and offset layout,
      // so it has no validator either.
      'transform',
    ],
    linterOnly: [
      // Pause/process behaviour and thread-group assignment: engine lifecycle,
      // decided at runtime and with no bearing on a still frame.
      'process_mode', 'process_priority', 'process_physics_priority',
      'process_thread_group', 'process_thread_group_order', 'process_thread_messages',
      'physics_interpolation_mode',
      // Editor and localisation metadata the renderer never consults.
      'auto_translate_mode', 'editor_description',
      // `utils/uniqueNames.ts` reads it off `rawProperties` for the `%Name`
      // table a NodePath walk needs. The node's own frame does not depend on
      // it, so node/parser.ts does not carry it.
      'unique_name_in_owner',
    ],
    reason: 'Node is the terminal of every base chain, so its ten validators reach all 240 types; node/parser.ts reads none of them because pause/threading/localisation state has no effect on a rendered frame. One entry here rather than the same ten repeated on every leaf.',
  },

  Node3D: {
    renderGap: [
      // Decides which of basis/scale/quaternion/rotation/rotation_order Godot
      // serialises (node_3d.cpp's _validate_property), so a renderer matching
      // Godot's transform editing needs it. Ours reads `transform` directly.
      'rotation_edit_mode',
    ],
    linterOnly: [
      // Godot serialises spatial state as one `transform` matrix, which the
      // lenient parser reads, or as components, which the linter validates.
      'position', 'rotation', 'rotation_degrees', 'scale', 'quaternion', 'basis',
      // Global-space equivalents Godot writes in some export modes. The
      // renderer uses the local transform.
      'global_transform', 'global_position', 'global_rotation', 'global_rotation_degrees',
      'global_basis',
      // Scene-tree / editor properties with no render effect.
      'rotation_order', 'visibility_parent',
    ],
    reason: 'Parser uses the transform matrix; linter validates discrete component forms and global equivalents that the renderer ignores.',
  },

  // Viewport has no parser.ts of its own; SubViewport and Window inherit these
  // through the base-walk, so one entry here covers both.
  Viewport: {
    linterOnly: [
      // Input routing and 3D audio listening. None of it touches a frozen
      // frame: picking decides which collider a click hits, the gui keys gate
      // and threshold event delivery, and the audio listener is sound.
      'physics_object_picking', 'physics_object_picking_sort',
      'physics_object_picking_first_only',
      'gui_disable_input', 'gui_drag_threshold',
      'audio_listener_enable_3d',
    ],
    renderGap: [
      // Image-forming settings the previewer does not read: antialiasing and
      // scaling, the shadow atlas, VRS, the 2D-lighting SDF, snapping, mipmaps,
      // culling, and the World3D the viewport renders against (apart from the
      // `own_world_3d` flag, which is parsed).
      'msaa_2d', 'screen_space_aa', 'use_taa',
      'scaling_3d_mode', 'scaling_3d_scale', 'fsr_sharpness',
      'texture_mipmap_bias', 'anisotropic_filtering_level',
      'positional_shadow_atlas_size', 'positional_shadow_atlas_16_bits',
      'positional_shadow_atlas_quad_0', 'positional_shadow_atlas_quad_1',
      'positional_shadow_atlas_quad_2', 'positional_shadow_atlas_quad_3',
      'vrs_mode', 'vrs_update_mode', 'vrs_texture',
      'sdf_oversize', 'sdf_scale',
      'snap_2d_transforms_to_pixel', 'snap_2d_vertices_to_pixel',
      'gui_snap_controls_to_pixels',
      'canvas_cull_mask', 'canvas_item_default_texture_repeat',
      'mesh_lod_threshold', 'use_occlusion_culling', 'use_hdr_2d',
      'oversampling', 'oversampling_override',
      'debug_draw', 'use_xr', 'world_3d',
    ],
    reason: 'Viewport is a base with no parser of its own. The picking/gui/audio keys are input and sound routing with no frozen-frame effect; the rest form the image (antialiasing, scaling, shadow atlas, VRS, SDF, snapping, culling) and are unimplemented.',
  },

  Light3D: {
    linterOnly: LIGHT3D_LINTER_ONLY_KEYS,
    renderGap: LIGHT3D_RENDER_GAP_KEYS,
    reason: 'Light3D base validators live in 3d/lights/shared/linterParser.ts and reach every concrete light via the base-walk, so one entry here covers all four leaves. Bake/cull-mask, fine shadow tuning and the physical-light-units trio are runtime-only; the projector, the two soft-shadow sizes, the caster mask and the distance-fade group do change the frame and are simply unimplemented.',
  },

  Light2D: {
    renderGap: [
      // Godot disables the light outside the editor when this is set
      // (`_update_light_visibility`, light_2d.cpp: the non-TOOLS branch sets
      // editor_ok = false). This previewer always draws the light.
      'editor_only',
    ],
    reason: 'Light2D base validators live in 2d/lights/shared/linterParser.ts and reach PointLight2D and DirectionalLight2D via the base-walk; editor_only gates the light at runtime and no parser here reads it.',
  },

  PointLight2D: {
    renderGap: [
      // The light's Z, the third light-vector component in the normal-map
      // branch (canvas.glsl:808) and the custom-light-shader branch
      // (LIGHT_CODE_USED, canvas.glsl:799). This previewer implements neither.
      'height',
    ],
    reason:
      'height only alters the picture through normal mapping or a custom light shader, neither of which this previewer implements, so its cookie render never reads the key.',
  },

  Node2D: {
    parserOnly: [
      // Meaningful only for TileMapLayer tiles, and any number is valid.
      'y_sort_origin',
    ],
    linterOnly: [
      // Global-space equivalents. The renderer uses the local transform and
      // draw order.
      'global_position', 'global_rotation', 'global_rotation_degrees',
      'global_scale', 'global_skew', 'global_transform',
    ],
    reason: 'Parser reads y_sort_origin, which any number satisfies; linter validates global-space properties the renderer ignores.',
  },

  OptionButton: {
    linterOnly: [
      // Read through a computed key, `properties[`popup/item_${i}/text`]`, which
      // the scrape of fixed key strings cannot match.
      'popup/item_#/*',
      // Reselecting an already-selected item is an interaction, so a frozen
      // frame cannot show it.
      'allow_reselect',
    ],
    renderGap: [
      // Sizes the button to its widest item, so it changes the control's width
      // in a static frame.
      'fit_to_longest_item',
    ],
    reason: 'The item family is read through a computed key the scrape cannot match; allow_reselect is interaction-only, while fit_to_longest_item changes the rendered width and is not implemented yet.',
  },

  CenterContainer: {
    renderGap: [
    ],
    reason: 'use_top_left moves the centring origin to the container top-left corner (center_container.cpp:83); the DOM overlay has no equivalent mode yet, so no parser reads it.',
  },

  Control: {
    linterOnly: [
      // From the CanvasItem tier: the UI overlay is DOM (ADR-0003), with no 2D
      // draw order or lighting. The Node2D family renders these, so they sit
      // on Control, not the shared tier.
      'z_as_relative', 'y_sort_enabled',
      'material', 'use_parent_material',
      // Input routing and assistive tech touch no frozen frame: accessibility,
      // focus order, shortcut context, the mouse keys and the tooltip.
      'accessibility_name', 'accessibility_description', 'accessibility_live',
      'accessibility_controls_nodes', 'accessibility_described_by_nodes',
      'accessibility_labeled_by_nodes', 'accessibility_flow_to_nodes',
      'focus_behavior_recursive', 'focus_neighbor_left', 'focus_neighbor_top',
      'focus_neighbor_right', 'focus_neighbor_bottom', 'focus_next', 'focus_previous',
      'shortcut_context',
      'mouse_behavior_recursive', 'mouse_default_cursor_shape',
      'mouse_force_pass_scroll_events',
      'tooltip_text', 'tooltip_auto_translate_mode',
      // The parser loops over `theme_override_*/*`, so no fixed key is scraped.
      'theme_override_colors/*', 'theme_override_constants/*',
      'theme_override_font_sizes/*', 'theme_override_styles/*',
      'theme_override_fonts/*', 'theme_override_icons/*',
      // Keyboard focus and mouse handling change no pixel in a frozen scene,
      // while the linter checks the values Godot enforces (control.cpp:2267,
      // control.cpp:1923).
      'focus_mode', 'mouse_filter',
    ],
    renderGap: [
      // Both change what Godot draws, for every Control below here.
      // `clip_contents` sets the canvas clip rect, and
      // `localize_numeral_system` swaps the numeral glyphs ProgressBar,
      // SpinBox, CodeEdit and RichTextLabel draw.
      'clip_contents',
      'localize_numeral_system',
    ],
    reason: 'Control parser reads transform for compatibility but linter does not validate it; the theme-override keys are wildcard-matched in the linter and loop-scraped in the parser, so they have no per-key surface to compare. The accessibility, focus, mouse and tooltip keys are input and assistive-tech surfaces with no frozen-frame effect, while the clip and numeral-system keys genuinely change the drawing and are unimplemented.',
  },
};
