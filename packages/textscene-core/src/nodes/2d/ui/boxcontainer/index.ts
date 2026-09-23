/**
 * BoxContainer registration: the parser. It parses `alignment` and `vertical`
 * for the native (WebGL canvas) container layout in `nativeSolver.ts`.
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
