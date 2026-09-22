/**
 * HSeparator registration — parser.
 *
 * Reuses the Control parse; property knowledge lives in linterParser.ts. The
 * native (WebGL canvas) painter and minimum-size solver register separately,
 * from `index.r3f.ts` (ADR-0001).
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseControl } from '../control/parser';

const hSeparatorRegistration: NodeTypeRegistration = {
  typeName: 'HSeparator',
  parser: parseControl,
};

nodeRegistry.register(hSeparatorRegistration);

export { hSeparatorRegistration };
