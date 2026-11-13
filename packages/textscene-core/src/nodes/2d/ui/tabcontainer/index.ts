/** TabContainer registration: the parser. Render registration lives in `index.r3f.ts`. */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseTabContainer } from './parser';
import { tabContainerChildVisibility } from './childVisibility';

const tabContainerRegistration: NodeTypeRegistration = {
  typeName: 'TabContainer',
  parser: parseTabContainer,
  writesChildVisibility: tabContainerChildVisibility,
};

nodeRegistry.register(tabContainerRegistration);
