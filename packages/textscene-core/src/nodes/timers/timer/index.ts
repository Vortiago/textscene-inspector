/**
 * Timer parser and property formatter. Timer extends Node, so it has no
 * visual representation.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../core/NodeRegistry';
import { parseTimer } from './parser';

const timerRegistration: NodeTypeRegistration = {
  typeName: 'Timer',
  parser: parseTimer,
};

nodeRegistry.register(timerRegistration);

export * from './parser';
export * from './types';
