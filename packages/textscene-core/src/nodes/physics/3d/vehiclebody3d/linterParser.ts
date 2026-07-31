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

// scene/3d/physics/vehicle_body_3d.cpp ADD_PROPERTY: "-180,180,0.01,radians_as_degrees".
// The range is expressed in degrees for the inspector slider, but the value
// serialised into a .tscn is the radian value the setter stores directly
// (doc/classes/VehicleBody3D.xml: "the property is set in radians"). No
// or_less/or_greater on this hint, so -180..180 degrees is a hard bound;
// converted to radians as a literal degrees-to-radians mapping (±π). The
// small epsilon absorbs float round-trip through the degrees<->radians
// conversion, the same technique CharacterBody3D's floor_max_angle uses
// for its own radians_as_degrees bound (a narrower one, chosen there for
// floor-vs-wall domain reasons rather than a literal hint conversion).
const PI_PLUS_EPSILON = Math.PI + 0.0001;

validatorRegistry.registerAll('VehicleBody3D', {
  // vehicle_body_3d.cpp ADD_PROPERTY: PROPERTY_HINT_RANGE
  // "-1024,1024,0.01,or_less,or_greater,...". Both or_less and or_greater are
  // present, so -1024/1024 are only the default slider extents, not enforced
  // bounds — the setter assigns the value straight through with no clamp.
  engine_force: v.float('engine_force'),
  // vehicle_body_3d.cpp ADD_PROPERTY: PROPERTY_HINT_RANGE
  // "-128,128,0.01,or_less,or_greater,...". Same soft-range shape as engine_force.
  brake: v.float('brake'),
  steering: v.float('steering', {
    min: -PI_PLUS_EPSILON,
    max: PI_PLUS_EPSILON,
    message: `Property 'steering' must be between ${(-Math.PI).toFixed(4)} and ${Math.PI.toFixed(4)} radians (-180 to 180 degrees)`,
  }),
});
