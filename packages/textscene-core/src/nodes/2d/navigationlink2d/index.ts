/**
 * Registers the NavigationLink2D parser. It reuses the Node2D parse, and its
 * property knowledge lives in linterParser.ts.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../core/NodeRegistry';
import { parseNode2D } from '../../base/node2d/parser';

const navigationLink2DRegistration: NodeTypeRegistration = {
  typeName: 'NavigationLink2D',
  parser: parseNode2D,
};

nodeRegistry.register(navigationLink2DRegistration);

export { navigationLink2DRegistration };
