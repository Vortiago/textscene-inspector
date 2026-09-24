/** Registers the ReferenceRect parser. `index.r3f.ts` registers the painter (ADR-0001). */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseReferenceRect } from './parser';

const referenceRectRegistration: NodeTypeRegistration = {
  typeName: 'ReferenceRect',
  parser: parseReferenceRect,
};

nodeRegistry.register(referenceRectRegistration);

export { referenceRectRegistration };
export * from './parser';
export * from './types';
