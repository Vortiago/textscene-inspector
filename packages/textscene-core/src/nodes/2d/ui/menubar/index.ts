/** Registers the MenuBar parser. Its `flat` lives in parser.ts, and its validators in linterParser.ts. */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseMenuBar } from './parser';

const menuBarRegistration: NodeTypeRegistration = {
  typeName: 'MenuBar',
  parser: parseMenuBar,
};

nodeRegistry.register(menuBarRegistration);

export { menuBarRegistration };
