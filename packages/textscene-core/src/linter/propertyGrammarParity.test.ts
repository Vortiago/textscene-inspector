/**
 * Property-grammar parity guard.
 *
 * For every slice that has both `parser.ts` and `linterParser.ts`, asserts
 * that the set of property names read by the parser (via `properties.X`)
 * matches the set of validator keys registered for that node type.
 *
 * Each side is augmented by the inherited set its ancestor contributes:
 *   - Validator keys: walk NODE_BASE_TYPES and collect each base type's
 *     own registered keys via `validatorRegistry.getOwnKeys()`.
 *   - Parser properties: walk NODE_BASE_TYPES and scrape each base type's
 *     `parser.ts` file for `properties.X` accesses.
 *
 * Legitimate asymmetries are recorded in ASYMMETRY_ALLOWLIST below.  Every
 * entry carries a one-line justification and doubles as the inventory that
 * feeds the descriptor-DSL pilot design.
 *
 * Desync detection:
 *   - A parser-only key not in the allowlist means a property was added to
 *     `parser.ts` but the matching validator was never registered.
 *   - A linter-only key not in the allowlist means a validator key was added
 *     to `linterParser.ts` but the parser never reads it (potential dead
 *     validator if the property is also not inherited).
 */

import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { baseChain } from './nodeBaseTypes.js';
import { PARAM_SLOTS } from '../nodes/2d/cpuparticles2d/types.js';
import { validatorRegistry } from './ValidatorRegistry.js';
import './index.js';

const here = dirname(fileURLToPath(import.meta.url));
const nodesRoot = resolve(here, '../nodes');

// ---------------------------------------------------------------------------
// Base-type to parser directory mapping.
// Used to walk the inherited parser property chain in parallel with the
// NODE_BASE_TYPES validator chain.
// ---------------------------------------------------------------------------

const BASE_TYPE_TO_PARSER_SUBPATH: Readonly<Record<string, string>> = {
  Node3D: 'base/node3d/parser.ts',
  Node2D: 'base/node2d/parser.ts',
  Light3D: '3d/lights/shared/parser.ts',
  // Button owns a parser.ts of its own, so a Button subclass that chains through
  // `parseButton` really does read `text`/`flat`/`alignment`/the icon trio.
  // Leaving this hop out made every one of those look linter-only on any such
  // subclass, which reads as a validator desync when the parser is fine.
  Button: '2d/ui/button/parser.ts',
  Control: '2d/ui/control/parser.ts',
  Node: 'node/parser.ts',
};

// ---------------------------------------------------------------------------
// Allowlist of known, justified asymmetries.
//
// "parserOnly"  — parser reads this property for rendering but no linter
//                 validator is registered (acceptable: the renderer needs it,
//                 the linter has nothing to check).
// "linterOnly"  — linter validates this key and the parser never reads it
//                 BECAUSE THERE IS NOTHING TO READ: the property cannot change
//                 a frozen frame.
// "renderGap"   — linter validates this key, the property DOES change a frozen
//                 frame, and the renderer has not implemented it yet.
//
// The last two both suppress the failure, so the split is not about the guard:
// it is about not letting a bug masquerade as a decision. Pick by asking one
// question — would Godot draw this scene differently? — and never by asking
// whether the key looks important.
//
// Shared keys that span every Node2D or Node3D leaf are recorded on the base
// type (Node2D / Node3D) and inherited automatically; leaf-specific entries
// only contain keys that are unique to that slice.
// ---------------------------------------------------------------------------

interface AsymmetryEntry {
  parserOnly?: readonly string[];
  /**
   * Validated but not read, BY DESIGN: the property cannot change a frozen
   * frame, so there is nothing for a parser to do with it. Focus order, mouse
   * filtering, context menus, threading, clipboard behaviour.
   */
  linterOnly?: readonly string[];
  /**
   * Validated but not read, and it SHOULD be: the property does change a frozen
   * frame and the renderer simply does not implement it yet.
   *
   * Split out from `linterOnly` because collapsing the two is how a parser bug
   * hides. `OptionButton`'s `item_*` keys sat in a "limitations" list reading
   * like deliberate scope while the real cause was `parseOptionButton` chaining
   * `parseControl` instead of `parseButton` and dropping six lines. A reviewer
   * scanning one undifferentiated list has no way to tell "we decided not to"
   * from "this is broken".
   *
   * The stale check below is the payoff: the day someone renders one of these,
   * the guard fails until the key is removed, so the list can only shrink by
   * the gap actually closing.
   */
  renderGap?: readonly string[];
  reason: string;
}

/**
 * Light3D base validators (registered once under the abstract 'Light3D' key
 * in 3d/lights/shared/linterParser.ts and inherited by every concrete light
 * via the base-walk) that the shared parser helpers never read: bake/cull and
 * fine shadow-tuning properties with no effect on the static preview.
 */
const LIGHT3D_LINTER_ONLY_KEYS = [
  'light_bake_mode', 'light_cull_mask', 'light_indirect_energy',
  'shadow_opacity', 'shadow_reverse_cull_face', 'shadow_transmittance_bias',
] as const;

/**
 * Keys read by the parseAudioBase shared helper (not captured by the per-file
 * scrape of each audio player's parser.ts); each linterParser.ts registers
 * them explicitly.
 */
