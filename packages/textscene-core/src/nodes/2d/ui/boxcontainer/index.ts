/**
 * BoxContainer registration — parser.
 *
 * Parses `alignment` and `vertical` (this base's own, unlike its fixed-axis
 * subclasses — `types.ts`'s doc), so the native (WebGL canvas) container
 * layout registered in `nativeSolver.ts` can read them.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseBoxContainer } from './parser';

const boxContainerRegistration: NodeTypeRegistration = {
  typeName: 'BoxContainer',
  parser: parseBoxContainer,
};

nodeRegistry.register(boxContainerRegistration);

export { boxContainerRegistration };
export * from './parser';
export * from './types';
