/**
 * TouchScreenButton registration: the parser. It reuses the Node2D parse, and
 * property knowledge lives in linterParser.ts.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../core/NodeRegistry';
import { parseNode2D } from '../../base/node2d/parser';

const touchScreenButtonRegistration: NodeTypeRegistration = {
  typeName: 'TouchScreenButton',
  parser: parseNode2D,
};

nodeRegistry.register(touchScreenButtonRegistration);

export { touchScreenButtonRegistration };
