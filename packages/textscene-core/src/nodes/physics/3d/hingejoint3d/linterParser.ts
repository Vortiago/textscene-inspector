/**
 * HingeJoint3D strict validators for linting.
 *
 * Declare only HingeJoint3D's OWN members — the ones doc/classes/HingeJoint3D.xml
 * lists without an `overrides=` attribute. Everything from Joint3D up is
 * registered on the ancestor and delivered by the NODE_BASE_TYPES base-walk, so
 * re-declaring an inherited key shadows it and duplicates the rule.
 *
 * All ten members come straight from `hinge_joint_3d.cpp`'s `_bind_methods`,
 * every one an `ADD_PROPERTYI` with both a setter and a getter (no
 * `PROPERTY_USAGE_NONE`, no getter-only entry), so none is skipped on rules 3/4.
 * `angular_limit/softness` carries a `deprecated=` note in the XML ("never set
 * by the engine, kept for compatibility") but no `overrides=`, so it is still
 * this class's own serialised property and still gets a validator.
 *
 * Two Godot property groups, `angular_limit/*` and `motor/*`, plus one bare
 * `params/bias`. Each group is small and fixed (Godot never adds a member to it
 * at runtime, unlike PhysicalBone3D's per-joint-type `joint_constraints/...`),
 * so the keys are enumerated directly rather than routed through a wildcard
 * dispatch table.
 */

import '../../joints/shared/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';

// hinge_joint_3d.cpp:43-44 ADD_PROPERTYI: PROPERTY_HINT_RANGE
// "-180,180,0.1,radians_as_degrees", no or_less/or_greater on either bound. The
// hint's degrees describe the inspector slider; the value serialised into a
// .tscn is the radian value set_param/get_param store directly (bare `real_t`
// field, plain assignment setter) — doc/classes/HingeJoint3D.xml's defaults
// confirm it: -1.5707964/1.5707964 is -π/2 and π/2, not -90/90. So the hard
// bound is ±π radians, not ±180. The small epsilon absorbs float round-trip
// through the degrees<->radians conversion, the same technique VehicleBody3D's
// `steering` and PinJoint2D's `angular_limit_lower/upper` use for the identical
// hint shape.
const PI_PLUS_EPSILON = Math.PI + 0.0001;

function radiansRangeMessage(name: string): string {
  return `Property '${name}' must be between ${(-Math.PI).toFixed(4)} and ${Math.PI.toFixed(4)} radians (-180 to 180 degrees)`;
}

validatorRegistry.registerAll('HingeJoint3D', {
  // hinge_joint_3d.cpp:40 — PROPERTY_HINT_RANGE "0.00,0.99,0.01", both bounds hard.
  'params/bias': v.float('params/bias', { min: 0, max: 0.99 }),

  // hinge_joint_3d.cpp:42 — plain BOOL, no hint (set_flag/get_flag on FLAG_USE_LIMIT).
  'angular_limit/enable': v.boolean('angular_limit/enable'),
  'angular_limit/upper': v.float('angular_limit/upper', {
    min: -PI_PLUS_EPSILON,
    max: PI_PLUS_EPSILON,
    message: radiansRangeMessage('angular_limit/upper'),
  }),
  'angular_limit/lower': v.float('angular_limit/lower', {
    min: -PI_PLUS_EPSILON,
    max: PI_PLUS_EPSILON,
    message: radiansRangeMessage('angular_limit/lower'),
  }),
  // hinge_joint_3d.cpp:45 — PROPERTY_HINT_RANGE "0.01,0.99,0.01", both bounds hard.
  'angular_limit/bias': v.float('angular_limit/bias', { min: 0.01, max: 0.99 }),
  // hinge_joint_3d.cpp:46 — PROPERTY_HINT_RANGE "0.01,16,0.01", both bounds hard.
  // Deprecated (never set by the engine itself) but still a real ADD_PROPERTY.
  'angular_limit/softness': v.float('angular_limit/softness', { min: 0.01, max: 16 }),
  // hinge_joint_3d.cpp:47 — PROPERTY_HINT_RANGE "0.01,16,0.01", both bounds hard.
  'angular_limit/relaxation': v.float('angular_limit/relaxation', { min: 0.01, max: 16 }),

  // hinge_joint_3d.cpp:49 — plain BOOL, no hint (set_flag/get_flag on FLAG_ENABLE_MOTOR).
  'motor/enable': v.boolean('motor/enable'),
  // hinge_joint_3d.cpp:50 — PROPERTY_HINT_RANGE
  // "-200,200,0.01,or_greater,or_less,radians_as_degrees,suffix:°/s". Both
  // or_greater AND or_less are present, so -200/200 are only the default
  // slider extents — the setter assigns the value straight through with no
  // clamp, so any finite float is legal regardless of the radians_as_degrees
  // display hint (there is no hard bound left to convert).
  'motor/target_velocity': v.float('motor/target_velocity'),
  // hinge_joint_3d.cpp:51 — PROPERTY_HINT_RANGE "0.01,1024,0.01", both bounds hard.
  'motor/max_impulse': v.float('motor/max_impulse', { min: 0.01, max: 1024 }),
});
