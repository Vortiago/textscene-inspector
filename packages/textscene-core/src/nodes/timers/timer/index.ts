/**
 * Timer parser and property formatter. Timer extends Node, so it has no
 * visual representation.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../core/NodeRegistry';
import { parseTimer } from './parser';
import { formatTimerProperties } from './propertyFormatter';

const timerRegistration: NodeTypeRegistration = {
  typeName: 'Timer',
  parser: parseTimer,
  propertyFormatter: formatTimerProperties,
};

nodeRegistry.register(timerRegistration);

export { timerRegistration };
export * from './parser';
export * from './propertyFormatter';
export * from './types';
