/**
 * GPUParticles2D strict validators for linting.
 *
 * Declare only GPUParticles2D's OWN members — the ones doc/classes/GPUParticles2D.xml
 * lists without an `overrides=` attribute. Everything from Node2D up is
 * registered on the ancestor and delivered by the NODE_BASE_TYPES base-walk, so
 * re-declaring an inherited key shadows it and duplicates the rule.
 *
 * Every `ADD_PROPERTY` in `gpu_particles_2d.cpp`'s `_bind_methods` has a
 * non-empty setter and no `PROPERTY_USAGE_NONE`, so all 26 of GPUParticles2D's
 * own members get a validator here except `draw_order` (see its comment below).
 */

import '../../../base/node2d/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';

validatorRegistry.registerAll('GPUParticles2D', {
  emitting: v.boolean('emitting'),

  // gpu_particles_2d.cpp:942 hints "1,1000000,1,exp" — no `or_greater`/`or_less`,
  // so both ends are hard. set_amount (gpu_particles_2d.cpp:72) only
  // ERR_FAILs below 1; the upper bound is hint-only, never setter-enforced.
  amount: v.int('amount', { min: 1, max: 1000000 }),

  // gpu_particles_2d.cpp:943 hints "0,1,0.0001" — no `or_greater`/`or_less`,
  // hard both ends. set_amount_ratio (line 484) assigns unconditionally.
  amount_ratio: v.float('amount_ratio', { min: 0, max: 1 }),

  // gpu_particles_2d.cpp:944, PROPERTY_HINT_NODE_PATH_VALID_TYPES restricts
  // the target to GPUParticles2D, but that needs the live scene tree to check
  // (see "Linter can't see instance internals"), so only the NodePath format
  // is validated here.
  sub_emitter: v.nodePath('sub_emitter'),

  // gpu_particles_2d.cpp:945, PROPERTY_HINT_RESOURCE_TYPE "Texture2D".
  texture: v.resourceReference('texture'),

  // gpu_particles_2d.cpp:947 hints "0.01,600.0,0.01,or_greater,exp,suffix:s" —
  // `or_greater` makes 600 a soft editor ceiling (not capped); 0.01 has no
  // `or_less`, so it's the hard floor. set_lifetime (line 77) only
  // ERR_FAILs at <= 0, but the hint's own floor governs per the mechanical
  // rule, not the looser setter.
  lifetime: v.float('lifetime', { min: 0.01 }),

  // gpu_particles_2d.cpp:948 hints "0.00,1.0,0.001" — no `or_greater`/`or_less`,
  // hard both ends. set_interp_to_end (line 210) CLAMPs to [0, 1], confirming it.
  interp_to_end: v.float('interp_to_end', { min: 0, max: 1 }),

  one_shot: v.boolean('one_shot'),

  // gpu_particles_2d.cpp:950 hints "0.00,10.0,0.01,or_greater,exp,suffix:s" —
  // `or_greater` makes 10 a soft ceiling; 0.00 is the hard floor.
  // set_pre_process_time (line 99) assigns unconditionally.
  preprocess: v.nonNegativeFloat('preprocess'),

  // gpu_particles_2d.cpp:951 hints "0,64,0.01" — no `or_greater`/`or_less`,
  // hard both ends. set_speed_scale (line 252) assigns unconditionally.
  speed_scale: v.float('speed_scale', { min: 0, max: 64 }),

  // gpu_particles_2d.cpp:952 hints "0,1,0.01" — hard both ends.
  explosiveness: v.float('explosiveness', { min: 0, max: 1 }),

  // gpu_particles_2d.cpp:953 hints "0,1,0.01" — hard both ends.
  randomness: v.float('randomness', { min: 0, max: 1 }),

  use_fixed_seed: v.boolean('use_fixed_seed'),

  // gpu_particles_2d.cpp:955 hints "0," + UINT32_MAX + ",1" = "0,4294967295,1" —
  // no `or_greater`/`or_less`, hard both ends (matches the uint32_t storage).
  seed: v.int('seed', { min: 0, max: 4294967295 }),

  // gpu_particles_2d.cpp:956 hints "0,1000,1,suffix:FPS" — no
  // `or_greater`/`or_less`, hard both ends. set_fixed_fps (line 317) assigns
  // unconditionally; the hint alone governs.
  fixed_fps: v.int('fixed_fps', { min: 0, max: 1000 }),

  interpolate: v.boolean('interpolate'),
  fract_delta: v.boolean('fract_delta'),

  // gpu_particles_2d.cpp:960 hints "0,128,0.01,or_greater" — `or_greater`
  // makes 128 a soft ceiling; 0 is the hard floor.
  collision_base_size: v.nonNegativeFloat('collision_base_size'),

  // gpu_particles_2d.cpp:962, PROPERTY_HINT_NONE ("suffix:px" only) — per the
  // brief, HINT_NONE carries no range at all, so only the Rect2(...) shape
  // is checked.
  visibility_rect: v.rect2('visibility_rect'),

  local_coords: v.boolean('local_coords'),

  // gpu_particles_2d.cpp:964 hints PROPERTY_HINT_ENUM "Index,Lifetime,Reverse
  // Lifetime" (3 values, DRAW_ORDER_INDEX/LIFETIME/REVERSE_LIFETIME = 0..2 per
  // the BIND_ENUM_CONSTANT lines at 972-974), which would suggest a hard
  // enum(0-2). But set_draw_order (line 309) is `draw_order = p_order;` with
  // no ERR_FAIL_INDEX and no CLAMP — exactly CPUParticles2D's identically-named
  // setter (nodes/2d/cpuparticles2d/linterParser.ts), which that slice
  // deliberately leaves unvalidated because Godot's own 2D platformer demo
  // ships `draw_order = 215832976` and still opens without complaint. Same
  // reasoning applies here: no validator registered for `draw_order`.

  // gpu_particles_2d.cpp:966, PROPERTY_HINT_GROUP_ENABLE is an editor-only
  // grouping hint, not a range.
  trail_enabled: v.boolean('trail_enabled'),

  // gpu_particles_2d.cpp:967 hints "0.01,10,0.01,or_greater,suffix:s" —
  // `or_greater` makes 10 a soft ceiling; 0.01 is the hard floor.
  // set_trail_lifetime (line 187) ERR_FAILs below `0.01 - CMP_EPSILON`,
  // confirming the floor.
  trail_lifetime: v.float('trail_lifetime', { min: 0.01 }),

  // gpu_particles_2d.cpp:968 hints "2,128,1" — no `or_greater`/`or_less`.
  // set_trail_sections (line 194) ERR_FAILs outside [2, 128], confirming both
  // ends are hard.
  trail_sections: v.int('trail_sections', { min: 2, max: 128 }),

  // gpu_particles_2d.cpp:969 hints "1,1024,1" — no `or_greater`/`or_less`.
  // set_trail_section_subdivisions (line 202) ERR_FAILs outside [1, 1024],
  // confirming both ends are hard.
  trail_section_subdivisions: v.int('trail_section_subdivisions', { min: 1, max: 1024 }),

  // gpu_particles_2d.cpp:971, PROPERTY_HINT_RESOURCE_TYPE
  // "ParticleProcessMaterial,ShaderMaterial".
  process_material: v.resourceReference('process_material'),
});
