/**
 * MenuBar registration — parser.
 *
 * Own property knowledge (`flat`) lives in parser.ts; format-validation for
 * every own property lives in linterParser.ts.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseMenuBar } from './parser';

const menuBarRegistration: NodeTypeRegistration = {
  typeName: 'MenuBar',
  parser: parseMenuBar,
};

nodeRegistry.register(menuBarRegistration);

export { menuBarRegistration };
