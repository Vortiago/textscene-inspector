/**
 * VisualInstance3D registration: the parser. The node renders as a transform-only group (ADR-0008). It
 * reuses the Node3D transform parse, and index.r3f.ts reuses the Node3D component.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../core/NodeRegistry';
import { parseNode3D } from '../../base/node3d/parser';

const visualInstance3DRegistration: NodeTypeRegistration = {
  typeName: 'VisualInstance3D',
  parser: parseNode3D,
};

nodeRegistry.register(visualInstance3DRegistration);

export { visualInstance3DRegistration };
