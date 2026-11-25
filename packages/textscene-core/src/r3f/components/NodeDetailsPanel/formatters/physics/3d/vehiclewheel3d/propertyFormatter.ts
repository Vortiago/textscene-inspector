import type { InspectedNode, PropertyItem, PropertySection } from '../../../inspectedNode';
import { formatNode3DProperties } from '../../../base/node3d/propertyFormatter';

/** Each section's rows: the label and the property it reads. */
const WHEEL_ROWS = [
  ['Radius', 'wheel_radius'],
  ['Rest Length', 'wheel_rest_length'],
  ['Friction Slip', 'wheel_friction_slip'],
  ['Roll Influence', 'wheel_roll_influence'],
] as const;

const SUSPENSION_ROWS = [
  ['Stiffness', 'suspension_stiffness'],
  ['Travel', 'suspension_travel'],
  ['Max Force', 'suspension_max_force'],
  ['Damping Compression', 'damping_compression'],
  ['Damping Relaxation', 'damping_relaxation'],
] as const;

/** The forces a script drives each frame, shown only where the file sets them. */
const DRIVE_SET_ROWS = [
  ['Engine Force', 'engine_force'],
  ['Brake', 'brake'],
  ['Steering Angle', 'steering'],
] as const;

export async function formatVehicleWheel3DProperties(node: InspectedNode): Promise<PropertySection[]> {
  const driveSetRows = DRIVE_SET_ROWS.filter(([, property]) => node.fileProperties.has(property));
  const values = await node.read<string>([
    'use_as_traction',
    'use_as_steering',
    ...[...WHEEL_ROWS, ...SUSPENSION_ROWS, ...driveSetRows].map(([, property]) => property),
  ]);
  const rows = (pairs: readonly (readonly [string, string])[]): PropertyItem[] =>
    pairs.map(([label, property]) => ({ label, value: String(values.number(property)) }));
  return [
    { title: 'Wheel', items: rows(WHEEL_ROWS) },
    { title: 'Suspension', items: rows(SUSPENSION_ROWS) },
    {
      title: 'Drive',
      items: [
        { label: 'Traction', value: String(values.boolean('use_as_traction')) },
        { label: 'Steering', value: String(values.boolean('use_as_steering')) },
        ...rows(driveSetRows),
      ],
    },
    ...(await formatNode3DProperties(node)),
  ];
}
