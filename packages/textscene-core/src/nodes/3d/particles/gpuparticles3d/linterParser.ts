/** GPUParticles3D strict validators for linting. */

// Registration happens on import, so a test that loads only this slice resolves an
// inherited key only when this line pulls the ancestor in.
import '../../geometryinstance3d/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';
import { CMP_EPSILON } from '../../../../godot/index.js';

// gpu_particles_3d.cpp:843 hints "Index,Lifetime,Reverse Lifetime,View Depth", and
// BIND_ENUM_CONSTANT binds all 4 (:857-860).
const DRAW_ORDER = { 0: 'INDEX', 1: 'LIFETIME', 2: 'REVERSE_LIFETIME', 3: 'VIEW_DEPTH' };

// gpu_particles_3d.cpp:844 hints "Disabled,Z-Billboard,Y to Velocity,Z-Billboard + Y to
// Velocity", bound at :870-873. The 4.7.2 hint (:894) adds LOCAL_BILLBOARD.
const TRANSFORM_ALIGN = {
  0: 'DISABLED',
  1: 'Z_BILLBOARD',
  2: 'Y_TO_VELOCITY',
  3: 'Z_BILLBOARD_Y_TO_VELOCITY',
  4: 'LOCAL_BILLBOARD',
};

validatorRegistry.registerAll('GPUParticles3D', {
  emitting: v.boolean('emitting'),
  // gpu_particles_3d.cpp:821 hints "1,1000000,1,exp", where `exp` is slider scaling.
  // set_amount:76 refuses below 1 but never checks the ceiling, so the ceiling warns.
  amount: v.int('amount', {
    min: 1,
    max: 1000000,
    enforced: { min: 'gpu_particles_3d.cpp:76' },
    hinted: { max: 'gpu_particles_3d.cpp:821' },
  }),
  // gpu_particles_3d.cpp:822 hints "0,1,0.0001". set_amount_ratio (:730-733) is a bare
  // assignment, so out of range warns.
  amount_ratio: v.float('amount_ratio', { min: 0, max: 1, hinted: 'gpu_particles_3d.cpp:822' }),
  // gpu_particles_3d.cpp:82 refuses p_lifetime <= 0, below the hint's floor (:825,
  // "0.01,600.0,0.01,or_greater,exp,suffix:s"), so (0, 0.01) loads and only warns.
  lifetime: v.positiveFloat('lifetime', undefined, {
    min: 0.01,
    enforced: 'gpu_particles_3d.cpp:82',
    hinted: 'gpu_particles_3d.cpp:825',
  }),
  one_shot: v.boolean('one_shot'),
  // gpu_particles_3d.cpp:828 hints "0.00,10.0,0.01,or_greater,exp".
  // set_pre_process_time:124-127 is a bare assignment.
  preprocess: v.nonNegativeFloat('preprocess', { hinted: 'gpu_particles_3d.cpp:828' }),
  // gpu_particles_3d.cpp:829 hints "0,64,0.01", so 0 is legal and pauses particle time.
  // set_speed_scale:174-177 is a bare assignment.
  speed_scale: v.float('speed_scale', { min: 0, max: 64, hinted: 'gpu_particles_3d.cpp:829' }),
  explosiveness: v.float('explosiveness', {
    min: 0,
    max: 1,
    hinted: 'gpu_particles_3d.cpp:830',
  }),
  randomness: v.float('randomness', { min: 0, max: 1, hinted: 'gpu_particles_3d.cpp:831' }),
  use_fixed_seed: v.boolean('use_fixed_seed'),
  // gpu_particles_3d.cpp:833 hints "0,4294967295,1". set_seed:115-118 takes a uint32_t
  // that coerces an out-of-range value, so this warns. `_validate_property:469-471`
  // hides the key while `use_fixed_seed` is false, so no presence check belongs here.
  seed: v.int('seed', { min: 0, max: 4294967295, hinted: 'gpu_particles_3d.cpp:833' }),
  // gpu_particles_3d.cpp:834 hints "0,1000,1,suffix:FPS". set_fixed_fps:309-312 is a bare
  // assignment.
  fixed_fps: v.int('fixed_fps', {
    min: 0,
    max: 1000,
    message:
      "Property 'fixed_fps' must be between 0 and 1000. Valid range: 0=automatic, 1-1000=fixed simulation rate",
    hinted: 'gpu_particles_3d.cpp:834',
  }),
  interpolate: v.boolean('interpolate'),
  fract_delta: v.boolean('fract_delta'),
  process_material: v.resourceReference('process_material'),
  // gpu_particles_3d.cpp:851 hints "0,4,1". set_draw_passes:265-266 refuses below 1, not
  // the hint's 0. MAX_DRAW_PASSES=4 only sizes the draw_pass_N properties, so the
  // ceiling warns.
  draw_passes: v.int('draw_passes', {
    min: 1,
    max: 4,
    enforced: { min: 'gpu_particles_3d.cpp:266' },
    hinted: { max: 'gpu_particles_3d.cpp:851' },
  }),
  // gpu_particles_3d.cpp:853, PROPERTY_HINT_RESOURCE_TYPE "Mesh", for i in
  // 1..MAX_DRAW_PASSES. `_validate_property:462-467` hides draw_pass_N above
  // `draw_passes`, so packed_scene.cpp writes an exposed empty pass as the literal
  // `null` (resource_format_text.cpp:1980, the OBJECT/is_zero rule).
  draw_pass_1: v.resourceReference('draw_pass_1'),
  draw_pass_2: v.resourceReference('draw_pass_2'),
  draw_pass_3: v.resourceReference('draw_pass_3'),
  draw_pass_4: v.resourceReference('draw_pass_4'),
  // gpu_particles_3d.cpp:855, PROPERTY_HINT_RESOURCE_TYPE "Skin". Always visible, so a
  // cleared skin equals the class default and is omitted rather than written `null`.
  draw_skin: v.resourceReference('draw_skin'),
  // set_visibility_aabb (gpu_particles_3d.cpp:139-143) passes the value straight to
  // particles_set_custom_aabb. Godot keeps a negative extent, so only the format is
  // checkable.
  visibility_aabb: v.aabb('visibility_aabb'),
  local_coords: v.boolean('local_coords'),
  // gpu_particles_3d.cpp:236-239, set_draw_order is a bare assignment.
  draw_order: v.enumInt('draw_order', 0, 3, DRAW_ORDER, { hinted: 'gpu_particles_3d.cpp:843' }),
  // 4.7.2 assigns bare (gpu_particles_3d.cpp:652-656), where 4.6.3 refused with
  // `ERR_FAIL_INDEX(uint32_t(p_align), 4)`. The newer release wins, so only the hint
  // bounds this: 4.7.2's :894 lists five labels.
  transform_align: v.enumInt('transform_align', 0, 4, TRANSFORM_ALIGN, {
    hinted: 'gpu_particles_3d.cpp:894',
  }),
  trail_enabled: v.boolean('trail_enabled'),
  // gpu_particles_3d.cpp:247-250 refuses p_seconds < 0.01 - CMP_EPSILON, one epsilon below
  // the hint's floor (:847, "0.01,10,0.01,or_greater,suffix:s"), so that band loads and
  // only warns.
  trail_lifetime: v.float('trail_lifetime', {
    enforcedMin: { at: 0.01 - CMP_EPSILON },
    min: 0.01,
    enforced: { min: 'gpu_particles_3d.cpp:248' },
    hinted: { min: 'gpu_particles_3d.cpp:847' },
  }),
  // gpu_particles_3d.cpp:839 hints "0,128,0.01,or_greater", so 0 is legal and means no
  // collision radius. set_collision_base_size:179-182 is a bare assignment.
  collision_base_size: v.nonNegativeFloat('collision_base_size', {
    hinted: 'gpu_particles_3d.cpp:839',
  }),
  sub_emitter: v.nodePath('sub_emitter'),
  // gpu_particles_3d.cpp:87-90, `interp_to_end_factor = CLAMP(p_interp, 0.0,
  // 1.0)`: both ends enforced.
  interp_to_end: v.float('interp_to_end', {
    min: 0,
    max: 1,
    enforced: 'gpu_particles_3d.cpp:88',
  }),
});
