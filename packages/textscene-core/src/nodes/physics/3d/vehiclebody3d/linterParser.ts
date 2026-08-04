/**
 * VehicleBody3D strict validators for linting.
 *
 * Declare only VehicleBody3D's OWN members — the ones doc/classes/VehicleBody3D.xml
 * lists without an `overrides=` attribute. `mass` carries `overrides="RigidBody3D"`
 * (VehicleBody3D just defaults it to 40 in its constructor) so it is RigidBody3D's
 * validator, not this one's. Everything from RigidBody3D up (mass, gravity_scale,
 * damping, freeze, contact_monitor, collision_layer/mask, …) is registered on the
 * ancestor and delivered by the NODE_BASE_TYPES base-walk, so re-declaring an
 * inherited key shadows it and duplicates the rule.
 */

import '../rigidbody3d/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';

validatorRegistry.registerAll('VehicleBody3D', {
  // vehicle_body_3d.cpp:1057, PROPERTY_HINT_RANGE
  // "-1024,1024,0.01,or_less,or_greater,...". Both or_less and or_greater are
  // present, so -1024/1024 are only the default slider extents, not enforced
  // bounds — the setter assigns the value straight through with no clamp.
  engine_force: v.float('engine_force'),
  // vehicle_body_3d.cpp:1058, PROPERTY_HINT_RANGE
  // "-128,128,0.01,or_less,or_greater,...". Same soft-range shape as engine_force.
  brake: v.float('brake'),
  // vehicle_body_3d.cpp:1059, PROPERTY_HINT_RANGE "-180,180,0.01,radians_as_degrees",
  // no or_greater/or_less. set_steering (:1032-1039) is a bare assignment
  // (fanned out to steering wheels), so out-of-range warns.
  steering: v.radians('steering', {
    minDeg: -180,
    maxDeg: 180,
    hinted: 'vehicle_body_3d.cpp:1059',
  }),
});
