/**
 * HSeparator registration: parser, the Control parse. The painter and
 * minimum-size solver register from `index.r3f.ts` (ADR-0001).
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseControl } from '../control/parser';

const hSeparatorRegistration: NodeTypeRegistration = {
  typeName: 'HSeparator',
  parser: parseControl,
};

nodeRegistry.register(hSeparatorRegistration);

export { hSeparatorRegistration };
