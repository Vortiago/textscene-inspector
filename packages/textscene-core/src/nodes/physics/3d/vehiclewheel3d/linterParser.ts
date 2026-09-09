/**
 * VehicleWheel3D strict validators for linting.
 *
 * Declare only VehicleWheel3D's OWN members — the ones doc/classes/VehicleWheel3D.xml
 * lists without an `overrides=` attribute. `physics_interpolation_mode` carries
 * `overrides="Node"` (VehicleWheel3D just defaults it) so it is Node's validator,
 * not this one's. Everything from Node3D up is registered on the ancestor and
 * delivered by the NODE_BASE_TYPES base-walk, so re-declaring an inherited key
 * shadows it and duplicates the rule.
 */

import '../../../base/node3d/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';

validatorRegistry.registerAll('VehicleWheel3D', {
  // vehicle_body_3d.cpp:323, PROPERTY_HINT_RANGE
  // "-1024,1024,0.01,or_less,or_greater,...". Both or_less and or_greater are
  // present, so -1024/1024 are only the default slider extents, not enforced
  // bounds — the setter (set_engine_force) assigns the value straight through
  // with no clamp. Identical hint shape to VehicleBody3D's own engine_force.
  engine_force: v.float('engine_force'),
  // vehicle_body_3d.cpp:324, PROPERTY_HINT_RANGE
  // "-128,128,0.01,or_less,or_greater,...". Same soft-range shape as engine_force.
  brake: v.float('brake'),
  // vehicle_body_3d.cpp:325, PROPERTY_HINT_RANGE "-180,180,0.01,radians_as_degrees",
  // no or_greater/or_less. set_steering (:359-361) is a bare assignment, so
  // out-of-range warns.
  steering: v.radians('steering', {
    minDeg: -180,
    maxDeg: 180,
    hinted: 'vehicle_body_3d.cpp:325',
  }),
  // vehicle_body_3d.cpp:327 — no hint, plain bool.
  use_as_traction: v.boolean('use_as_traction'),
  // vehicle_body_3d.cpp:328 — no hint, plain bool.
  use_as_steering: v.boolean('use_as_steering'),
  // vehicle_body_3d.cpp:330 — no hint at all, plain float.
  wheel_roll_influence: v.float('wheel_roll_influence'),
  // vehicle_body_3d.cpp:331, PROPERTY_HINT_NONE, "suffix:m" — no range, plain float.
  wheel_radius: v.float('wheel_radius'),
  // vehicle_body_3d.cpp:332, PROPERTY_HINT_NONE, "suffix:m" — no range, plain float.
  wheel_rest_length: v.float('wheel_rest_length'),
  // vehicle_body_3d.cpp:333 — no hint, plain float.
  wheel_friction_slip: v.float('wheel_friction_slip'),
  // vehicle_body_3d.cpp:335, PROPERTY_HINT_NONE, "suffix:m" — no range, plain float.
  suspension_travel: v.float('suspension_travel'),
  // vehicle_body_3d.cpp:336, PROPERTY_HINT_NONE, "suffix:N/mm" — no range, plain float.
  suspension_stiffness: v.float('suspension_stiffness'),
  // vehicle_body_3d.cpp:337, PROPERTY_HINT_NONE, "suffix:..." — no range, plain float.
  suspension_max_force: v.float('suspension_max_force'),
  // vehicle_body_3d.cpp:339, PROPERTY_HINT_NONE, "suffix:N⋅s/mm" — no range, plain float.
  damping_compression: v.float('damping_compression'),
  // vehicle_body_3d.cpp:340, PROPERTY_HINT_NONE, "suffix:N⋅s/mm" — no range, plain float.
  damping_relaxation: v.float('damping_relaxation'),
});