/**
 * CPUParticles2D's twelve parameter slots. `parser.ts` reads every one of
 * `<prefix>_min` / `_max` / `_curve`, but through a TABLE
 * (`properties[`${prefix}_min`]`) rather than a literal access, so the
 * `properties.X` scrape sees none of them — the same blind spot as the audio
 * base helper below. Derived from the parser's OWN table, so a renamed prefix or
 * a dropped slot moves both sides at once instead of leaving the allowlist
 * asserting coverage of a key nothing reads any more.
 */
const PARTICLE_PARAM_KEYS: readonly string[] = PARAM_SLOTS.flatMap(({ prefix, curve }) => [
  `${prefix}_min`,
  `${prefix}_max`,
  ...(curve ? [`${prefix}_curve`] : []),
]);

const AUDIO_BASE_KEYS = [
  'stream', 'volume_db', 'pitch_scale', 'playing', 'autoplay',
  'stream_paused', 'bus', 'max_polyphony',
] as const;

const ASYMMETRY_ALLOWLIST: Readonly<Record<string, AsymmetryEntry>> = {
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
    ],
    reason: 'The CanvasItem base has no parser of its own; these five are culling, clipping and sampler settings the r3f renderer expresses per material or not at all, while the keys it DOES render (visible, modulate, z_index, material…) are read by each family parser.',
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
    reason: 'Light3D base validators live in 3d/lights/shared/linterParser.ts and reach every concrete light via the base-walk; bake/cull-mask and fine shadow-tuning keys are runtime-only, so the shared parser helpers never read them.',
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

  // -------------------------------------------------------------------------
  // Text-bearing Control leaves
  //
  // These four share a shape: the overlay renders the text and lets the browser
  // shape it, so wrapping, BiDi and locale are delegated rather than missing,
  // while everything about carets, selection, context menus and virtual
  // keyboards has no frozen-frame surface at all. What is left over after those
  // two groups is the real render gap, and it is listed as such.
  // -------------------------------------------------------------------------

  Label: {
    linterOnly: [
      // Shaping delegated to the browser, exactly as the Button entry above.
      'autowrap_trim_flags', 'clip_text', 'ellipsis_char', 'justification_flags',
      'tab_stops', 'text_overrun_behavior',
      // BiDi and locale.
      'language', 'structured_text_bidi_override', 'structured_text_bidi_override_options',
      'text_direction',
    ],
    renderGap: [
      // A LabelSettings resource carries font, size, colour and outline, none of
      // which the overlay's CSS defaults reproduce.
      'label_settings',
      // Each of these changes which characters are on screen: a window into the
      // paragraph (lines_skipped, max_lines_visible), a custom split point
      // (paragraph_separator), or a typewriter reveal frozen part-way
      // (visible_characters and its two companions).
      'lines_skipped', 'max_lines_visible', 'paragraph_separator',
      'visible_characters', 'visible_characters_behavior', 'visible_ratio',
    ],
    reason: 'The overlay renders the label as DOM text, so shaping, BiDi and locale are delegated; label_settings, the line window and the visible-character reveal all change the frozen frame and are not implemented yet.',
  },

  LineEdit: {
    linterOnly: [
      // Caret appearance and movement, none of it drawn in an unfocused frame.
      'caret_blink', 'caret_blink_interval', 'caret_column', 'caret_mid_grapheme',
      // Selection, clipboard and context-menu interaction.
      'context_menu_enabled', 'deselect_on_focus_loss_enabled',
      'drag_and_drop_selection_enabled', 'emoji_menu_enabled',
      'keep_editing_on_text_submit', 'middle_mouse_paste_enabled',
      'select_all_on_focus', 'selecting_enabled', 'shortcut_keys_enabled',
      'backspace_deletes_composite_character_enabled',
      // Virtual keyboard: a mobile input affordance with no rendered surface.
      'virtual_keyboard_enabled', 'virtual_keyboard_show_on_focus', 'virtual_keyboard_type',
      // BiDi and locale, delegated as above.
      'language', 'structured_text_bidi_override', 'structured_text_bidi_override_options',
      'text_direction',
    ],
    renderGap: [
      // Draws a caret even unfocused, which is the one caret property a static
      // frame does show.
      'caret_force_displayed',
      // Each of these adds or resizes something visible: the inline clear
      // button, the trailing icon and its scaling, control characters drawn as
      // glyphs, and the field sizing itself to its content.
      'clear_button_enabled', 'draw_control_chars', 'expand_to_text_length',
      'icon_expand_mode', 'right_icon', 'right_icon_scale',
      // set_max_length re-runs set_text (line_edit.cpp:2523), which truncates,
      // so an over-long `text` renders shortened in Godot and in full here.
      'max_length',
    ],
    reason: 'Carets, selection, clipboard and virtual-keyboard behaviour have no frozen-frame surface, and shaping is delegated to the browser; the trailing icon, clear button, control-character glyphs, content sizing and max_length truncation all change the frame and are not implemented yet.',
  },

  RichTextLabel: {
    linterOnly: [
      // Shaping and BiDi delegated to the browser.
      'autowrap_mode', 'autowrap_trim_flags', 'justification_flags', 'tab_size',
      'tab_stops', 'language', 'structured_text_bidi_override',
      'structured_text_bidi_override_options', 'text_direction',
      // Selection and context-menu interaction.
      'context_menu_enabled', 'deselect_on_focus_loss_enabled',
      'drag_and_drop_selection_enabled', 'selection_enabled', 'shortcut_keys_enabled',
      // Threaded layout and the delay before its progress bar appears: both are
      // about how the layout is computed, not what it looks like when done.
      'threaded', 'progress_bar_delay',
    ],
    renderGap: [
      // Alignment of the whole document within the control.
      'horizontal_alignment', 'vertical_alignment',
      // Underlines actually drawn under [url] and [hint] spans.
      'hint_underlined', 'meta_underlined',
      // Custom BBCode effect resources, which change how their spans draw.
      'custom_effects',
      // Scroll state decides which part of a long document is on screen, and
      // whether a scrollbar is drawn beside it.
      'scroll_active', 'scroll_following', 'scroll_following_visible_characters',
      // The typewriter reveal, as on Label.
      'visible_characters', 'visible_characters_behavior', 'visible_ratio',
    ],
    reason: 'Shaping, BiDi, selection and threaded layout have no frozen-frame surface; document alignment, span underlines, custom effects, scroll position and the visible-character reveal all change the frame and are not implemented yet.',
  },

  ScrollContainer: {
    linterOnly: [
      // Input tuning: how far a drag must travel before it scrolls, how big a
      // wheel step is, and whether focusing a child scrolls it into view. All
      // three need an interaction to have any effect.
      'follow_focus', 'scroll_deadzone',
      'scroll_horizontal_custom_step', 'scroll_vertical_custom_step',
    ],
    renderGap: [
      // A scene saved mid-scroll renders unscrolled here.
      'scroll_horizontal', 'scroll_vertical',
      // Both drive set_visible() on the hint nodes (scroll_container.cpp:623),
      // and the focus border is drawn outright.
      'draw_focus_border', 'scroll_hint_mode', 'tile_scroll_hint',
    ],
    reason: 'Deadzone, wheel step and follow-focus need an interaction to matter; the scroll offsets, the scroll hints and the focus border are all drawn by Godot in a static frame and are not implemented yet.',
  },

  // -------------------------------------------------------------------------
  // 2D leaf slices
  // -------------------------------------------------------------------------

  AnimatedSprite2D: {
    linterOnly: [
      // Playback-state properties: valid in TSCN but the renderer reads the
      // initial frame directly; runtime playback is not modelled.
      'autoplay', 'playing', 'frame_progress', 'speed_scale',
    ],
    reason: 'AnimatedSprite2D linter validates runtime playback properties (autoplay, playing, speed_scale, frame_progress) that the static renderer ignores.',
  },

  Camera2D: {
    linterOnly: [
      // Viewport behaviour / editor aids: valid TSCN keys with no effect
      // on the static scene preview.
      // (`limit_left/top/right/bottom` used to sit here; the Cameras panel
      // clamps the framed view to them now.)
      'ignore_rotation', 'process_callback', 'limit_smoothed',
      'position_smoothing_enabled', 'position_smoothing_speed',
      'rotation_smoothing_enabled', 'rotation_smoothing_speed',
      'drag_horizontal_enabled', 'drag_vertical_enabled',
      'drag_horizontal_offset', 'drag_vertical_offset',
      'drag_left_margin', 'drag_right_margin', 'drag_top_margin', 'drag_bottom_margin',
      'editor_draw_limits', 'editor_draw_screen', 'editor_draw_drag_margin',
    ],
    reason: 'Camera2D linter validates follow/drag/smoothing properties that only matter at runtime; the static previewer ignores them.',
  },

  Line2D: {
    parserOnly: [
      // PackedVector2Array body: complex binary-encoded data with no
      // per-key validator available (same convention as Polygon2D.polygon).
      'points',
    ],
    reason: 'Line2D points is a PackedVector2Array (opaque encoded data); no format validator exists for packed arrays.',
  },

  Polygon2D: {
    parserOnly: [
      // PackedVector2Array / Array-of-PackedInt32Array / PackedColorArray
      // bodies (same pattern as Line2D.points above): opaque encoded data with
      // no per-key grammar. (`uv` used to sit here; it has one now.)
      'polygon', 'polygons', 'vertex_colors',
    ],
    linterOnly: [
      // Display tweak with no rendering parity requirement. (`invert_enabled`,
      // `invert_border` and the whole texture transform used to sit here; all
      // are rendered now.)
      'antialiased',
    ],
    reason: 'polygon/polygons/vertex_colors are encoded packed arrays with no per-key grammar; antialiased is a display tweak the renderer has no equivalent for.',
  },

  CPUParticles2D: {
    parserOnly: [
      // Godot's setter takes ANY int and reads everything but 1 as Index — its
      // own 2D platformer demo ships `draw_order = 215832976` — so a range
      // validator would error on a scene the engine opens without complaint.
      'draw_order',
    ],
    linterOnly: [
      ...PARTICLE_PARAM_KEYS,
      // Emission shapes the frozen pose cannot reproduce (they sample Godot's
      // global RNG), so the parser has no reason to read their point data —
      // but a malformed packed array is still worth reporting.
      'emission_points', 'emission_normals',
      // Per-axis scale curves, not implemented; a particle scales uniformly.
      'split_scale', 'scale_curve_x', 'scale_curve_y',
    ],
    reason:
      'The parameter min/max/curve keys ARE read, but through a table-driven `properties[`${prefix}_min`]` lookup the scrape cannot see; emission_points/normals and the split-scale curves are validated but deliberately unrendered; draw_order is validator-free because Godot accepts any int for it.',
  },

  TileMapLayer: {
    parserOnly: [
      // Raw tile cell stream (PackedByteArray): decoded by a dedicated
      // helper; the linter has no format validator for packed cell data.
      'tile_map_data',
    ],
    reason: 'tile_map_data is a PackedByteArray decoded by decodeTileMapData; transform/position are covered by the Node2D base on both parser and validator sides.',
  },

  TileMap: {
    reason: 'No unique asymmetries; transform/position covered by Node2D base on both sides.',
  },

  // -------------------------------------------------------------------------
  // 3D leaf slices
  // -------------------------------------------------------------------------

  GridMap: {
    parserOnly: [
      // Godot GridMap cell dictionary (`{ "cells": PackedInt32Array(...) }`):
      // decoded by extractCells; no linter format validator for packed cell
      // data exists.
      'data',
    ],
    reason: 'data is a packed cell dictionary decoded by a bespoke helper; transform is covered by Node3D base on both parser and validator sides.',
  },

  Label3D: {
    parserOnly: [
      // double_sided toggle: read for rendering but not validated by the
      // linter (boolean with Godot-default=true, no range constraint).
      'double_sided',
    ],
    renderGap: [
      // Material draw ORDER. With a single label nothing moves, but two
      // overlapping transparent materials resolve in this order, so it is a
      // real render input rather than an editor-only concern.
      'outline_render_priority', 'render_priority',
    ],
    reason:
      'Label3D.double_sided is a boolean read by the parser with no constraint to enforce; the two render-order properties are the reverse, validated against the RenderingServer range but unread, so overlapping transparent labels resolve in the wrong order.',
  },

  Sprite3D: {
    renderGap: [
      // SpriteBase3D members the tier now validates and `parser.ts` does not
      // read. Every one changes the rendered frame, so none of them is a
      // deliberate scope decision: alpha cutoff/dither/AA change which texels
      // survive, `shaded` switches lit vs unlit, `no_depth_test` draws on top,
      // `fixed_size` holds screen size against distance, and `texture_filter`
      // is nearest vs linear.
      'alpha_antialiasing_edge', 'alpha_antialiasing_mode', 'alpha_hash_scale',
      'alpha_scissor_threshold', 'fixed_size', 'no_depth_test', 'shaded',
      'texture_filter',
    ],
    reason:
      'SpriteBase3D material properties the shared tier validates; the Sprite3D parser reads none of them yet, and each one changes what Godot draws.',
  },

  CSGBox3D: {
    linterOnly: [
      // CSG parsers call finishCsgParse which reads material/operation from
      // shared helper; linter registers them explicitly per slice but they
      // are not visible to the per-file parser scrape.
      'material', 'operation',
    ],
    reason: 'CSG parsers read material/operation via finishCsgParse shared helper (not scrape-visible in parser.ts); linter registers them explicitly.',
  },

  CSGCylinder3D: {
    linterOnly: ['material', 'operation'],
    reason: 'Same as CSGBox3D: finishCsgParse reads material/operation via shared helper not visible to the scrape.',
  },

  CSGSphere3D: {
    linterOnly: ['material', 'operation'],
    reason: 'Same as CSGBox3D: finishCsgParse reads material/operation via shared helper not visible to the scrape.',
  },

  CSGTorus3D: {
    linterOnly: ['material', 'operation'],
    reason: 'Same as CSGBox3D: finishCsgParse reads material/operation via shared helper not visible to the scrape.',
  },

  CSGMesh3D: {
    linterOnly: ['material', 'operation'],
    reason: 'Same as CSGBox3D: finishCsgParse reads material/operation via shared helper not visible to the scrape.',
  },

  CSGPolygon3D: {
    linterOnly: ['material', 'operation'],
    reason: 'Same as CSGBox3D: finishCsgParse reads material/operation via shared helper not visible to the scrape.',
  },

  // GeometryInstance3D is a transform-only slice with no parser.ts of its own,
  // so from its perspective every key it registers is linter-only. One entry
  // here covers the eleven leaves that inherit them — MeshInstance3D, Sprite3D,
  // Label3D, GPUParticles3D and the seven CSG shapes — instead of eleven
  // near-identical copies. Each leaf's parser reads whatever subset it actually
  // renders (MeshInstance3D reads the shadow/GI/visibility set, Sprite3D reads
  // transparency); the rest tune baking, culling and draw order, which a static
  // preview has no equivalent for.
  GeometryInstance3D: {
    linterOnly: [
      'cast_shadow', 'gi_mode', 'gi_lightmap_texel_scale', 'lod_bias',
      'custom_aabb', 'extra_cull_margin', 'ignore_occlusion_culling',
      'material_override', 'material_overlay', 'transparency',
      'sorting_offset', 'sorting_use_aabb_center',
      'visibility_range_begin', 'visibility_range_begin_margin',
      'visibility_range_end', 'visibility_range_end_margin',
      'visibility_range_fade_mode',
    ],
    reason: 'The geometry base has no parser of its own, so every key it registers is linter-only there; each leaf parser reads the subset it renders and the remainder are bake/cull/draw-order settings a static preview cannot honour.',
  },

  // The container bases have no parser.ts of their own — they reuse parseControl
  // — so from their own perspective every key they register is linter-only, and
  // one entry each covers their H/V leaves rather than four near-identical
  // copies. The leaves' parsers read what they RENDER (the shared
  // boxContainer/splitContainer helpers handle alignment and offsets for
  // layout); the rest is editor-side drag tuning a DOM overlay has no use for.
  BoxContainer: {
    linterOnly: ['alignment', 'vertical'],
    reason: 'Layout base with no parser of its own; the leaves render alignment through the shared boxContainer helper, and `vertical` is fixed by the leaf class so nothing reads it there.',
  },

  SplitContainer: {
    linterOnly: [
      'collapsed', 'dragging_enabled', 'dragger_visibility', 'touch_dragger_enabled',
      'split_offset', 'split_offsets', 'vertical',
      'drag_area_margin_begin', 'drag_area_margin_end', 'drag_area_offset',
      'drag_area_highlight_in_editor',
    ],
    reason: 'Layout base with no parser of its own; the drag-area and dragger keys tune an interactive splitter the static DOM overlay does not implement, and `vertical` is fixed by the leaf class.',
  },

  // Like the container bases, BaseButton has no parser.ts, so one entry covers
  // Button and every button leaf below it. `disabled` is absent because
  // button/parser.ts does read it: the preview dims a disabled button.
  BaseButton: {
    linterOnly: [
      // Interaction state and press semantics, all meaningless in a still frame.
      'toggle_mode', 'button_pressed', 'action_mode', 'button_mask',
      'keep_pressed_outside',
      // Grouping and keyboard shortcuts, which the preview does not dispatch.
      'button_group', 'shortcut', 'shortcut_feedback', 'shortcut_in_tooltip',
    ],
    reason: 'Interaction base with no parser of its own; press semantics, grouping and shortcuts describe behaviour under input, which a static preview never applies.',
  },

  Button: {
    linterOnly: [
      // Text shaping and localisation left to the browser: the DOM overlay
      // renders the label as text and lets CSS wrap and trim it.
      'text_overrun_behavior', 'autowrap_mode', 'autowrap_trim_flags', 'clip_text',
      'text_direction', 'language',
    ],
    reason: "The overlay renders the label as DOM text, so wrapping, trimming and bidi are the browser's job rather than properties the parser reads.",
  },

  // Registered on the base and delivered to every 3D visual by the base-walk,
  // so one entry here covers MeshInstance3D, Sprite3D, Label3D, Decal,
  // GPUParticles3D and the seven CSG shapes rather than twelve leaf copies.
  VisualInstance3D: {
    linterOnly: [
      // `layers` selects which Camera3D cull masks see the object. The previewer
      // renders through a single camera with no cull-mask support, so no parser
      // reads it — but it is a real serialised property worth format-checking.
      'layers',
    ],
    reason: 'Render layers are validated for format but unused: the previewer has one camera and no cull-mask filtering, so no parser reads them.',
  },

  Decal: {
    linterOnly: [
      // Godot serialises `sorting_offset` for a Decal (Decal::_validate_property
      // restores it from VisualInstance3D's PROPERTY_USAGE_NONE), so it is a
      // valid key worth format-checking — but it only biases draw ORDER among
      // transparent surfaces, which a static preview has no equivalent for.
      'sorting_offset',
    ],
    reason: 'sorting_offset is a real serialised Decal property, so the linter checks its format, but it only tunes transparency sort order and the renderer has nothing to do with it.',
  },

  MeshInstance3D: {
    parserOnly: [
      // Deprecated. `scene/3d/visual_instance_3d.cpp` binds `gi_lightmap_scale`
      // PROPERTY_USAGE_NONE and nothing restores it, so Godot never writes it to
      // a .tscn and its validator was deleted as dead. The parser still reads it
      // so an older hand-written scene carrying the key still loads.
      'gi_lightmap_scale',
    ],
    linterOnly: [
      // Wildcard slot validator (surface_material_override/N) registered as
      // a pattern; parser reads via a loop over Object.keys and is not
      // captured by the properties.X scrape pattern.
      'surface_material_override/*',
    ],
    reason: 'MeshInstance3D linter uses a wildcard pattern for surface_material_override/N; the parser reads those via an Object.keys loop not captured by the scrape.',
  },


  // -------------------------------------------------------------------------
  // Animation
  // -------------------------------------------------------------------------

  AnimationPlayer: {
    parserOnly: [
      // Complex multi-form dictionary: parsed by extractLibraries via
      // Object.keys loop and dict matching; no linter validator exists.
      'libraries',
      // animation_player.cpp:1038-1039: PROPERTY_HINT_NONE + PROPERTY_USAGE_NONE
      // with an empty setter method name, getter-only, never serialised into a
      // real .tscn, so the linter carries no validator for either. The parser
      // still reads them defensively (falls back to 0.0 on a parse failure).
      'current_animation_length',
      'current_animation_position',
    ],
    reason: 'AnimationPlayer.libraries uses a bespoke dictionary decoder that the properties.X scrape cannot see; current_animation_length/current_animation_position are getter-only and PROPERTY_USAGE_NONE in Godot, so they can never appear in a real .tscn and carry no validator.',
  },


  // -------------------------------------------------------------------------
  // Audio (parseAudioBase shared-helper pattern)
  // -------------------------------------------------------------------------

  AudioStreamPlayer: {
    linterOnly: AUDIO_BASE_KEYS,
    reason: 'AudioStreamPlayer reads audio properties via parseAudioBase shared helper (not visible to per-file scrape); linter registers them explicitly. parser/parser.ts delegates entirely to helpers.',
  },

  AudioStreamPlayer2D: {
    linterOnly: AUDIO_BASE_KEYS,
    reason: 'AudioStreamPlayer2D reads audio base properties via parseAudioBase shared helper not captured by per-file scrape; linter registers them explicitly.',
  },

  AudioStreamPlayer3D: {
    linterOnly: AUDIO_BASE_KEYS,
    reason: 'AudioStreamPlayer3D reads audio base properties via parseAudioBase shared helper not captured by per-file scrape; linter registers them explicitly.',
  },

  // -------------------------------------------------------------------------
  // Lights (Light3D base level: shared validators + parseBaseLight* helpers,
  // both walked via the Light3D entries in NODE_BASE_TYPES and
  // BASE_TYPE_TO_PARSER_SUBPATH; base-level asymmetries live on Light3D above)
  // -------------------------------------------------------------------------

  DirectionalLight3D: {
    linterOnly: [
      // DirectionalLight3D linter registers additional shadow/sky properties
      // beyond what the parser reads for the preview.
      'directional_shadow_blend_splits', 'directional_shadow_fade_start',
      'directional_shadow_pancake_size',
      'directional_shadow_split_1', 'directional_shadow_split_2', 'directional_shadow_split_3',
      'sky_mode',
    ],
    reason: 'DirectionalLight3D linter validates additional shadow-cascade/sky tuning properties the static renderer ignores; the Light3D base keys are covered by the Light3D entry on both sides.',
  },

  OmniLight3D: {
    reason: 'No unique asymmetries; omni_* keys are symmetric and Light3D base keys are covered by the Light3D entry on both sides.',
  },

  SpotLight3D: {
    reason: 'No unique asymmetries; spot_* keys are symmetric and Light3D base keys are covered by the Light3D entry on both sides.',
  },

  AreaLight3D: {
    reason: 'No unique asymmetries; area_* keys are symmetric and Light3D base keys are covered by the Light3D entry on both sides.',
  },

  // -------------------------------------------------------------------------
  // Physics (linter-only physics properties)
  // -------------------------------------------------------------------------

  Area2D: {
    linterOnly: [
      // Physics simulation properties: valid TSCN but the static renderer
      // reads only collision_layer/collision_mask for display.
      'space_override', 'gravity_space_override', 'gravity_point',
      'gravity_point_center', 'gravity_point_unit_distance',
      'gravity_direction', 'gravity', 'linear_damp_space_override',
      'linear_damp', 'angular_damp_space_override', 'angular_damp',
      'priority', 'audio_bus_override', 'audio_bus_name', 'disable_mode',
      // Inherited from the CollisionObject2D tier, which Area2D is the only
      // member of that has a typed parser.ts and so the only one this guard
      // sees. Neither reaches the renderer: `collision_priority` orders solver
      // depenetration and `input_pickable` gates mouse picking.
      'collision_priority', 'input_pickable',
    ],
    reason: 'Area2D physics simulation properties (gravity, damping, space-override, solver priority, input picking) are linter-validated but ignored by the static previewer which only needs collision_layer/mask.',
  },

  CollisionShape2D: {
    linterOnly: [
      // Physics-behaviour properties with no visual counterpart. (`debug_color`
      // used to sit here; the gizmo draws in it now.)
      'one_way_collision', 'one_way_collision_margin',
    ],
    reason: 'CollisionShape2D one_way settings affect runtime physics only; the renderer reads shape/disabled/debug_color for visual display.',
  },

  // -------------------------------------------------------------------------
  // Nodes that parser uses parseNode3D but NODE_BASE_TYPES maps to Node
  // -------------------------------------------------------------------------



};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Walk dir recursively; collect every path holding a `linterParser.ts`,
 * `parser.ts` or not. The superset {@link findSliceDirs} narrows, so the
 * blind-spot count at the bottom of this file has something to measure against.
 */
