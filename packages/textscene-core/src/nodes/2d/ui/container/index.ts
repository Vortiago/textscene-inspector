/**
 * Container registration — parser.
 *
 * Non-visual node: renders as a transform-only group (ADR-0008), reusing the
 * Control transform parse; the render component (index.r3f.ts) reuses Control.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseControl } from '../../../2d/ui/control/parser';

const containerRegistration: NodeTypeRegistration = {
  typeName: 'Container',
  parser: parseControl,
};

nodeRegistry.register(containerRegistration);

export { containerRegistration };
