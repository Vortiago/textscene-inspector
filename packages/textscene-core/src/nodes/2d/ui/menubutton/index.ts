/**
 * MenuButton registration — parser.
 *
 * `parseMenuButton` reuses Button's parse plus the one default MenuButton's
 * constructor overrides (`flat`); property knowledge for `switch_on_hover`,
 * `item_count` and the `popup/item_<idx>/<leaf>` family lives in
 * linterParser.ts/linter.ts — none of them affects rendering (see
 * `types.ts`'s own doc).
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseMenuButton } from './parser';

const menuButtonRegistration: NodeTypeRegistration = {
  typeName: 'MenuButton',
  parser: parseMenuButton,
};

nodeRegistry.register(menuButtonRegistration);

export { menuButtonRegistration };
