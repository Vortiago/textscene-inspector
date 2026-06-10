/** Panel registration — parser. */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parsePanel } from './parser';

const panelRegistration: NodeTypeRegistration = {
  typeName: 'Panel',
  parser: parsePanel,
};

nodeRegistry.register(panelRegistration);

export { panelRegistration };
export * from './parser';
