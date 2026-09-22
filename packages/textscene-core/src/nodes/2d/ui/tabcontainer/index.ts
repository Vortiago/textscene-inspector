/** TabContainer registration — parser. Render registration lives in `index.r3f.ts`. */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseTabContainer } from './parser';

const tabContainerRegistration: NodeTypeRegistration = {
  typeName: 'TabContainer',
  parser: parseTabContainer,
};

nodeRegistry.register(tabContainerRegistration);

export { tabContainerRegistration };
