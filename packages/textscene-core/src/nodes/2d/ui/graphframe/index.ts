/** GraphFrame registration — parser. */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseGraphFrame } from './parser';

const graphFrameRegistration: NodeTypeRegistration = {
  typeName: 'GraphFrame',
  parser: parseGraphFrame,
};

nodeRegistry.register(graphFrameRegistration);

export { graphFrameRegistration };
export * from './parser';
export * from './types';
