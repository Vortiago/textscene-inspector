/**
 * GPUParticles3D strict validators for linting.
 * Migrated to the declarative `v` namespace.
 */

// The base chain. Registration happens on import, so a test that loads only
// this slice resolves an inherited key ONLY if the ancestor is pulled in too;
// without this line just the full barrel ever registers it.
import '../../geometryinstance3d/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';

// gpu_particles_3d.cpp:843 hints 4 labels ("Index,Lifetime,Reverse
// Lifetime,View Depth"); BIND_ENUM_CONSTANT binds all 4 (:857-860). The
// previous 3-label map both dropped REVERSE_LIFETIME and mislabelled index 2
// as VIEW_DEPTH (Godot's own index 2 is REVERSE_LIFETIME; VIEW_DEPTH is 3).
const DRAW_ORDER = { 0: 'INDEX', 1: 'LIFETIME', 2: 'REVERSE_LIFETIME', 3: 'VIEW_DEPTH' };

// gpu_particles_3d.cpp:844 hints 4 labels ("Disabled,Z-Billboard,Y to
// Velocity,Z-Billboard + Y to Velocity"); BIND_ENUM_CONSTANT binds all 4
// (:870-873).
const TRANSFORM_ALIGN = {
  0: 'DISABLED',
  1: 'Z_BILLBOARD',
  2: 'Y_TO_VELOCITY',
  3: 'Z_BILLBOARD_Y_TO_VELOCITY',
};

