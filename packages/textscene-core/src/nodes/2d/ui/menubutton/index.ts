/**
 * MenuButton registration — parser.
 *
 * Reuses the Control parse; property knowledge lives in linterParser.ts.
 * Not rendered yet, so it registers NO component: the dispatcher falls back to
 * GenericNodeFallback and the tree keeps reporting it as not implemented.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseButton } from '../button/parser';

const menuButtonRegistration: NodeTypeRegistration = {
  typeName: 'MenuButton',
  parser: parseButton,
};

nodeRegistry.register(menuButtonRegistration);

export { menuButtonRegistration };