function findLinterParserDirs(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  const result = entries.some((e) => e.name === 'linterParser.ts') ? [dir] : [];
  for (const e of entries) {
    if (e.isDirectory()) result.push(...findLinterParserDirs(join(dir, e.name)));
  }
  return result;
}

/** Walk dir recursively; collect paths where both parser.ts and linterParser.ts exist. */
function findSliceDirs(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  const names = new Set(entries.map((e) => e.name));
  const result = names.has('parser.ts') && names.has('linterParser.ts') ? [dir] : [];
  for (const e of entries) {
    if (e.isDirectory()) result.push(...findSliceDirs(join(dir, e.name)));
  }
  return result;
}

/**
 * Scrape `properties.X` and `properties['X']` accesses from a parser source.
 * Returns only identifier-shaped keys (alphanumeric + underscore).
 */
function scrapeParserProps(src: string): Set<string> {
  const props = new Set<string>();
  // properties.identifier
  const dotRe = /\bproperties\.([a-zA-Z_][a-zA-Z0-9_]*)/g;
  let m: RegExpExecArray | null;
  while ((m = dotRe.exec(src)) !== null) props.add(m[1]!);
  // properties['key'] or properties["key"]
  const bracketRe = /\bproperties\[['"]([^'"]+)['"]\]/g;
  while ((m = bracketRe.exec(src)) !== null) props.add(m[1]!);
  return props;
}

