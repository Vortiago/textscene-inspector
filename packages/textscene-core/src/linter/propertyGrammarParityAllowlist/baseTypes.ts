/**
 * The base tiers: `CanvasItem`, `Node`, `Node2D`/`Node3D`, `Control` and the
 * light bases.
 *
 * These entries carry the most weight in the table. A base has no `parser.ts`
 * of its own, so from its own perspective every key it registers is
 * linter-only, and one entry here is inherited by every leaf below it through
 * the base-walk in `checkParity` — which is what keeps forty near-identical
 * leaf entries from existing.
 */

import type { AsymmetryEntry } from './types.js';

/**
 * Light3D base validators (registered once under the abstract 'Light3D' key
 * in 3d/lights/shared/linterParser.ts and inherited by every concrete light
 * via the base-walk) that the shared parser helpers never read: bake/cull and
 * fine shadow-tuning properties with no effect on the static preview.
 */
const LIGHT3D_LINTER_ONLY_KEYS = [
  'light_bake_mode', 'light_cull_mask', 'light_indirect_energy',
  'shadow_opacity', 'shadow_reverse_cull_face', 'shadow_transmittance_bias',
  // The physical-light-units trio. All three are dead unless the project
  // setting `rendering/lights_and_shadows/use_physical_light_units` is on, and
  // a `.tscn` carries no project settings, so under the defaults this
  // previewer reads they change nothing that is drawn. Light3D's
  // `_validate_property` hides them for the same reason.
  'light_intensity_lumens', 'light_intensity_lux', 'light_temperature',
] as const;

/**
 * Light3D keys that DO change a frozen frame, and that the shared parser
 * helpers do not read yet.
 *
 * `editor_only` is here rather than beside the runtime-only keys above because
 * its 2D twin already made that call: Light2D disables the light outside the
 * editor, so the scene renders darker in game than in the editor, and this
 * previewer always draws it. Light3D's mechanism is the same one, and splitting
 * the pair across the two lists would be the divergence, not the consistency.
 */
const LIGHT3D_RENDER_GAP_KEYS = [
  // Projects a texture through the light; nothing here samples it.
  'light_projector',
  // Soft-shadow radius and sun angular diameter: ONE param under two names,
  // both bound to PARAM_SIZE (light_3d.cpp:394 and :395), which is why
  // `_validate_property` shows whichever suits the light type. It defaults to 0
  // (light_3d.cpp:478), so a scene that never sets it has the hard shadows we
  // already draw, and the gap opens only once a scene does set it.
  'light_size',
  'light_angular_distance',
  // Which render layers cast INTO this light's shadow, distinct from
  // light_cull_mask's "what this light illuminates".
  'shadow_caster_mask',
  // The light LOD system: past distance_fade_begin the light fades out over
  // distance_fade_length and drops its shadow at distance_fade_shadow.
  'distance_fade_enabled', 'distance_fade_begin',
  'distance_fade_shadow', 'distance_fade_length',
  'editor_only',
] as const;

