/**
 * NavigationRegion3D registration: parser.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../core/NodeRegistry';
import { parseNavigationRegion3D } from './parser';

const navigationRegion3DRegistration: NodeTypeRegistration = {
  typeName: 'NavigationRegion3D',
  parser: parseNavigationRegion3D,
};

nodeRegistry.register(navigationRegion3DRegistration);

export { navigationRegion3DRegistration };
