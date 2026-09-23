/**
 * XRNode3D registration: the parser. The node renders as a transform-only group (ADR-0008). It
 * reuses the Node3D transform parse, and index.r3f.ts reuses the Node3D component.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseNode3D } from '../../../base/node3d/parser';

const xRNode3DRegistration: NodeTypeRegistration = {
  typeName: 'XRNode3D',
  parser: parseNode3D,
};

nodeRegistry.register(xRNode3DRegistration);

export { xRNode3DRegistration };
