/**
 * Registers the MenuButton parser: Button's parse plus the `flat` default MenuButton's constructor sets.
 * `switch_on_hover`, `item_count` and `popup/item_<idx>/<leaf>` live in linterParser.ts and linter.ts,
 * since none of them affects rendering.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseMenuButton } from './parser';

const menuButtonRegistration: NodeTypeRegistration = {
  typeName: 'MenuButton',
  parser: parseMenuButton,
};

nodeRegistry.register(menuButtonRegistration);

export { menuButtonRegistration };
