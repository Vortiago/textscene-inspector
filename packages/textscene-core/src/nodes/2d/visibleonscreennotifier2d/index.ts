/**
 * VisibleOnScreenNotifier2D registration — parser.
 *
 * Non-visual node: renders as a transform-only group (ADR-0008), reusing the
 * Node2D transform parse; the render component (index.r3f.ts) reuses Node2D.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../core/NodeRegistry';
import { parseNode2D } from '../../base/node2d/parser';

const visibleOnScreenNotifier2DRegistration: NodeTypeRegistration = {
  typeName: 'VisibleOnScreenNotifier2D',
  parser: parseNode2D,
};

nodeRegistry.register(visibleOnScreenNotifier2DRegistration);

export { visibleOnScreenNotifier2DRegistration };
