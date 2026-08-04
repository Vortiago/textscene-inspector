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
 *
 * Per ADR-0032, the setter decides whether an out-of-range value is an ERROR
 * (it `ERR_FAIL`s, clamps, or otherwise refuses the write) or a WARNING (the
 * hint states a range but the setter assigns straight through). An earlier
 * version of this file's comments read the opposite priority — "the hint's own
 * floor governs, not the looser setter" — which is why `lifetime` and
 * `amount`'s ceiling were wrong: `lifetime` rejected `(0, 0.01)`, a range
 * Godot's own setter accepts, and `amount`'s 1000000 ceiling was coded as a
 * hard error though nothing enforces it engine-side. Every bound below is
 * grounded against the setter, not the hint, and cites its `file:line`.
 */

import '../../../base/node2d/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';

validatorRegistry.registerAll('GPUParticles2D', {
  emitting: v.boolean('emitting'),

  // gpu_particles_2d.cpp:942 hints "1,1000000,1,exp" — no `or_greater`/`or_less`,
  // so the hint is hard both ends. set_amount (gpu_particles_2d.cpp:71-72) only
  // ERR_FAILs below 1; the 1000000 ceiling is never setter-enforced, so it is
  // a warning, not an error. `strictInt` (not `int`) because only it wires a
  // per-end severity through to the underlying validator.
  amount: v.strictInt('amount', {
    min: 1,
    max: 1000000,
    enforced: { min: 'gpu_particles_2d.cpp:71' },
    hinted: { max: 'gpu_particles_2d.cpp:942' },
  }),

  // gpu_particles_2d.cpp:943 hints "0,1,0.0001" — no `or_greater`/`or_less`,
  // hard both ends. set_amount_ratio (gpu_particles_2d.cpp:484-486) assigns
  // unconditionally, so out of range is a warning.
  amount_ratio: v.float('amount_ratio', { min: 0, max: 1, hinted: 'gpu_particles_2d.cpp:943' }),

  // gpu_particles_2d.cpp:944, PROPERTY_HINT_NODE_PATH_VALID_TYPES restricts
  // the target to GPUParticles2D, but that needs the live scene tree to check
  // (see "Linter can't see instance internals"), so only the NodePath format
  // is validated here.
  sub_emitter: v.nodePath('sub_emitter'),

  // gpu_particles_2d.cpp:945, PROPERTY_HINT_RESOURCE_TYPE "Texture2D".
  texture: v.resourceReference('texture'),

  // gpu_particles_2d.cpp:947 hints "0.01,600.0,0.01,or_greater,exp,suffix:s",
  // but set_lifetime (gpu_particles_2d.cpp:77-78) ERR_FAILs at `<= 0`, not at
  // the hint's 0.01 — the setter governs, so the real floor is `> 0`.
  lifetime: v.positiveFloat('lifetime', undefined, { enforced: 'gpu_particles_2d.cpp:77' }),

  // gpu_particles_2d.cpp:948 hints "0.00,1.0,0.001" — no `or_greater`/`or_less`,
  // hard both ends. set_interp_to_end (gpu_particles_2d.cpp:210-211) CLAMPs to
  // [0, 1], confirming it as an enforced error.
  interp_to_end: v.float('interp_to_end', { min: 0, max: 1, enforced: 'gpu_particles_2d.cpp:210' }),

  one_shot: v.boolean('one_shot'),

  // gpu_particles_2d.cpp:950 hints "0.00,10.0,0.01,or_greater,exp,suffix:s" —
  // `or_greater` makes 10 a soft ceiling, so only the 0.00 floor is checked;
  // set_pre_process_time (gpu_particles_2d.cpp:99-101) assigns unconditionally.
  preprocess: v.nonNegativeFloat('preprocess', { hinted: 'gpu_particles_2d.cpp:950' }),

  // gpu_particles_2d.cpp:951 hints "0,64,0.01" — no `or_greater`/`or_less`,
  // hard both ends. set_speed_scale (gpu_particles_2d.cpp:252-254) assigns
  // unconditionally.
  speed_scale: v.float('speed_scale', { min: 0, max: 64, hinted: 'gpu_particles_2d.cpp:951' }),

  // gpu_particles_2d.cpp:952 hints "0,1,0.01" — hard both ends;
  // set_explosiveness_ratio (gpu_particles_2d.cpp:104-106) assigns unconditionally.
  explosiveness: v.float('explosiveness', { min: 0, max: 1, hinted: 'gpu_particles_2d.cpp:952' }),

  // gpu_particles_2d.cpp:953 hints "0,1,0.01" — hard both ends;
  // set_randomness_ratio (gpu_particles_2d.cpp:109-111) assigns unconditionally.
  randomness: v.float('randomness', { min: 0, max: 1, hinted: 'gpu_particles_2d.cpp:953' }),

  use_fixed_seed: v.boolean('use_fixed_seed'),

  // gpu_particles_2d.cpp:955 hints "0," + UINT32_MAX + ",1" = "0,4294967295,1" —
  // no `or_greater`/`or_less`, hard both ends. set_seed
  // (gpu_particles_2d.cpp:360-362) assigns unconditionally — the uint32_t
  // param coerces an out-of-range value rather than rejecting it, so this is
  // hinted, not enforced.
  seed: v.int('seed', { min: 0, max: 4294967295, hinted: 'gpu_particles_2d.cpp:955' }),

  // gpu_particles_2d.cpp:956 hints "0,1000,1,suffix:FPS" — no
  // `or_greater`/`or_less`, hard both ends. set_fixed_fps
  // (gpu_particles_2d.cpp:317-319) assigns unconditionally.
  fixed_fps: v.int('fixed_fps', { min: 0, max: 1000, hinted: 'gpu_particles_2d.cpp:956' }),

  interpolate: v.boolean('interpolate'),
  fract_delta: v.boolean('fract_delta'),

  // gpu_particles_2d.cpp:960 hints "0,128,0.01,or_greater" — `or_greater`
  // makes 128 a soft ceiling, so only the 0 floor is checked;
  // set_collision_base_size (gpu_particles_2d.cpp:243-246) assigns
  // unconditionally.
  collision_base_size: v.nonNegativeFloat('collision_base_size', { hinted: 'gpu_particles_2d.cpp:960' }),

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
  // set_trail_lifetime (gpu_particles_2d.cpp:187-188) ERR_FAILs below
  // `0.01 - CMP_EPSILON`, confirming the floor as an enforced error.
  trail_lifetime: v.float('trail_lifetime', { min: 0.01, enforced: 'gpu_particles_2d.cpp:187' }),

  // gpu_particles_2d.cpp:968 hints "2,128,1" — no `or_greater`/`or_less`.
  // set_trail_sections (gpu_particles_2d.cpp:194-197) ERR_FAILs outside
  // [2, 128], confirming both ends are enforced errors.
  trail_sections: v.int('trail_sections', { min: 2, max: 128, enforced: 'gpu_particles_2d.cpp:194' }),

  // gpu_particles_2d.cpp:969 hints "1,1024,1" — no `or_greater`/`or_less`.
  // set_trail_section_subdivisions (gpu_particles_2d.cpp:202-205) ERR_FAILs
  // outside [1, 1024], confirming both ends are enforced errors.
  trail_section_subdivisions: v.int('trail_section_subdivisions', {
    min: 1,
    max: 1024,
    enforced: 'gpu_particles_2d.cpp:202',
  }),

  // gpu_particles_2d.cpp:971, PROPERTY_HINT_RESOURCE_TYPE
  // "ParticleProcessMaterial,ShaderMaterial".
  process_material: v.resourceReference('process_material'),
});
