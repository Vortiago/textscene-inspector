/** Panel registration — parser. */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parsePanel, isPanel } from './parser';

const panelRegistration: NodeTypeRegistration = {
  typeName: 'Panel',
  typeGuard: isPanel,
  parser: parsePanel,
};

nodeRegistry.register(panelRegistration);

export { panelRegistration };
export * from './parser';
