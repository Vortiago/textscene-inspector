/**
 * 2D leaf slices, and the two physics nodes whose linter-only keys are runtime
 * simulation settings.
 */

import { PARAM_SLOTS } from '../../nodes/2d/cpuparticles2d/types.js';
import type { AsymmetryEntry } from './types.js';

/**
 * CPUParticles2D's parameter slots. `parser.ts` reads each `<prefix>_min`,
 * `_max` and `_curve` through a table (`properties[`${prefix}_min`]`), which the
 * `properties.X` scrape cannot see. Derived from the parser's own table, so a
 * renamed prefix or dropped slot moves both sides at once.
 */
const PARTICLE_PARAM_KEYS: readonly string[] = PARAM_SLOTS.flatMap(({ prefix, curve }) => [
  `${prefix}_min`,
  `${prefix}_max`,
  ...(curve ? [`${prefix}_curve`] : []),
]);

export const nodes2dAsymmetries: Readonly<Record<string, AsymmetryEntry>> = {
  AnimatedSprite2D: {
    linterOnly: [
      // Playback state: the renderer reads the initial frame directly, and
      // runtime playback is not modelled.
      'autoplay', 'frame_progress', 'speed_scale',
    ],
    reason:
      'AnimatedSprite2D linter validates runtime playback properties (autoplay, speed_scale, frame_progress) that the static renderer ignores.',
  },

  Camera2D: {
    linterOnly: [
      // Viewport behaviour and editor aids, with no effect on the static
      // preview.
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
    renderGap: [
      // The stroke appearance beyond its centreline: antialiasing, texture,
      // gradient, width curve and caps. This draws a flat constant-width line.
      'antialiased', 'gradient', 'texture', 'texture_mode', 'width_curve',
      'begin_cap_mode', 'end_cap_mode',
    ],
    reason: 'points is parsed and now validated too; the remaining seven are the stroke appearance the renderer does not implement.',
  },

  Polygon2D: {
    linterOnly: [
      // Display tweak with no rendering parity requirement.
      'antialiased',
    ],
    renderGap: [
      // Skeleton2D skinning: `bones` is the weight table and `skeleton` names
      // the rig. Godot deforms the polygon by them; this draws the rest pose.
      'bones', 'skeleton',
    ],
    reason: 'polygon/polygons/vertex_colors are parsed AND validated now; antialiased is a display tweak with no equivalent; bones/skeleton are the unimplemented Skeleton2D deformation.',
  },

  CPUParticles2D: {
    linterOnly: [
      ...PARTICLE_PARAM_KEYS,
      // Only reachable for the POINTS and DIRECTED_POINTS emission shapes, which
      // sample Godot's global RNG and so are deliberately not previewed.
      'emission_colors',
      // The same RNG-driven shapes, so the parser does not read their point
      // data, but a malformed packed array is still worth reporting.
      'emission_points', 'emission_normals',
      // Per-axis scale curves, not implemented; a particle scales uniformly.
      'split_scale', 'scale_curve_x', 'scale_curve_y',
    ],
    reason:
      'The parameter min/max/curve keys ARE read, but through a table-driven `properties[`${prefix}_min`]` lookup the scrape cannot see; emission_points/normals/colors and the split-scale curves are validated but deliberately unrendered. draw_order is both parsed and validated now: its enum is 0-1 here, narrower than the 2D and 3D GPU twins, and out-of-range warns rather than errors because the setter bare-assigns.',
  },

  TileMapLayer: {
    linterOnly: [
      // Physics and navigation bodies built from the tiles, plus the batching
      // quadrant sizes. The two visibility modes gate DEBUG_ENABLED overlays
      // that are additionally suppressed in the editor (tile_map_layer.cpp),
      // so they draw in neither reference nor ours.
      'collision_enabled', 'use_kinematic_bodies', 'collision_visibility_mode',
      'navigation_enabled', 'navigation_visibility_mode',
      'physics_quadrant_size', 'rendering_quadrant_size',
    ],
    renderGap: [
      // Occlusion polygons feed 2D shadow casting, which this previewer has
      // infrastructure for but never wires tiles into.
      'occlusion_enabled',
      // Flips the same-Y tie-break while y-sorting; neither the parser nor
      // ySortItems reads it.
      'x_draw_order_reversed',
    ],
    reason: 'tile_map_data and y_sort_origin are parsed and validated; the physics/navigation bodies and quadrant batching never reach a frame, while occlusion and the draw-order flip do and are unimplemented.',
  },

  TileMap: {
    linterOnly: [
      // tile_map.cpp:1023-1043's PropertyListHelper family. parser.ts's
      // LAYER_KEY_RE loop reads name, enabled, modulate, z_index and tile_data,
      // which the scrape cannot see. y_sort_enabled and navigation_enabled
      // change no tile placement in a static frame.
      'layer_#/*',
      // Forwarded to the child layers Godot builds from this deprecated node:
      // batching and debug overlays, as on TileMapLayer.
      'collision_animatable', 'collision_visibility_mode',
      'navigation_visibility_mode', 'rendering_quadrant_size',
    ],
    reason: 'layer_<i>/* is read through a loop the scrape cannot match; parser.ts genuinely reads five of its seven leaves (name/enabled/modulate/z_index/tile_data), and y_sort_enabled/navigation_enabled have no bearing on a static frame. instance_shader_parameters/* is covered by the inherited CanvasItem entry.',
  },

  // Navigation regions draw a translucent navmesh overlay here, mirroring the
  // editor's debug view, so the two keys that gate Godot's own debug draw are
  // gaps rather than scope. The costs and layers are pathfinding inputs that
  // never reach a frame in either.
  NavigationRegion2D: {
    linterOnly: ['navigation_layers', 'enter_cost', 'travel_cost'],
    renderGap: ['enabled', 'use_edge_connections'],
    reason:
      'enabled and use_edge_connections gate the navmesh and edge-connection debug draw this previewer mirrors; the layer mask and the two costs only steer pathfinding.',
  },

  CanvasLayer: {
    renderGap: [
      // The layer's own canvas transform, and the parallax-style viewport
      // follow. Godot composites the layer through both; `canvaslayer/parser.ts`
      // reads `layer` and `visible` and nothing else.
      'offset', 'rotation', 'scale',
      'follow_viewport_enabled', 'follow_viewport_scale',
    ],
    reason: 'The bare CanvasLayer parser reads layer and visible only, so the discrete offset/rotation/scale and the viewport-follow pair — each of which moves what the layer draws — go unread. ParallaxBackground, the one descendant carrying a parser of its own, reads and renders all of them but follow_viewport_scale.',
  },

  SubViewportContainer: {
    linterOnly: [
      // Routes input to the child SubViewport instead of the container: event
      // plumbing with no draw effect. Control's keys come from baseTypes.
      'mouse_target',
    ],
    reason: 'mouse_target decides whether the container or its SubViewport receives input events; nothing about a frozen frame changes.',
  },

  Sprite2D: {
    renderGap: [
      // Clamps the atlas sampler to the region rect, which is what stops a
      // neighbouring tile bleeding in at the seam. Purely a render concern.
      'region_filter_clip_enabled',
    ],
    reason: 'region_filter_clip_enabled prevents atlas-edge bleed at the region seam; the renderer samples the region without it.',
  },

  Area2D: {
    linterOnly: [
      // Physics simulation: the renderer reads only collision_layer and
      // collision_mask.
      'gravity_space_override', 'gravity_point',
      'gravity_point_center', 'gravity_point_unit_distance',
      'gravity_direction', 'gravity', 'linear_damp_space_override',
      'linear_damp', 'angular_damp_space_override', 'angular_damp',
      'priority', 'audio_bus_override', 'audio_bus_name', 'disable_mode',
      // From CollisionObject2D, whose only member with a parser.ts is Area2D.
      // `collision_priority` orders solver depenetration and `input_pickable`
      // gates mouse picking.
      'collision_priority', 'input_pickable',
    ],
    reason: 'Area2D physics simulation properties (gravity, damping, space-override, solver priority, input picking) are linter-validated but ignored by the static previewer which only needs collision_layer/mask.',
  },

  CollisionShape2D: {
    linterOnly: [
      // Physics-behaviour properties with no visual counterpart.
      'one_way_collision', 'one_way_collision_margin',
    ],
    reason: 'CollisionShape2D one_way settings affect runtime physics only; the renderer reads shape/disabled/debug_color for visual display.',
  },
};
