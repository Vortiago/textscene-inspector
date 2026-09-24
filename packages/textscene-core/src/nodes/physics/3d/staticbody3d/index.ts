/**
 * StaticBody3D parser registration. A physics body is a transform-only group
 * (ADR-0005), with no simulation and no own geometry, so it reuses the Node3D parse.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseNode3D } from '../../../base/node3d/parser';

const staticBody3DRegistration: NodeTypeRegistration = {
  typeName: 'StaticBody3D',
  parser: parseNode3D,
};

nodeRegistry.register(staticBody3DRegistration);

export { staticBody3DRegistration };
