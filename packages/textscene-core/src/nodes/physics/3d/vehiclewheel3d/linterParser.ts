/**
 * VehicleWheel3D strict validators for linting.
 *
 * Exactly the keys parser.ts reads — propertyGrammarParity requires the two
 * sides to agree, and a wheel property the lenient parser understands but the
 * strict one waves through would be a silent hole.
 *
 * Ranges are deliberately loose: only physically impossible values are errors
 * (a negative radius, a negative spring rate). Godot's *recommended* ranges are
 * advisory and belong in linter.ts as warnings — real scenes routinely ship
 * suspension values well outside them, and erroring would make a working scene
 * unlintable over a tuning preference.
 */

import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';

validatorRegistry.registerAll('VehicleWheel3D', {
  wheel_radius: v.float('wheel_radius', {
    min: 0,
    message: "Property 'wheel_radius' must be >= 0. A wheel cannot have negative radius.",
  }),
  wheel_rest_length: v.float('wheel_rest_length'),
  wheel_friction_slip: v.float('wheel_friction_slip', {
    min: 0,
    message: "Property 'wheel_friction_slip' must be >= 0. Grip cannot be negative.",
  }),
  wheel_roll_influence: v.float('wheel_roll_influence'),
  suspension_stiffness: v.float('suspension_stiffness', {
    min: 0,
    message: "Property 'suspension_stiffness' must be >= 0. Spring rate cannot be negative.",
  }),
  suspension_travel: v.float('suspension_travel', {
    min: 0,
    message: "Property 'suspension_travel' must be >= 0. Travel distance cannot be negative.",
  }),
  suspension_max_force: v.float('suspension_max_force', {
    min: 0,
    message: "Property 'suspension_max_force' must be >= 0. Spring force cannot be negative.",
  }),
  damping_compression: v.float('damping_compression', {
    min: 0,
    message: "Property 'damping_compression' must be >= 0. Damping cannot be negative.",
  }),
  damping_relaxation: v.float('damping_relaxation', {
    min: 0,
    message: "Property 'damping_relaxation' must be >= 0. Damping cannot be negative.",
  }),
  use_as_traction: v.boolean('use_as_traction'),
  use_as_steering: v.boolean('use_as_steering'),
  engine_force: v.float('engine_force'),
  brake: v.float('brake', {
    min: 0,
    message: "Property 'brake' must be >= 0. Braking force cannot be negative.",
  }),
  steering: v.float('steering'),
});
