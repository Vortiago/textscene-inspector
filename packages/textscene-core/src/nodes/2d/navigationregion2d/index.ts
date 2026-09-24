/** Registers the NavigationRegion2D parser. */

import { nodeRegistry, type NodeTypeRegistration } from '../../../core/NodeRegistry';
import { parseNavigationRegion2D } from './parser';

const navigationRegion2DRegistration: NodeTypeRegistration = {
  typeName: 'NavigationRegion2D',
  parser: parseNavigationRegion2D,
};

nodeRegistry.register(navigationRegion2DRegistration);

export { navigationRegion2DRegistration };
