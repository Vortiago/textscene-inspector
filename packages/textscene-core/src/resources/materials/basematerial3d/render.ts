/**
 * BaseMaterial3D's Billboard, Particles Anim, Grow, Transform, Proximity Fade,
 * MSDF and Distance Fade groups (`material.cpp:3739-3772`).
 *
 * `proximity_fade_distance` is the split bound tiers exist for: its setter
 * stores `MAX(p_distance, 0.01)` (:3087), so the floor alters and errors while
 * the ceiling is the inspector's alone and warns.
 */

import type { PropertyValidator } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';

export const renderKeys: Record<string, PropertyValidator> = {
  billboard_mode: v.enumInt(
    'billboard_mode',
    0,
    3,
    { 0: 'DISABLED', 1: 'ENABLED', 2: 'FIXED_Y', 3: 'PARTICLES' },
    { hinted: 'material.cpp:3740' }
  ),
  billboard_keep_scale: v.boolean('billboard_keep_scale'),

  // material.cpp:3744-3745 (both "1,128,1"); set_particles_anim_h_frames (:2832)
  // and _v_frames (:2841) bare assign.
  particles_anim_h_frames: v.int('particles_anim_h_frames', {
    min: 1,
    max: 128,
    hinted: 'material.cpp:3744',
  }),
  particles_anim_v_frames: v.int('particles_anim_v_frames', {
    min: 1,
    max: 128,
    hinted: 'material.cpp:3745',
  }),
  particles_anim_loop: v.boolean('particles_anim_loop'),

  grow: v.boolean('grow'),
  // material.cpp:3750 ("-16,16,0.001,suffix:m"); set_grow (:2942) bare assigns.
  // A negative grow shrinks the outline, so the floor is a real bound.
  grow_amount: v.float('grow_amount', { min: -16, max: 16, hinted: 'material.cpp:3750' }),

  fixed_size: v.boolean('fixed_size'),
  use_point_size: v.boolean('use_point_size'),
  // material.cpp:3755 ("0.1,128,0.1,suffix:px"); set_point_size (:2757) bare assigns.
  point_size: v.float('point_size', { min: 0.1, max: 128, hinted: 'material.cpp:3755' }),
  use_particle_trails: v.boolean('use_particle_trails'),
  use_z_clip_scale: v.boolean('use_z_clip_scale'),
  // material.cpp:3758 ("0.01,1.0,0.01"); set_z_clip_scale (:3003) bare assigns.
  z_clip_scale: v.float('z_clip_scale', { min: 0.01, max: 1, hinted: 'material.cpp:3758' }),
  use_fov_override: v.boolean('use_fov_override'),
  // material.cpp:3760 ("1,179,0.1,degrees"); set_fov_override (:3012) bare
  // assigns. `degrees` is the unit the `.tscn` stores, not a conversion the way
  // `radians_as_degrees` is, so the hint's numbers are the literal's numbers.
  fov_override: v.float('fov_override', { min: 1, max: 179, hinted: 'material.cpp:3760' }),

  proximity_fade_enabled: v.boolean('proximity_fade_enabled'),
  proximity_fade_distance: v.float('proximity_fade_distance', {
    min: 0.01,
    max: 4096,
    enforced: { min: 'material.cpp:3087' },
    hinted: { max: 'material.cpp:3763' },
  }),

  // material.cpp:3766-3767 ("1,100,1" and "0,250,1"); set_msdf_pixel_range
  // (:3095) and set_msdf_outline_size (:3104) bare assign. Both are FLOAT
  // properties despite the integral step.
  msdf_pixel_range: v.float('msdf_pixel_range', { min: 1, max: 100, hinted: 'material.cpp:3766' }),
  msdf_outline_size: v.float('msdf_outline_size', {
    min: 0,
    max: 250,
    hinted: 'material.cpp:3767',
  }),

  distance_fade_mode: v.enumInt(
    'distance_fade_mode',
    0,
    3,
    { 0: 'DISABLED', 1: 'PIXEL_ALPHA', 2: 'PIXEL_DITHER', 3: 'OBJECT_DITHER' },
    { hinted: 'material.cpp:3770' }
  ),
  // material.cpp:3771-3772 (both "0,4096,0.01,suffix:m"); set_distance_fade_min_distance
  // (:3132) and _max_distance (:3123) bare assign. min > max is a real mistake
  // and not one a per-property bound can see.
  distance_fade_min_distance: v.float('distance_fade_min_distance', {
    min: 0,
    max: 4096,
    hinted: 'material.cpp:3771',
  }),
  distance_fade_max_distance: v.float('distance_fade_max_distance', {
    min: 0,
    max: 4096,
    hinted: 'material.cpp:3772',
  }),
};
