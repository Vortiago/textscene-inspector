/**
 * VehicleWheel3D property formatter.
 *
 * A wheel draws nothing itself, so the inspector is the only place its
 * configuration is legible. Godot's defaults are substituted here rather than at
 * parse time (types.ts), so the panel always shows the EFFECTIVE value — a wheel
 * that authors nothing still reads as the 0.5m/10.5-slip wheel Godot would
 * simulate.
 *
 * `engine_force` / `brake` / `steering` are runtime inputs a scene file rarely
 * authors; they appear only when actually set, so a static preview does not
 * imply a vehicle is accelerating.
 */

import type { PropertySection, PropertyItem } from '../../../../core/NodeRegistry';
import { formatNode3DProperties } from '../../../base/node3d/propertyFormatter';
import { VEHICLE_WHEEL_3D_DEFAULTS as DEFAULTS } from './types';
import type { VehicleWheel3DProperties } from './types';

export function formatVehicleWheel3DProperties(
  properties: VehicleWheel3DProperties
): PropertySection[] {
  const num = (value: number | undefined, fallback: number): string =>
    String(value ?? fallback);

  const drive: PropertyItem[] = [
    { label: 'Traction', value: String(properties.use_as_traction ?? DEFAULTS.use_as_traction) },
    { label: 'Steering', value: String(properties.use_as_steering ?? DEFAULTS.use_as_steering) },
  ];
  if (properties.engine_force !== undefined) {
    drive.push({ label: 'Engine Force', value: String(properties.engine_force) });
  }
  if (properties.brake !== undefined) {
    drive.push({ label: 'Brake', value: String(properties.brake) });
  }
  if (properties.steering !== undefined) {
    drive.push({ label: 'Steering Angle', value: String(properties.steering) });
  }

  const sections: PropertySection[] = [
    {
      title: 'Wheel',
      items: [
        { label: 'Radius', value: num(properties.wheel_radius, DEFAULTS.wheel_radius) },
        { label: 'Rest Length', value: num(properties.wheel_rest_length, DEFAULTS.wheel_rest_length) },
        { label: 'Friction Slip', value: num(properties.wheel_friction_slip, DEFAULTS.wheel_friction_slip) },
        { label: 'Roll Influence', value: num(properties.wheel_roll_influence, DEFAULTS.wheel_roll_influence) },
      ],
    },
    {
      title: 'Suspension',
      items: [
        { label: 'Stiffness', value: num(properties.suspension_stiffness, DEFAULTS.suspension_stiffness) },
        { label: 'Travel', value: num(properties.suspension_travel, DEFAULTS.suspension_travel) },
        { label: 'Max Force', value: num(properties.suspension_max_force, DEFAULTS.suspension_max_force) },
        { label: 'Damping Compression', value: num(properties.damping_compression, DEFAULTS.damping_compression) },
        { label: 'Damping Relaxation', value: num(properties.damping_relaxation, DEFAULTS.damping_relaxation) },
      ],
    },
    { title: 'Drive', items: drive },
  ];

  sections.push(...formatNode3DProperties(properties));
  return sections;
}
