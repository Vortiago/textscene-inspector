/**
 * NavigationAgent2D registration: the parser, which reuses the Node parse.
 * linterParser.ts holds the property validators.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../core/NodeRegistry';
import { parseNode } from '../../node/parser';

const navigationAgent2DRegistration: NodeTypeRegistration = {
  typeName: 'NavigationAgent2D',
  parser: parseNode,
};

nodeRegistry.register(navigationAgent2DRegistration);

export { navigationAgent2DRegistration };
