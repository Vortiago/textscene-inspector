/**
 * VisibleOnScreenNotifier2D registration: the parser. The node is non-visual, so it renders as a
 * transform-only group (ADR-0008). It reuses the Node2D transform parse, and index.r3f.ts reuses
 * the Node2D component.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../core/NodeRegistry';
import { parseNode2D } from '../../base/node2d/parser';

const visibleOnScreenNotifier2DRegistration: NodeTypeRegistration = {
  typeName: 'VisibleOnScreenNotifier2D',
  parser: parseNode2D,
};

nodeRegistry.register(visibleOnScreenNotifier2DRegistration);

export { visibleOnScreenNotifier2DRegistration };
