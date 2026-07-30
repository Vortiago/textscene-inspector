/**
 * Popup registration — parser.
 *
 * Non-visual node: renders as a transform-only group (ADR-0008), reusing the
 * Node transform parse; the render component (index.r3f.ts) reuses Node.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../core/NodeRegistry';
import { parseNode } from '../../node/parser';

const popupRegistration: NodeTypeRegistration = {
  typeName: 'Popup',
  parser: parseNode,
};

nodeRegistry.register(popupRegistration);

export { popupRegistration };