export const baseTypeAsymmetries: Readonly<Record<string, AsymmetryEntry>> = {
  // -------------------------------------------------------------------------
  // Base types
  // -------------------------------------------------------------------------

  // The CanvasItem tier has no parser.ts of its own, so from its perspective
  // every key it registers is linter-only, and one entry here covers every 2D
  // leaf and every Control instead of forty near-identical copies.
  CanvasItem: {
    linterOnly: [
      // Culling, clipping and sampler settings with no render equivalent:
      // `visibility_layer` and `clip_children` gate culling and stencil
      // clipping, and the texture sampler modes are set per material rather
      // than per node in three.js.
      'visibility_layer', 'clip_children',
      'texture_filter', 'texture_repeat',
      // canvas_item.cpp:637-656: a shader-reflected instance uniform, typed by
      // whatever GLSL the attached ShaderMaterial declares. This previewer has
      // no ShaderMaterial resource slice at all (no custom-shader rendering
      // surface exists), so there is nothing for any parser to reflect a
      // uniform override onto.
      'instance_shader_parameters/*',
    ],
    reason: 'The CanvasItem base has no parser of its own; these five are culling, clipping, sampler and shader-uniform settings the r3f renderer expresses per material, has no surface for, or not at all, while the keys it DOES render (visible, modulate, z_index, top_level, material…) are read by each family parser.',
  },

  Node: {
    parserOnly: [
      // `parseNode` (node/parser.ts) reads `transform` for every node, but a
      // plain Node is not spatial and registers no spatial validator, so the
      // key is parser-only on Node and on every non-spatial type below it.
      // Control is the same case for a different reason: Godot sometimes emits
      // a Transform2D there and the parser reads it for compatibility, but it
      // conflicts with the anchor/offset layout model so no validator exists.
      // One entry here, inherited by NavigationAgent3D, WorldEnvironment, Timer,
      // SubViewport, AnimationPlayer, AnimationTree, AudioStreamPlayer and
      // Control rather than repeated on each.
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
      // The render path DOES consult this one, just not as a typed property:
      // `utils/uniqueNames.ts` reads it off `rawProperties` to build the `%Name`
      // claim table a NodePath walk needs. Nothing about the node's own frame
      // depends on it, so node/parser.ts has no reason to carry it.
      'unique_name_in_owner',
    ],
    reason: 'Node is the terminal of every base chain, so its ten validators reach all 240 types; node/parser.ts reads none of them because pause/threading/localisation state has no effect on a rendered frame. One entry here rather than the same ten repeated on every leaf.',
  },

  Node3D: {
    renderGap: [
      // Decides which of basis/scale/quaternion/rotation/rotation_order Godot
      // SERIALISES (node_3d.cpp's _validate_property), so a renderer matching
      // Godot's transform editing needs it. Ours reads `transform` directly.
      'rotation_edit_mode',
    ],
    linterOnly: [
      // Godot serialises spatial state as either a single `transform` matrix
      // (what the lenient parser reads) or as discrete components; the linter
      // validates the component form so each property is individually
      // checkable, but the renderer only needs the matrix.
      'position', 'rotation', 'rotation_degrees', 'scale', 'quaternion', 'basis',
      // Global-space equivalents — Godot writes these in some export modes;
      // the renderer ignores them (uses local transform).
      'global_transform', 'global_position', 'global_rotation', 'global_rotation_degrees',
      'global_basis',
      // Scene-tree / editor properties with no render effect.
      'top_level', 'rotation_order', 'visibility_parent',
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
      // Everything else Viewport declares is an image-forming setting the
      // previewer does not read: the antialiasing and scaling stack, the
      // shadow atlas, variable-rate shading, the SDF used by 2D lighting,
      // pixel snapping, mipmap and anisotropy control, occlusion culling, and
      // the World3D that decides which lights and environment the viewport
      // renders against (distinct from the `own_world_3d` flag we do parse).
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
      // Godot DISABLES the light outside the editor when this is set
      // (`_update_light_visibility`, light_2d.cpp — the non-TOOLS branch sets
      // editor_ok = false), so a scene with an editor-only light renders darker
      // in game than in the editor. This previewer always draws the light.
      'editor_only',
    ],
    reason: 'Light2D base validators live in 2d/lights/shared/linterParser.ts and reach PointLight2D and DirectionalLight2D via the base-walk; editor_only gates the light at runtime and no parser here reads it.',
  },

  PointLight2D: {
    renderGap: [
      // The light's Z, and it is NOT inert in Godot: it reaches the canvas
      // shader as the third light-vector component on two paths — the
      // normal-map branch (canvas.glsl:808) and the custom-light-shader branch
      // (LIGHT_CODE_USED, canvas.glsl:799). This previewer implements neither,
      // so the value changes nothing HERE while changing the picture in Godot,
      // which is a gap rather than deliberate scope.
      'height',
    ],
    reason:
      'height only alters the picture through normal mapping or a custom light shader, neither of which this previewer implements, so its cookie render never reads the key.',
  },

  Node2D: {
    parserOnly: [
      // y_sort_origin only meaningful for TileMapLayer tiles; no linter
      // validator needed (any number is valid).
      'y_sort_origin',
    ],
    linterOnly: [
      // Global-space equivalents — valid TSCN but the renderer ignores them
      // (uses local transform / draw order).
      'global_position', 'global_rotation', 'global_rotation_degrees',
      'global_scale', 'global_skew', 'global_transform',
    ],
    reason: 'Parser reads y_sort_origin, which any number satisfies; linter validates global-space properties the renderer ignores.',
  },

  OptionButton: {
    linterOnly: [
      // Read through a computed key, `properties[`popup/item_${i}/text`]`, which
      // the guard's scrape of fixed key strings cannot match. The parser DOES
      // read these; only the scrape is blind to how.
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
      // Inherited from the CanvasItem tier and genuinely unread on this side:
      // the UI overlay is DOM (ADR-0003), where 2D canvas draw-order and
      // lighting have no equivalent. The Node2D family DOES render these, which
      // is why they sit here on Control rather than on the shared tier.
      'z_as_relative', 'y_sort_enabled',
      'material', 'use_parent_material',
      // Theme-override wildcard keys — validated by pattern match in the
      // linter; the parser uses a loop over `theme_override_*/*` keys and
      // there is no fixed per-key scraping surface to compare against.
      // Input routing and assistive tech, none of which touches a frozen frame:
      // the accessibility tree is a screen-reader surface, focus order and the
      // shortcut context steer keyboard/gamepad navigation, the mouse keys pick
      // an OS cursor and decide who consumes an event, and a tooltip is a hover
      // popup rather than scene content.
      'accessibility_name', 'accessibility_description', 'accessibility_live',
      'accessibility_controls_nodes', 'accessibility_described_by_nodes',
      'accessibility_labeled_by_nodes', 'accessibility_flow_to_nodes',
      'focus_behavior_recursive', 'focus_neighbor_left', 'focus_neighbor_top',
      'focus_neighbor_right', 'focus_neighbor_bottom', 'focus_next', 'focus_previous',
      'shortcut_context',
      'mouse_behavior_recursive', 'mouse_default_cursor_shape',
      'mouse_force_pass_scroll_events',
      'tooltip_text', 'tooltip_auto_translate_mode',
      'theme_override_colors/*', 'theme_override_constants/*',
      'theme_override_font_sizes/*', 'theme_override_styles/*',
      'theme_override_fonts/*', 'theme_override_icons/*',
      // Input concerns with no render surface at all: nothing about which control
      // takes keyboard focus, or how it swallows a mouse event, changes a pixel in
      // a frozen scene, so no parser reads either while the linter still checks
      // the values Godot enforces (control.cpp:2267, control.cpp:1923). These two
      // entries cover every Control descendant.
      'focus_mode', 'mouse_filter',
    ],
    renderGap: [
      // Both DO change what Godot draws, for every Control below here.
      // `clip_contents` sets the canvas clip rect, and
      // `localize_numeral_system` swaps the numeral glyphs ProgressBar,
      // SpinBox, CodeEdit and RichTextLabel draw.
      'clip_contents',
      'localize_numeral_system',
    ],
    reason: 'Control parser reads transform for compatibility but linter does not validate it; the theme-override keys are wildcard-matched in the linter and loop-scraped in the parser, so they have no per-key surface to compare. The accessibility, focus, mouse and tooltip keys are input and assistive-tech surfaces with no frozen-frame effect, while the clip and numeral-system keys genuinely change the drawing and are unimplemented.',
  },
};
