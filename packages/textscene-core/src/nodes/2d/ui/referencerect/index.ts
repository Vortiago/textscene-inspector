/**
 * ReferenceRect registration — parser.
 *
 * `border_color`/`border_width`/`editor_only` now have typed properties
 * (`types.ts`) and a dedicated parser. The native (WebGL canvas) painter
 * registers separately, from `index.r3f.ts` (ADR-0001).
 */

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
