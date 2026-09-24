/** Registers the NinePatchRect parser. `index.r3f.ts` registers the render side. */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseNinePatchRect } from './parser';

const ninePatchRectRegistration: NodeTypeRegistration = {
  typeName: 'NinePatchRect',
  parser: parseNinePatchRect,
};

nodeRegistry.register(ninePatchRectRegistration);

export { ninePatchRectRegistration };
