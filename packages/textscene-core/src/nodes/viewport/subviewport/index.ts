/**
 * SubViewport registration — parser.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../core/NodeRegistry';
import { parseSubViewport } from './parser';

const subViewportRegistration: NodeTypeRegistration = {
  typeName: 'SubViewport',
  parser: parseSubViewport,
};

nodeRegistry.register(subViewportRegistration);

export { subViewportRegistration };
