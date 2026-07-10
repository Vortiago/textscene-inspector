/**
 * Timer registration — parser + property formatter.
 *
 * Timer extends Node (non-spatial), so it has no visual representation; the
 * render component (index.r3f.ts) reuses the base Node component so it
 * renders nothing visible.
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
