/**
 * VehicleBody3D strict validators for linting.
 *
 * Only the three properties VehicleBody3D adds to RigidBody3D. Everything else a
 * vehicle body commonly authors — `mass`, `physics_material_override`,
 * `center_of_mass_mode` — is a RigidBody3D property and reaches this type
 * through the `VehicleBody3D → RigidBody3D` link in nodeBaseTypes.ts, so
 * duplicating it here would be two sources of truth for one rule.
 */

import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';

validatorRegistry.registerAll('VehicleBody3D', {
  engine_force: v.float('engine_force'),
  brake: v.float('brake', {
    min: 0,
    message: "Property 'brake' must be >= 0. Braking force cannot be negative.",
  }),
  steering: v.float('steering'),
});
