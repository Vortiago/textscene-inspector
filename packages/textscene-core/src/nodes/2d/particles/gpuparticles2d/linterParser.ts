/**
 * GPUParticles2D strict validators: every `ADD_PROPERTY` in `gpu_particles_2d.cpp`
 * has a setter and storage, so all 26 members doc/classes/GPUParticles2D.xml lists
 * without `overrides=` get one. Per ADR-0032 a setter refusal or clamp errors, a hint-only range warns.
 */

import '../../../base/node2d/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';
import { CMP_EPSILON } from '../../../../godot/index.js';

// gpu_particles_2d.cpp:964 hints 3 labels, and BIND_ENUM_CONSTANT binds all 3
// (:972-974). CPUParticles2D's DrawOrder has only 2 (cpu_particles_2d.h:43-45),
// despite the identical property name.
const DRAW_ORDER = { 0: 'INDEX', 1: 'LIFETIME', 2: 'REVERSE_LIFETIME' };

validatorRegistry.registerAll('GPUParticles2D', {
  emitting: v.boolean('emitting'),

  // gpu_particles_2d.cpp:942 hints "1,1000000,1,exp", closed both ends.
  // set_amount only ERR_FAILs below 1 (gpu_particles_2d.cpp:72), so the ceiling
  // warns.
  amount: v.int('amount', {
    min: 1,
    max: 1000000,
    enforced: { min: 'gpu_particles_2d.cpp:72' },
    hinted: { max: 'gpu_particles_2d.cpp:942' },
  }),

  // gpu_particles_2d.cpp:943 hints "0,1,0.0001", closed both ends.
  // set_amount_ratio (gpu_particles_2d.cpp:484-486) assigns unconditionally, so out of range is a warning.
  amount_ratio: v.float('amount_ratio', { min: 0, max: 1, hinted: 'gpu_particles_2d.cpp:943' }),

  // gpu_particles_2d.cpp:944, PROPERTY_HINT_NODE_PATH_VALID_TYPES restricts the
  // target to GPUParticles2D. That needs the live scene tree, so only the
  // NodePath format is checked.
  sub_emitter: v.nodePath('sub_emitter'),

  // gpu_particles_2d.cpp:945, PROPERTY_HINT_RESOURCE_TYPE "Texture2D".
  texture: v.resourceReference('texture'),

  // gpu_particles_2d.cpp:947 hints "0.01,600.0,0.01,or_greater,exp,suffix:s",
  // whose ceiling `or_greater` opens. set_lifetime (gpu_particles_2d.cpp:78)
  // ERR_FAILs at `<= 0`, below the hint's floor, so (0, 0.01) loads into Godot
  // and only warns.
  lifetime: v.positiveFloat('lifetime', undefined, {
    min: 0.01,
    enforced: 'gpu_particles_2d.cpp:78',
    hinted: 'gpu_particles_2d.cpp:947',
  }),

  // gpu_particles_2d.cpp:948 hints "0.00,1.0,0.001", closed both ends.
  // set_interp_to_end (gpu_particles_2d.cpp:210-211) clamps to [0, 1]: an error.
  interp_to_end: v.float('interp_to_end', { min: 0, max: 1, enforced: 'gpu_particles_2d.cpp:211' }),

  one_shot: v.boolean('one_shot'),

  // gpu_particles_2d.cpp:950 hints "0.00,10.0,0.01,or_greater,exp,suffix:s":
  // `or_greater` opens the ceiling, so only the floor is checked.
  // set_pre_process_time (gpu_particles_2d.cpp:99-101) assigns unconditionally.
  preprocess: v.nonNegativeFloat('preprocess', { hinted: 'gpu_particles_2d.cpp:950' }),

  // gpu_particles_2d.cpp:951 hints "0,64,0.01", closed both ends.
  // set_speed_scale (gpu_particles_2d.cpp:252-254) assigns unconditionally.
  speed_scale: v.float('speed_scale', { min: 0, max: 64, hinted: 'gpu_particles_2d.cpp:951' }),

  // gpu_particles_2d.cpp:952 hints "0,1,0.01", closed both ends.
  // set_explosiveness_ratio (gpu_particles_2d.cpp:104-106) assigns unconditionally.
  explosiveness: v.float('explosiveness', { min: 0, max: 1, hinted: 'gpu_particles_2d.cpp:952' }),

  // gpu_particles_2d.cpp:953 hints "0,1,0.01", closed both ends.
  // set_randomness_ratio (gpu_particles_2d.cpp:109-111) assigns unconditionally.
  randomness: v.float('randomness', { min: 0, max: 1, hinted: 'gpu_particles_2d.cpp:953' }),

  use_fixed_seed: v.boolean('use_fixed_seed'),

  // gpu_particles_2d.cpp:955 hints "0,4294967295,1" (UINT32_MAX), closed both
  // ends. set_seed (gpu_particles_2d.cpp:360-362) assigns unconditionally, and
  // its uint32_t parameter coerces rather than rejects, so this warns.
  seed: v.int('seed', { min: 0, max: 4294967295, hinted: 'gpu_particles_2d.cpp:955' }),

  // gpu_particles_2d.cpp:956 hints "0,1000,1,suffix:FPS", closed both ends.
  // set_fixed_fps (gpu_particles_2d.cpp:317-319) assigns unconditionally.
  fixed_fps: v.int('fixed_fps', { min: 0, max: 1000, hinted: 'gpu_particles_2d.cpp:956' }),

  interpolate: v.boolean('interpolate'),
  fract_delta: v.boolean('fract_delta'),

  // gpu_particles_2d.cpp:960 hints "0,128,0.01,or_greater", so only the floor is
  // checked. set_collision_base_size (gpu_particles_2d.cpp:243-246) assigns
  // unconditionally.
  collision_base_size: v.nonNegativeFloat('collision_base_size', { hinted: 'gpu_particles_2d.cpp:960' }),

  // gpu_particles_2d.cpp:962, PROPERTY_HINT_NONE ("suffix:px" only) carries no
  // range, so only the Rect2(...) shape is checked.
  visibility_rect: v.rect2('visibility_rect'),

  local_coords: v.boolean('local_coords'),

  // gpu_particles_2d.cpp:964 hints PROPERTY_HINT_ENUM "Index,Lifetime,Reverse
  // Lifetime". set_draw_order (:308-311) is `draw_order = p_order;` with no
  // ERR_FAIL_INDEX and no CLAMP, so an out-of-range value warns.
  draw_order: v.enumInt('draw_order', 0, 2, DRAW_ORDER, { hinted: 'gpu_particles_2d.cpp:964' }),

  // gpu_particles_2d.cpp:966, PROPERTY_HINT_GROUP_ENABLE is an editor-only
  // grouping hint, not a range.
  trail_enabled: v.boolean('trail_enabled'),

  // gpu_particles_2d.cpp:967 hints "0.01,10,0.01,or_greater,suffix:s".
  // set_trail_lifetime ERR_FAILs below `0.01 - CMP_EPSILON`
  // (gpu_particles_2d.cpp:188), one epsilon under the hint's floor, so that band
  // loads and only warns.
  trail_lifetime: v.float('trail_lifetime', {
    enforcedMin: { at: 0.01 - CMP_EPSILON },
    min: 0.01,
    enforced: { min: 'gpu_particles_2d.cpp:188' },
    hinted: { min: 'gpu_particles_2d.cpp:967' },
  }),

  // gpu_particles_2d.cpp:968 hints "2,128,1", closed both ends.
  // set_trail_sections ERR_FAILs at each end on its own line, so each end
  // cites its own guard.
  trail_sections: v.int('trail_sections', {
    min: 2,
    max: 128,
    enforced: { min: 'gpu_particles_2d.cpp:195', max: 'gpu_particles_2d.cpp:196' },
  }),

  // gpu_particles_2d.cpp:969 hints "1,1024,1", closed both ends.
  // set_trail_section_subdivisions ERR_FAILs at each end on its own line.
  trail_section_subdivisions: v.int('trail_section_subdivisions', {
    min: 1,
    max: 1024,
    enforced: { min: 'gpu_particles_2d.cpp:203', max: 'gpu_particles_2d.cpp:204' },
  }),

  // gpu_particles_2d.cpp:971, PROPERTY_HINT_RESOURCE_TYPE
  // "ParticleProcessMaterial,ShaderMaterial".
  process_material: v.resourceReference('process_material'),
});
