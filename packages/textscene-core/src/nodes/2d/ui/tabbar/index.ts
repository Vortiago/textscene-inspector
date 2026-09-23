/** TabBar registration: parser. Render registration lives in `index.r3f.ts`. */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseTabBar } from './parser';

const tabBarRegistration: NodeTypeRegistration = {
  typeName: 'TabBar',
  parser: parseTabBar,
};

nodeRegistry.register(tabBarRegistration);

export { tabBarRegistration };
