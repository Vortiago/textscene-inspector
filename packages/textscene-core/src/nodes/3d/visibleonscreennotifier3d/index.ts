/**
 * VisibleOnScreenNotifier3D registration: the parser. The node renders as a transform-only group (ADR-0008). It
 * reuses the Node3D transform parse, and index.r3f.ts reuses the Node3D component.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../core/NodeRegistry';
import { parseNode3D } from '../../base/node3d/parser';

const visibleOnScreenNotifier3DRegistration: NodeTypeRegistration = {
  typeName: 'VisibleOnScreenNotifier3D',
  parser: parseNode3D,
};

nodeRegistry.register(visibleOnScreenNotifier3DRegistration);

export { visibleOnScreenNotifier3DRegistration };
