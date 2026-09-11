/** VScrollBar registration — parser. */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseVScrollBar } from './parser';

const vScrollBarRegistration: NodeTypeRegistration = {
  typeName: 'VScrollBar',
  parser: parseVScrollBar,
};

nodeRegistry.register(vScrollBarRegistration);

export { vScrollBarRegistration };
export * from './parser';
export * from './types';
