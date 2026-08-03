/**
 * VehicleBody3D registration — parser.
 *
 * A RigidBody3D subclass driven by its VehicleWheel3D children. Non-visual node:
 * renders as a transform-only group (ADR-0005, ADR-0008), reusing the Node3D
 * transform parse; the render component (index.r3f.ts) reuses Node3D. Its own
 * properties (mass, engine_force, brake, steering, …) drive simulation only,
 * which a static preview does not run — they are validated, not parsed.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseNode3D } from '../../../base/node3d/parser';

const vehicleBody3DRegistration: NodeTypeRegistration = {
  typeName: 'VehicleBody3D',
  parser: parseNode3D,
};

nodeRegistry.register(vehicleBody3DRegistration);

export { vehicleBody3DRegistration };
