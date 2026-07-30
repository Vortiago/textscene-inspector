/**
 * VehicleWheel3D parser — the Node3D transform surface plus the wheel's own
 * geometric and simulation properties. Unauthored keys stay `undefined`; see
 * types.ts for why the Godot defaults are not baked in here.
 */

import type { ParsedHeading } from '../../../../parser/utils';
import { parseNode3D } from '../../../base/node3d/parser';
import { parseOptionalBool, parseOptionalFloat } from '../../../../parser/valueParsers';
import type { VehicleWheel3DProperties } from './types';

export function parseVehicleWheel3D(
  heading: ParsedHeading,
  properties: Record<string, string>
): VehicleWheel3DProperties {
  const base = parseNode3D(heading, properties);
  return {
    ...base,
    wheel_radius: parseOptionalFloat(properties.wheel_radius),
    wheel_rest_length: parseOptionalFloat(properties.wheel_rest_length),
    wheel_friction_slip: parseOptionalFloat(properties.wheel_friction_slip),
    wheel_roll_influence: parseOptionalFloat(properties.wheel_roll_influence),
    suspension_stiffness: parseOptionalFloat(properties.suspension_stiffness),
    suspension_travel: parseOptionalFloat(properties.suspension_travel),
    suspension_max_force: parseOptionalFloat(properties.suspension_max_force),
    damping_compression: parseOptionalFloat(properties.damping_compression),
    damping_relaxation: parseOptionalFloat(properties.damping_relaxation),
    use_as_traction: parseOptionalBool(properties.use_as_traction),
    use_as_steering: parseOptionalBool(properties.use_as_steering),
    engine_force: parseOptionalFloat(properties.engine_force),
    brake: parseOptionalFloat(properties.brake),
    steering: parseOptionalFloat(properties.steering),
  };
}
