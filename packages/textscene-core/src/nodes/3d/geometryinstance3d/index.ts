/**
 * GeometryInstance3D parser registration. It renders as a transform-only group
 * (ADR-0008) and parses as the base every GeometryInstance3D leaf starts from.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../core/NodeRegistry';
import { parseGeometryInstance3D } from './parser';

const geometryInstance3DRegistration: NodeTypeRegistration = {
  typeName: 'GeometryInstance3D',
  parser: parseGeometryInstance3D,
};

nodeRegistry.register(geometryInstance3DRegistration);

export { geometryInstance3DRegistration };
