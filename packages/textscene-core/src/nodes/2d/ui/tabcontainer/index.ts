/** TabContainer registration: the parser. Render registration lives in `index.r3f.ts`. */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseTabContainer } from './parser';
import { tabContainerChildVisibility, tabContainerChildVisibilityWrite } from './childVisibility';

const tabContainerRegistration: NodeTypeRegistration = {
  typeName: 'TabContainer',
  parser: parseTabContainer,
  writesChildVisibility: tabContainerChildVisibility,
  answersChildVisibilityWrite: tabContainerChildVisibilityWrite,
};

nodeRegistry.register(tabContainerRegistration);
