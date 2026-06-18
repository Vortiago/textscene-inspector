/**
 * GridMap registration — parser.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../core/NodeRegistry';
import { parseGridMap } from './parser';

const gridMapRegistration: NodeTypeRegistration = {
  typeName: 'GridMap',
  parser: parseGridMap,
};

nodeRegistry.register(gridMapRegistration);

export { gridMapRegistration };
