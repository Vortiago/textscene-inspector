/**
 * SplitContainer registration — parser.
 *
 * Parses `split_offset`/`collapsed`/`dragger_visibility` and `vertical`
 * (this base's own, unlike its fixed-axis subclasses — `types.ts`'s doc), so
 * the native (WebGL canvas) container layout registered in `nativeSolver.ts`
 * can read them.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseSplitContainer } from './parser';

const splitContainerRegistration: NodeTypeRegistration = {
  typeName: 'SplitContainer',
  parser: parseSplitContainer,
};

nodeRegistry.register(splitContainerRegistration);

export { splitContainerRegistration };
export * from './parser';
export * from './types';