validatorRegistry.registerAll('GPUParticles3D', {
  emitting: v.boolean('emitting'),
  // gpu_particles_3d.cpp:821 hints "1,1000000,1,exp", closed at both ends
  // (`exp` is slider scaling). set_amount:76 ERR_FAIL_COND_MSGs below 1, so the
  // floor is enforced; the ceiling is never checked, so it warns. Same shape as
  // the CPUParticles3D and CPUParticles2D twins.
  amount: v.int('amount', {
    min: 1,
    max: 1000000,
    enforced: { min: 'gpu_particles_3d.cpp:76' },
    hinted: { max: 'gpu_particles_3d.cpp:821' },
  }),
  // gpu_particles_3d.cpp:822 hints "0,1,0.0001"; set_amount_ratio (:730-733)
  // is a bare assignment, so out of range is a warning.
  amount_ratio: v.float('amount_ratio', { min: 0, max: 1, hinted: 'gpu_particles_3d.cpp:822' }),
  // gpu_particles_3d.cpp:82, ERR_FAIL_COND_MSG(p_lifetime <= 0, ...): the
  // setter refuses below the hint's own floor (:825,
  // "0.01,600.0,0.01,or_greater,exp,suffix:s"), so (0, 0.01) loads into Godot
  // and only warns.
  lifetime: v.positiveFloat('lifetime', undefined, {
    min: 0.01,
    enforced: 'gpu_particles_3d.cpp:82',
    hinted: 'gpu_particles_3d.cpp:825',
  }),
  one_shot: v.boolean('one_shot'),
  // gpu_particles_3d.cpp:828 hints "0.00,10.0,0.01,or_greater,exp";
  // set_pre_process_time:124-127 is a bare assignment.
  preprocess: v.nonNegativeFloat('preprocess', { hinted: 'gpu_particles_3d.cpp:828' }),
  // gpu_particles_3d.cpp:829 hints "0,64,0.01" (closed both ends, 0 is legal);
  // set_speed_scale:174-177 is a bare assignment with no check at all — the
  // previous >0 bound rejected the hint-legal, unenforced value 0 (which
  // simply pauses particle time).
  speed_scale: v.float('speed_scale', { min: 0, max: 64, hinted: 'gpu_particles_3d.cpp:829' }),
  explosiveness: v.float('explosiveness', {
    min: 0,
    max: 1,
    hinted: 'gpu_particles_3d.cpp:830',
  }),
  randomness: v.float('randomness', { min: 0, max: 1, hinted: 'gpu_particles_3d.cpp:831' }),
  use_fixed_seed: v.boolean('use_fixed_seed'),
  // gpu_particles_3d.cpp:833 hints "0,4294967295,1" (0..UINT32_MAX);
  // set_seed:115-118 assigns unconditionally — the uint32_t param coerces an
  // out-of-range value rather than rejecting it, so this is a warning.
  // `_validate_property:469-471` hides this key (PROPERTY_USAGE_NONE) whenever
  // `use_fixed_seed` is false, so a scene with the flag off legitimately omits
  // it — no presence check belongs here.
  seed: v.int('seed', { min: 0, max: 4294967295, hinted: 'gpu_particles_3d.cpp:833' }),
  // gpu_particles_3d.cpp:834 hints "0,1000,1,suffix:FPS" (closed, ceiling
  // 1000, not the previous 120); set_fixed_fps:309-312 is a bare assignment.
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
  // gpu_particles_3d.cpp:851 hints "0,4,1"; set_draw_passes:265-266
  // ERR_FAIL_CONDs below 1 (an enforced floor of 1, not the hint's 0), and
  // never bounds the top — MAX_DRAW_PASSES=4 only sizes the static
  // draw_pass_N properties `_bind_methods` registers, it is not a setter
  // guard — so the ceiling is a warning.
  draw_passes: v.int('draw_passes', {
    min: 1,
    max: 4,
    enforced: { min: 'gpu_particles_3d.cpp:266' },
    hinted: { max: 'gpu_particles_3d.cpp:851' },
  }),
  // gpu_particles_3d.cpp:853, PROPERTY_HINT_RESOURCE_TYPE "Mesh", for i in
  // 1..MAX_DRAW_PASSES. Nullable: `_validate_property:462-467` hides
  // draw_pass_N above `draw_passes`, so raising the count exposes an index
  // with no valid default to diff against, and packed_scene.cpp always
  // writes it — as the literal `null` for the still-empty Ref<Mesh>
  // (resource_format_text.cpp:1980 is the OBJECT/is_zero rule that spelling
  // follows). scenes/demos/3d/particles/test.tscn ships `draw_pass_2 = null`
  // this way; draw_pass_1's index is never hidden, so this format is
  // liberal, not the only one an editor-saved scene bothers to write.
  draw_pass_1: v.resourceReference('draw_pass_1'),
  draw_pass_2: v.resourceReference('draw_pass_2'),
  draw_pass_3: v.resourceReference('draw_pass_3'),
  draw_pass_4: v.resourceReference('draw_pass_4'),
  // gpu_particles_3d.cpp:855, PROPERTY_HINT_RESOURCE_TYPE "Skin". Always
  // visible (no `_validate_property` conditioning), so a cleared skin diffs
  // equal to the class default and is omitted rather than written `null`.
  draw_skin: v.resourceReference('draw_skin'),
  // set_visibility_aabb (gpu_particles_3d.cpp:139-143) assigns straight through
  // to particles_set_custom_aabb. A negative extent is a value Godot keeps, which
  // is why AABB.abs() exists, so only the format is checkable.
  visibility_aabb: v.aabb('visibility_aabb'),
  local_coords: v.boolean('local_coords'),
  // gpu_particles_3d.cpp:236-239, set_draw_order is a bare assignment.
  draw_order: v.enumInt('draw_order', 0, 3, DRAW_ORDER, { hinted: 'gpu_particles_3d.cpp:843' }),
  // gpu_particles_3d.cpp:629-633, ERR_FAIL_INDEX(uint32_t(p_align), 4): the
  // setter refuses, enforcing all 4 values.
  transform_align: v.enumInt('transform_align', 0, 3, TRANSFORM_ALIGN, {
    enforced: 'gpu_particles_3d.cpp:630',
  }),
  trail_enabled: v.boolean('trail_enabled'),
  // gpu_particles_3d.cpp:247-250, ERR_FAIL_COND(p_seconds < 0.01 -
  // CMP_EPSILON): the real enforced floor is 0.01, not the ~0 `positiveFloat`
  // previously used here.
  trail_lifetime: v.float('trail_lifetime', {
    min: 0.01,
    enforced: 'gpu_particles_3d.cpp:248',
  }),
  // gpu_particles_3d.cpp:839 hints "0,128,0.01,or_greater" (0 is legal, means
  // no collision radius); set_collision_base_size:179-182 is a bare
  // assignment with no check at all — the previous >0 bound rejected the
  // hint-legal, unenforced value 0.
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
