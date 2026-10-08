/**
 * The `VisualInstance3D` tier, the two leaves with their own surface-level
 * asymmetries, the undrawn GeometryInstance3D leaves, and the concrete lights.
 */

import type { AsymmetryEntry } from './types.js';

export const visuals3dAsymmetries: Readonly<Record<string, AsymmetryEntry>> = {
  // Registered on the base and delivered to every 3D visual by the base-walk.
  VisualInstance3D: {
    linterOnly: [
      // `layers` selects which Camera3D cull masks see the object. The previewer
      // has one camera and no cull masks, so no parser reads it.
      'layers',
    ],
    reason:
      'Render layers are validated for format but unused: the previewer has one camera and no cull-mask filtering, so no parser reads them.',
  },

  Decal: {
    linterOnly: [
      // Godot serialises `sorting_offset` for a Decal (Decal::_validate_property
      // restores it from VisualInstance3D's PROPERTY_USAGE_NONE). It biases only
      // draw order among transparent surfaces.
      'sorting_offset',
    ],
    reason:
      'sorting_offset is a real serialised Decal property, so the linter checks its format, but it only tunes transparency sort order and the renderer has nothing to do with it.',
  },

  MeshInstance3D: {
    parserOnly: [
      // Deprecated: `scene/3d/visual_instance_3d.cpp` binds `gi_lightmap_scale`
      // PROPERTY_USAGE_NONE, so Godot never writes it and it has no validator.
      // The parser reads it so an older hand-written scene still loads.
      'gi_lightmap_scale',
    ],
    linterOnly: [
      // A wildcard validator. The parser reads it in a loop over Object.keys,
      // which the properties.X scrape cannot see.
      'surface_material_override/*',
      // canvas_item.cpp's InstanceUniforms sibling for the 3D RS surface, as in
      // the inherited GeometryInstance3D entry.
      'instance_shader_parameters/*',
    ],
    renderGap: [
      // mesh_instance_3d.cpp:102-103: a morph-target weight Godot deforms the
      // mesh by. This previewer renders the rest pose.
      'blend_shapes/*',
    ],
    reason:
      'MeshInstance3D linter uses a wildcard pattern for surface_material_override/N and instance_shader_parameters/N; the parser reads the former via an Object.keys loop not captured by the scrape and has no rendering surface for the latter at all. blend_shapes/<name> is a real, unimplemented morph-target rendering gap.',
  },

  // Undrawn GeometryInstance3D leaves: each parses only what its scene-cull box reads, so every
  // key that shapes the drawn result is a gap until the type draws.
  AnimatedSprite3D: {
    renderGap: [
      'alpha_antialiasing_edge',
      'alpha_antialiasing_mode',
      'alpha_cut',
      'alpha_hash_scale',
      'alpha_scissor_threshold',
      'animation',
      'autoplay',
      'double_sided',
      'fixed_size',
      'flip_h',
      'flip_v',
      'frame',
      'frame_progress',
      'modulate',
      'no_depth_test',
      'render_priority',
      'shaded',
      'speed_scale',
      'sprite_frames',
      'texture_filter',
      'transparent',
    ],
    reason:
      'AnimatedSprite3D draws no quad yet. Its parser reads only what places the quad, and the box hook reads sprite_frames, animation and frame raw, in file order, which the scrape cannot see; every key that colours or plays the frame waits on the drawing.',
  },

  CPUParticles3D: {
    renderGap: [
      'amount',
      'angle_curve',
      'angle_max',
      'angle_min',
      'angular_velocity_curve',
      'angular_velocity_max',
      'angular_velocity_min',
      'anim_offset_curve',
      'anim_offset_max',
      'anim_offset_min',
      'anim_speed_curve',
      'anim_speed_max',
      'anim_speed_min',
      'color',
      'color_initial_ramp',
      'color_ramp',
      'damping_curve',
      'damping_max',
      'damping_min',
      'direction',
      'draw_order',
      'emission_box_extents',
      'emission_colors',
      'emission_normals',
      'emission_points',
      'emission_ring_axis',
      'emission_ring_cone_angle',
      'emission_ring_height',
      'emission_ring_inner_radius',
      'emission_ring_radius',
      'emission_shape',
      'emission_sphere_radius',
      'emitting',
      'explosiveness',
      'fixed_fps',
      'flatness',
      'fract_delta',
      'gravity',
      'hue_variation_curve',
      'hue_variation_max',
      'hue_variation_min',
      'initial_velocity_max',
      'initial_velocity_min',
      'lifetime',
      'lifetime_randomness',
      'linear_accel_curve',
      'linear_accel_max',
      'linear_accel_min',
      'local_coords',
      'one_shot',
      'orbit_velocity_curve',
      'orbit_velocity_max',
      'orbit_velocity_min',
      'particle_flag_align_y',
      'particle_flag_disable_z',
      'particle_flag_rotate_y',
      'preprocess',
      'radial_accel_curve',
      'radial_accel_max',
      'radial_accel_min',
      'randomness',
      'scale_amount_curve',
      'scale_amount_max',
      'scale_amount_min',
      'scale_curve_x',
      'scale_curve_y',
      'scale_curve_z',
      'seed',
      'speed_scale',
      'split_scale',
      'spread',
      'tangential_accel_curve',
      'tangential_accel_max',
      'tangential_accel_min',
      'use_fixed_seed',
    ],
    reason:
      'CPUParticles3D is not simulated, so nothing reads the emission, motion and appearance keys. Its parser reads only visibility_aabb and mesh, which give its scene-cull box.',
  },

  GPUParticles3D: {
    renderGap: [
      'amount',
      'amount_ratio',
      'collision_base_size',
      'draw_order',
      'draw_pass_1',
      'draw_pass_2',
      'draw_pass_3',
      'draw_pass_4',
      'draw_passes',
      'draw_skin',
      'emitting',
      'explosiveness',
      'fixed_fps',
      'fract_delta',
      'interp_to_end',
      'interpolate',
      'lifetime',
      'local_coords',
      'one_shot',
      'preprocess',
      'process_material',
      'randomness',
      'seed',
      'speed_scale',
      'sub_emitter',
      'trail_enabled',
      'trail_lifetime',
      'transform_align',
      'use_fixed_seed',
    ],
    reason:
      'GPUParticles3D is not simulated, so nothing reads the emission, draw-pass and trail keys. Its parser reads only visibility_aabb, its scene-cull box.',
  },

  // Lights: the shared validators and parseBaseLight* helpers are walked through
  // the Light3D entries in NODE_BASE_TYPES and BASE_TYPE_TO_PARSER_SUBPATH, and
  // base-level asymmetries sit on Light3D in baseTypes.ts.

  DirectionalLight3D: {
    reason:
      'No unique asymmetries; directional_* keys and sky_mode are symmetric and Light3D base keys are covered by the Light3D entry on both sides.',
  },

  OmniLight3D: {
    reason:
      'No unique asymmetries; omni_* keys are symmetric and Light3D base keys are covered by the Light3D entry on both sides.',
  },

  SpotLight3D: {
    reason:
      'No unique asymmetries; spot_* keys are symmetric and Light3D base keys are covered by the Light3D entry on both sides.',
  },

  AreaLight3D: {
    reason:
      'No unique asymmetries; area_* keys are symmetric and Light3D base keys are covered by the Light3D entry on both sides.',
  },
};
