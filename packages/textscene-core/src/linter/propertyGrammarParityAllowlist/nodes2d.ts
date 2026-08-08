/**
 * 2D leaf slices, and the two physics nodes whose linter-only keys are runtime
 * simulation settings.
 */

import { PARAM_SLOTS } from '../../nodes/2d/cpuparticles2d/types.js';
import type { AsymmetryEntry } from './types.js';

/**
 * CPUParticles2D's twelve parameter slots. `parser.ts` reads every one of
 * `<prefix>_min` / `_max` / `_curve`, but through a TABLE
 * (`properties[`${prefix}_min`]`) rather than a literal access, so the
 * `properties.X` scrape sees none of them — the same blind spot as the audio
 * base helper in `animationAndAudio.ts`. Derived from the parser's OWN table, so
 * a renamed prefix or
 * a dropped slot moves both sides at once instead of leaving the allowlist
 * asserting coverage of a key nothing reads any more.
 */
const PARTICLE_PARAM_KEYS: readonly string[] = PARAM_SLOTS.flatMap(({ prefix, curve }) => [
  `${prefix}_min`,
  `${prefix}_max`,
  ...(curve ? [`${prefix}_curve`] : []),
]);

export const nodes2dAsymmetries: Readonly<Record<string, AsymmetryEntry>> = {
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
    linterOnly: [
      // tile_map.cpp:1023-1043's PropertyListHelper family. parser.ts (its
      // own LAYER_KEY_RE loop over Object.keys(properties)) genuinely reads
      // name/enabled/modulate/z_index/tile_data for rendering — the scrape's
      // literal properties.X pattern just cannot see a loop-built key, the
      // same blind spot as MeshInstance3D's surface_material_override/*.
      // y_sort_enabled and navigation_enabled are the two leaves the parser
      // truly has no use for: neither changes which tile draws where in a
      // static frame.
      'layer_#/*',
    ],
    reason: 'layer_<i>/* is read through a loop the scrape cannot match; parser.ts genuinely reads five of its seven leaves (name/enabled/modulate/z_index/tile_data), and y_sort_enabled/navigation_enabled have no bearing on a static frame. instance_shader_parameters/* is covered by the inherited CanvasItem entry.',
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
};
