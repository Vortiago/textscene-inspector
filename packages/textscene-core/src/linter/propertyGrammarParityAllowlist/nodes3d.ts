/**
 * 3D leaf slices: the grid, the sprites, the collision and navigation nodes,
 * the CSG shapes and the `GeometryInstance3D` tier they inherit from.
 */

import type { AsymmetryEntry } from './types.js';

export const nodes3dAsymmetries: Readonly<Record<string, AsymmetryEntry>> = {
  // -------------------------------------------------------------------------
  // 3D leaf slices
  // -------------------------------------------------------------------------

  GridMap: {
    linterOnly: [
      // grid_map.cpp:84-106/:138-145/:154-156: a pre-baked ArrayMesh cache
      // Godot writes after `make_baked_meshes()` groups identical cell
      // instances into one draw call. Purely a rendering OPTIMISATION over the
      // same `data` cell dictionary the parser already decodes directly — the
      // baked meshes reproduce, not add to, what `data` already draws — so no
      // parser needs to read this cache to render the grid correctly.
      'baked_meshes',
    ],
    reason: 'data is a packed cell dictionary decoded by a bespoke helper (extractCells) — now symmetric on both sides; baked_meshes is a rendering-optimisation cache over the same cell data, so nothing needs to read it.',
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

  CollisionShape3D: {
    renderGap: [
      // The gizmo already honours `debug_color`, which `parser.ts` reads, so
      // this sibling flag — filled vs wireframe on the same gizmo — is a gap we
      // have not closed rather than a decision not to. Godot's own runtime frame
      // is unchanged either way (collision debug draw is off by default), but
      // this previewer chose to draw the gizmo, and having drawn it the flag is
      // ours to honour.
      'debug_fill',
    ],
    reason:
      'CollisionShape3D.debug_fill switches the collision gizmo between filled and wireframe; the parser reads debug_color for that same gizmo but not this.',
  },

  NavigationAgent3D: {
    linterOnly: [
      // Every one of these is pathfinding or avoidance STATE handed to
      // NavigationServer3D, or debug draw. None reaches a frozen frame: the
      // agent's own path, avoidance velocity and neighbour search happen at
      // runtime against a live navigation map the previewer does not simulate,
      // and the `debug_*` set is gated behind DEBUG_ENABLED plus the
      // navigation-debug flag, which is editor-gizmo territory (ADR-0018).
      'avoidance_priority', 'debug_enabled', 'debug_path_custom_color',
      'debug_path_custom_point_size', 'debug_use_custom', 'keep_y_velocity',
      'neighbor_distance', 'path_height_offset', 'path_max_distance',
      'path_metadata_flags', 'path_postprocessing', 'path_return_max_length',
      'path_return_max_radius', 'path_search_max_distance',
      'path_search_max_polygons', 'pathfinding_algorithm', 'simplify_epsilon',
      'simplify_path', 'time_horizon_agents', 'time_horizon_obstacles',
      'use_3d_avoidance', 'velocity',
    ],
    reason:
      "NavigationAgent3D's pathfinding and avoidance parameters are simulation inputs to NavigationServer3D, and its debug_* set draws only under DEBUG_ENABLED; neither changes a still frame, so parser.ts reads none of them.",
  },

  NavigationObstacle3D: {
    linterOnly: [
      // `velocity` only feeds NavigationServer3D avoidance state. `vertices`
      // shapes the avoidance region and carves the navigation mesh; the static
      // obstacle's own debug draw (_update_static_obstacle_debug,
      // navigation_obstacle_3d.cpp:632) is behind DEBUG_ENABLED plus the
      // avoidance-debug flag. Neither changes a frozen frame.
      'velocity', 'vertices',
    ],
    reason:
      "NavigationObstacle3D's velocity and vertices are avoidance-simulation and nav-mesh-carving inputs, drawn only under the debug flags, so parser.ts reads neither.",
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
      // visual_instance_3d.cpp:301-364: the SAME InstanceUniforms engine
      // class as CanvasItem's own instance_shader_parameters, reached via the
      // 3D RenderingServer surface. Same reason: no ShaderMaterial resource
      // slice exists in this previewer, so there is no surface to reflect a
      // shader uniform override onto.
      'instance_shader_parameters/*',
    ],
    reason: 'The geometry base has no parser of its own, so every key it registers is linter-only there; each leaf parser reads the subset it renders, the bake/cull/draw-order settings are a static preview cannot honour, and instance_shader_parameters has no ShaderMaterial rendering surface to land on at all.',
  },

};
