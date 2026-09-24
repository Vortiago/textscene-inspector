/**
 * GeometryInstance3D parser registration. It renders as a transform-only group
 * (ADR-0008) and reuses the Node3D transform parse.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../core/NodeRegistry';
import { parseNode3D } from '../../base/node3d/parser';

const geometryInstance3DRegistration: NodeTypeRegistration = {
  typeName: 'GeometryInstance3D',
  parser: parseNode3D,
};

nodeRegistry.register(geometryInstance3DRegistration);

export { geometryInstance3DRegistration };
