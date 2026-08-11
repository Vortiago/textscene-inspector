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
      // Editor/scene-tree concerns with no render equivalent: `top_level`
      // detaches from the parent transform (the dispatcher does not model it),
      // `visibility_layer` and `clip_children` gate culling and stencil
      // clipping, and the texture sampler modes are set per material rather
      // than per node in three.js.
      'top_level', 'visibility_layer', 'clip_children',
      'texture_filter', 'texture_repeat',
      // canvas_item.cpp:637-656: a shader-reflected instance uniform, typed by
      // whatever GLSL the attached ShaderMaterial declares. This previewer has
      // no ShaderMaterial resource slice at all (no custom-shader rendering
      // surface exists), so there is nothing for any parser to reflect a
      // uniform override onto.
      'instance_shader_parameters/*',
    ],
    reason: 'The CanvasItem base has no parser of its own; these six are culling, clipping, sampler and shader-uniform settings the r3f renderer expresses per material, has no surface for, or not at all, while the keys it DOES render (visible, modulate, z_index, material…) are read by each family parser.',
  },

  Node: {
    parserOnly: [
      // `parseNode` (node/parser.ts) reads `transform` for every node, but a
      // plain Node is not spatial and registers no spatial validator, so the
      // key is parser-only on Node and on every non-spatial type below it.
      // Control is the same case for a different reason: Godot sometimes emits
      // a Transform2D there and the parser reads it for compatibility, but it
      // conflicts with the anchor/offset layout model so no validator exists.
      // One entry here replaces the identical per-type entries NavigationAgent3D,
      // WorldEnvironment, Timer, SubViewport, AnimationPlayer, AnimationTree,
      // AudioStreamPlayer and Control each used to carry.
      'transform',
    ],
    linterOnly: [
      // Pause/process behaviour and thread-group assignment: engine lifecycle,
      // decided at runtime and with no bearing on a still frame.
      'process_mode', 'process_priority', 'process_physics_priority',
      'process_thread_group', 'process_thread_group_order', 'process_thread_messages',
      'physics_interpolation_mode',
      // Editor and localisation metadata the renderer never consults.
      'auto_translate_mode', 'editor_description', 'unique_name_in_owner',
    ],
    reason: 'Node is the terminal of every base chain, so its ten validators reach all 240 types; node/parser.ts reads none of them because pause/threading/localisation state has no effect on a rendered frame. One entry here rather than the same ten repeated on every leaf.',
  },

  Node3D: {
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
    reason: 'height only alters the picture through normal mapping or a custom light shader, neither of which this previewer implements, so its cookie render never reads the key.',
  },

  Node2D: {
    parserOnly: [
      // y_sort_origin only meaningful for TileMapLayer tiles; no linter
      // validator needed (any number is valid). The CanvasItem tint and
      // draw-order keys that used to sit here are validated now — they moved to
      // the CanvasItem tier, which both families inherit.
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
      // in a static frame. Previously grouped with allow_reselect under "nothing
      // changes a pixel", which was simply wrong about this one.
      'fit_to_longest_item',
    ],
    reason: 'The item family is read through a computed key the scrape cannot match; allow_reselect is interaction-only, while fit_to_longest_item changes the rendered width and is not implemented yet.',
  },

  CenterContainer: {
    renderGap: [
      // `use_top_left` moves the centring ORIGIN to the container's top-left
      // corner (center_container.cpp:83), and the DOM overlay hard-codes centred
      // flex alignment with no equivalent mode, so no parser reads it. Godot
      // accepts the value, so the linter validates it.
      'use_top_left',
    ],
    reason: 'use_top_left moves the centring origin to the container top-left corner (center_container.cpp:83); the DOM overlay has no equivalent mode yet, so no parser reads it.',
  },

  Control: {
    linterOnly: [
      // Inherited from the CanvasItem tier and genuinely unread on this side:
      // the UI overlay is DOM (ADR-0003), where 2D canvas draw-order and
      // lighting have no equivalent. The Node2D family DOES render these, which
      // is why they sit here on Control rather than on the shared tier.
      'z_index', 'z_as_relative', 'y_sort_enabled', 'show_behind_parent',
      'light_mask', 'material', 'use_parent_material',
      // (`modulate`, `self_modulate`, `rotation`, `scale` and `pivot_offset`
      // used to sit here as "not read by the parser for rendering"; they are
      // all rendered now.)
      // Theme-override wildcard keys — validated by pattern match in the
      // linter; the parser uses a loop over `theme_override_*/*` keys and
      // there is no fixed per-key scraping surface to compare against.
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
    reason: 'Control parser reads transform for compatibility but linter does not validate it; the theme-override keys are wildcard-matched in the linter and loop-scraped in the parser, so they have no per-key surface to compare.',
  },
};
