/** HScrollBar registration: parser. */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseHScrollBar } from './parser';

const hScrollBarRegistration: NodeTypeRegistration = {
  typeName: 'HScrollBar',
  parser: parseHScrollBar,
};

nodeRegistry.register(hScrollBarRegistration);

export { hScrollBarRegistration };
export * from './parser';
export * from './types';
