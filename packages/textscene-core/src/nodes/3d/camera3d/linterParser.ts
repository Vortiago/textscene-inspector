/**
 * Camera3D strict validators for linting.
 * Migrated to the declarative `v` namespace.
 */

// The base chain. Registration happens on import, so a test that loads only
// this slice resolves an inherited key ONLY if the ancestor is pulled in too;
// without this line just the full barrel ever registers it.
import '../../base/node3d/linterParser.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { layerBitmask, v } from '../../../linter/validators/index.js';
import { CMP_EPSILON } from '../../../godot/math.js';

const PROJECTION = { 0: 'PERSPECTIVE', 1: 'ORTHOGONAL', 2: 'FRUSTUM' };
// camera_3d.h:50-52: `enum KeepAspect { KEEP_WIDTH, KEEP_HEIGHT };` has exactly
// two members. A third label "KEEP_ASPECT_DISABLED" does not exist anywhere in
// Godot 4.6.3 — camera_3d.cpp:672's ADD_PROPERTY hint offers only "Keep
// Width,Keep Height", and BIND_ENUM_CONSTANT binds only KEEP_WIDTH/KEEP_HEIGHT
// — so the old 0-2 bound accepted a value the engine cannot represent.
const KEEP_ASPECT = { 0: 'KEEP_WIDTH', 1: 'KEEP_HEIGHT' };
const DOPPLER_TRACKING = { 0: 'DISABLED', 1: 'IDLE_STEP', 2: 'PHYSICS_STEP' };

validatorRegistry.registerAll('Camera3D', {
  // camera_3d.cpp:341, `set_projection` only assigns inside
  // `if (p_mode==PERSPECTIVE||ORTHOGONAL||FRUSTUM)`: an out-of-enum value is
  // silently dropped rather than applied, which ADR-0032 counts as enforced.
  projection: v.enumInt('projection', 0, 2, PROJECTION, { enforced: 'camera_3d.cpp:341' }),
  // camera_3d.cpp:725, ERR_FAIL_COND(p_fov < 1 || p_fov > 179): the setter
  // refuses, so this is an error rather than an advisory. Custom message keeps
  // the "degrees" qualifier that the per-node test asserts.
  fov: v.float('fov', {
    min: 1,
    max: 179,
    message: "Property 'fov' must be between 1 and 179 degrees",
    enforced: 'camera_3d.cpp:725',
  }),
  // Two tiers on the floor. camera_3d.cpp:731 `ERR_FAIL_COND(p_size <=
  // CMP_EPSILON)` refuses the endpoint too, hence `exclusive`; the hint
  // (:683, "0.001,100,0.001,or_greater,suffix:m") states 0.001, two orders
  // above, so the band between them loads and only warns. `or_greater` leaves
  // the ceiling open.
  size: v.float('size', {
    enforcedMin: { at: CMP_EPSILON, exclusive: true },
    min: 0.001,
    enforced: { min: 'camera_3d.cpp:731' },
    hinted: { min: 'camera_3d.cpp:683' },
  }),
  frustum_offset: v.vector2('frustum_offset'),
  // camera_3d.cpp:685 hints "0.001,10,0.001,or_greater,exp,suffix:m" — `or_greater`
  // opens the top. set_near (:737) is a bare assignment, so the floor only warns.
  near: v.float('near', { min: 0.001, hinted: { min: 'camera_3d.cpp:685' } }),
  // camera_3d.cpp:686 hints "0.01,4000,0.01,or_greater,exp,suffix:m"; set_far
  // (:747) is a bare assignment too, so the floor warns and the top stays open.
  far: v.float('far', { min: 0.01, hinted: { min: 'camera_3d.cpp:686' } }),
  // camera_3d.cpp:586-591, `set_keep_aspect_mode` is a bare assignment: the
  // hint (:672) is advisory, not enforcement.
  keep_aspect: v.enumInt('keep_aspect', 0, 1, KEEP_ASPECT, { hinted: 'camera_3d.cpp:672' }),
  cull_mask: layerBitmask('cull_mask', { hinted: 'camera_3d.cpp:673', width: 'uint32' /* camera_3d.h:177 */ }),
  // camera_3d.cpp:597-605, `set_doppler_tracking` is a bare assignment.
  doppler_tracking: v.enumInt('doppler_tracking', 0, 2, DOPPLER_TRACKING, {
    hinted: 'camera_3d.cpp:679',
  }),
  current: v.boolean('current'),
  h_offset: v.float('h_offset'),
  v_offset: v.float('v_offset'),
  // camera_3d.cpp:675, ADD_PROPERTY(Variant::OBJECT, "attributes", …). set_attributes
  // (:532-555) is a bare assignment (connects a changed signal, no refusal), so
  // only the reference format is checkable. Godot omits the key entirely when
  // the slot is cleared rather than writing null.
  attributes: v.resourceReference('attributes'),
  // camera_3d.cpp:676, ADD_PROPERTY(Variant::OBJECT, "compositor", …). set_compositor
  // (:572-580) is a bare assignment.
  compositor: v.resourceReference('compositor'),
  // camera_3d.cpp:674, ADD_PROPERTY(Variant::OBJECT, "environment", …). set_environment
  // (:518-526) is a bare assignment.
  environment: v.resourceReference('environment'),
});