/**
 * All `properties.X` accesses inherited from the base parser files of a node
 * type's NODE_BASE_TYPES chain. Throws if a mapped base parser file has moved,
 * so a broken mapping fails loudly instead of surfacing as bogus asymmetries.
 */
function getInheritedParserProps(nodeType: string): Set<string> {
  const result = new Set<string>();
  for (const base of baseChain(nodeType)) {
    const subpath = BASE_TYPE_TO_PARSER_SUBPATH[base];
    if (!subpath) continue;
    const parserPath = join(nodesRoot, subpath);
    if (!existsSync(parserPath)) {
      throw new Error(
        `BASE_TYPE_TO_PARSER_SUBPATH['${base}'] points at a missing file: ${subpath}`
      );
    }
    for (const p of scrapeParserProps(readFileSync(parserPath, 'utf8'))) result.add(p);
  }
  return result;
}

/** Validator keys registered directly for a node type or any of its ancestors. */
function getFullValidatorKeys(nodeType: string): Set<string> {
  const result = new Set(validatorRegistry.getOwnKeys(nodeType));
  for (const base of baseChain(nodeType)) {
    for (const k of validatorRegistry.getOwnKeys(base)) result.add(k);
  }
  return result;
}

/**
 * Extract the node type name from a linterParser.ts source via
 * `registerAll('TypeName', ...)`.  Returns null for shared helpers that
 * export constants but do not call registerAll.
 */
