import type { InspectedNode, PropertyItem, PropertySection } from '../../../inspectedNode';
import { formatNode3DProperties } from '../../../base/node3d/propertyFormatter';
import { setRows } from '../../../setRows';

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
  { property: 'engine_force', label: 'Engine Force', text: String },
  { property: 'brake', label: 'Brake', text: String },
  { property: 'steering', label: 'Steering Angle', text: String },
];

export async function formatVehicleWheel3DProperties(node: InspectedNode): Promise<PropertySection[]> {
  const values = await node.read<string>([
    'use_as_traction',
    'use_as_steering',
    ...[...WHEEL_ROWS, ...SUSPENSION_ROWS].map(([, property]) => property),
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
        ...(await setRows(node, DRIVE_SET_ROWS)),
      ],
    },
    ...(await formatNode3DProperties(node)),
  ];
}
