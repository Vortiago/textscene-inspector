/** ProgressBar registration — parser. */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseProgressBar } from './parser';

const progressBarRegistration: NodeTypeRegistration = {
  typeName: 'ProgressBar',
  parser: parseProgressBar,
};

nodeRegistry.register(progressBarRegistration);

export { progressBarRegistration };
export * from './parser';
export * from './types';