/**
 * The node type a linterParser.ts speaks for.
 *
 * Both spellings count. A slice that only REMOVES inherited keys
 * (`registerUnavailable`, the fixed-orientation containers) registers no
 * validator at all, and scraping `registerAll` alone dropped it silently out of
 * this whole inventory — taking its base's allowlist entry down with it.
 */
function extractNodeType(src: string): string | null {
  const m = /register(?:All|Unavailable)\s*\(\s*'([^']+)'/.exec(src);
  return m ? m[1]! : null;
}

// ---------------------------------------------------------------------------
// Slice inventory: one walk + one scrape per slice, shared by all tests.
// ---------------------------------------------------------------------------

interface SliceInfo {
  /** Slice directory relative to src/nodes. */
  slice: string;
  nodeType: string;
  /** Own scraped props + inherited base parser props. */
  parserProps: Set<string>;
  /** Own registered keys + inherited base validator keys. */
  validatorKeys: Set<string>;
}

let cachedSlices: SliceInfo[] | null = null;

function collectSlices(): SliceInfo[] {
  if (cachedSlices) return cachedSlices;
  cachedSlices = [];
  for (const dir of findSliceDirs(nodesRoot).sort()) {
    const linterSrc = readFileSync(join(dir, 'linterParser.ts'), 'utf8');
    const nodeType = extractNodeType(linterSrc);
    if (!nodeType) continue; // shared-helper file — no registerAll

    const parserSrc = readFileSync(join(dir, 'parser.ts'), 'utf8');
    cachedSlices.push({
      slice: dir.slice(nodesRoot.length + 1),
      nodeType,
      parserProps: new Set([
        ...scrapeParserProps(parserSrc),
        ...getInheritedParserProps(nodeType),
      ]),
      validatorKeys: getFullValidatorKeys(nodeType),
    });
  }
  return cachedSlices;
}

