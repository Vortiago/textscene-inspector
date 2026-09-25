/**
 * VehicleBody3D parser registration: a transform-only group (ADR-0005, ADR-0008)
 * that reuses the Node3D parse. Its own properties drive only the simulation,
 * which a static preview does not run, so they are validated, not parsed.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseNode3D } from '../../../base/node3d/parser';

const vehicleBody3DRegistration: NodeTypeRegistration = {
  typeName: 'VehicleBody3D',
  parser: parseNode3D,
};

nodeRegistry.register(vehicleBody3DRegistration);

export { vehicleBody3DRegistration };