// ---------------------------------------------------------------------------
// Core guard logic
// ---------------------------------------------------------------------------

interface ParityViolation {
  slice: string;
  nodeType: string;
  parserOnlyNotAllowlisted: string[];
  linterOnlyNotAllowlisted: string[];
}

function checkParity(): ParityViolation[] {
  const violations: ParityViolation[] = [];

  for (const { slice, nodeType, parserProps, validatorKeys } of collectSlices()) {
    // Collect allowlist entries from this type AND all ancestor types so a
    // base-type entry (e.g. Node3D.linterOnly) applies to every leaf slice.
    const allowedParserOnly = new Set<string>();
    const allowedLinterOnly = new Set<string>();
    for (const t of [nodeType, ...baseChain(nodeType)]) {
      const e = ASYMMETRY_ALLOWLIST[t];
      if (!e) continue;
      for (const k of e.parserOnly ?? []) allowedParserOnly.add(k);
      // Both suppress the failure; they differ in what they claim about WHY,
      // which is what a reader and the census below need.
      for (const k of e.linterOnly ?? []) allowedLinterOnly.add(k);
      for (const k of e.renderGap ?? []) allowedLinterOnly.add(k);
    }

    const parserOnlyNotAllowlisted = [...parserProps]
      .filter((k) => !validatorKeys.has(k) && !allowedParserOnly.has(k))
      .sort();
    const linterOnlyNotAllowlisted = [...validatorKeys]
      .filter((k) => !parserProps.has(k) && !allowedLinterOnly.has(k))
      .sort();

    if (parserOnlyNotAllowlisted.length > 0 || linterOnlyNotAllowlisted.length > 0) {
      violations.push({ slice, nodeType, parserOnlyNotAllowlisted, linterOnlyNotAllowlisted });
    }
  }

  return violations;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('property-grammar parity guard', () => {
  it('finds slice pairs to check (sanity: walk is not empty)', () => {
    expect(collectSlices().length).toBeGreaterThan(0);
  });

  it('every slice pair has symmetric property coverage (or an allowlisted asymmetry)', () => {
    const violations = checkParity();

    const lines: string[] = ['Unapproved parser/validator asymmetries:'];
    for (const v of violations) {
      lines.push(`\n  ${v.slice} [${v.nodeType}]:`);
      if (v.parserOnlyNotAllowlisted.length > 0)
        lines.push(`    parser-only (no validator): ${v.parserOnlyNotAllowlisted.join(', ')}`);
      if (v.linterOnlyNotAllowlisted.length > 0)
        lines.push(`    linter-only (no parser read): ${v.linterOnlyNotAllowlisted.join(', ')}`);
      lines.push(`    → add to ASYMMETRY_ALLOWLIST['${v.nodeType}'] with a reason, or fix the desync.`);
    }
    expect(violations, lines.join('\n')).toEqual([]);
  });

  it('allowlist entries stay honest: every listed key is genuinely asymmetric', () => {
    const slicesByType = new Map(collectSlices().map((s) => [s.nodeType, s]));
    const staleSections: string[] = [];

    // A base class validates for its descendants without parsing anything of
    // its own (it reuses the base parser), so it has no parser.ts and never
    // appears in `collectSlices`. Its allowlist entry is still live: the
    // base-walk delivers those keys to every leaf below it, and one entry there
    // is what keeps a dozen identical leaf entries from existing.
    const validatingBases = new Set(
      collectSlices().flatMap((s) => baseChain(s.nodeType))
    );

    for (const [nodeType, entry] of Object.entries(ASYMMETRY_ALLOWLIST)) {
      const slice = slicesByType.get(nodeType);
      if (!slice) {
        if (validatingBases.has(nodeType)) continue;
        // Node type no longer has a slice pair — allowlist entry is stale.
        staleSections.push(
          `${nodeType}: no parser.ts+linterParser.ts pair found, and no slice inherits from it`
        );
        continue;
      }

      // parserOnly keys should NOT have a validator; linterOnly keys should
      // NOT be read by the parser — otherwise the asymmetry has been fixed.
      for (const key of entry.parserOnly ?? []) {
        if (slice.validatorKeys.has(key)) {
          staleSections.push(`${nodeType}.parserOnly['${key}']: now has a validator — remove from allowlist`);
        }
      }
      for (const key of entry.linterOnly ?? []) {
        if (slice.parserProps.has(key)) {
          staleSections.push(`${nodeType}.linterOnly['${key}']: now read by the parser — remove from allowlist`);
        }
      }
      for (const key of entry.renderGap ?? []) {
        if (slice.parserProps.has(key)) {
          staleSections.push(
            `${nodeType}.renderGap['${key}']: now read by the parser — the gap closed, remove from allowlist`
          );
        }
      }
    }

    expect(staleSections, `Stale allowlist entries found:\n  ${staleSections.join('\n  ')}`).toEqual([]);
  });

  it('no key is claimed as both deliberate scope and a render gap', () => {
    const conflicts: string[] = [];
    for (const [nodeType, entry] of Object.entries(ASYMMETRY_ALLOWLIST)) {
      const deliberate = new Set(entry.linterOnly ?? []);
      for (const key of entry.renderGap ?? []) {
        if (deliberate.has(key)) conflicts.push(`${nodeType}: '${key}'`);
      }
    }
    expect(
      conflicts,
      `A key is either out of render scope or a gap, never both:\n  ${conflicts.join('\n  ')}`
    ).toEqual([]);
  });

  // The render-gap surface is the previewer's honest to-do list, so it gets a
  // number rather than a pile. Exact equality, not a ceiling: this list should
  // only move when someone deliberately adds a slice or closes a gap, and
  // either way the diff should say so out loud.
  const EXPECTED_RENDER_GAP_KEYS = 43;

  it('the render-gap surface matches its recorded size', () => {
    const gaps = Object.entries(ASYMMETRY_ALLOWLIST).flatMap(([nodeType, entry]) =>
      (entry.renderGap ?? []).map((key) => `${nodeType}.${key}`)
    );
    expect(
      gaps.length,
      `Render gaps now number ${gaps.length}, not ${EXPECTED_RENDER_GAP_KEYS}:\n  ${gaps.join('\n  ')}`
    ).toBe(EXPECTED_RENDER_GAP_KEYS);
  });

  /**
   * Slices this guard does NOT see, counted so the blind spot moves visibly.
   *
   * `findSliceDirs` admits a directory only when it holds BOTH `parser.ts` and
   * `linterParser.ts`. Every slice that reuses a base parser has no `parser.ts`
   * of its own — ADR-0008's transform-only shape and the whole Control-reuse
   * pattern — so the guard's most valuable question, "is this validated key
   * something the renderer should be reading?", is never asked of them. All 28
   * skeleton slices are in this set.
   *
   * That is a real limitation, and the number is here because the alternative is
   * worse than the limitation: an untouched `ASYMMETRY_ALLOWLIST` reads as "the
   * new slices are symmetric" when it actually means "they were never examined".
   * A wave that adds ten base-reusing slices now moves a number and must say so.
   *
   * Closing it properly means keying the population on `linterParser.ts` alone
   * and resolving the parser side through `getInheritedParserProps`, which needs
   * `BASE_TYPE_TO_PARSER_SUBPATH` extended well past its current few hops or the
   * unmapped chains over-report. That is its own piece of work.
   */
  const SWEPT_SLICES = 74;
  const PARSER_REUSING_SLICES = 144;

  it('accounts for every linterParser.ts, swept or knowingly not', () => {
    const withLinterParser = findLinterParserDirs(nodesRoot).filter((dir) =>
      extractNodeType(readFileSync(join(dir, 'linterParser.ts'), 'utf8'))
    );
    expect(collectSlices()).toHaveLength(SWEPT_SLICES);
    expect(
      withLinterParser.length - collectSlices().length,
      'Slices outside this guard changed. Update the count, and say in the commit ' +
        'whether the new ones are base-parser reusers (expected) or are missing a parser.ts they should have.'
    ).toBe(PARSER_REUSING_SLICES);
  });
});
