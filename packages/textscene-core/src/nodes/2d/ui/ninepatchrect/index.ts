/** NinePatchRect registration: parser. The render side is `index.r3f.ts`. */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseNinePatchRect } from './parser';

const ninePatchRectRegistration: NodeTypeRegistration = {
  typeName: 'NinePatchRect',
  parser: parseNinePatchRect,
};

nodeRegistry.register(ninePatchRectRegistration);

export { ninePatchRectRegistration };
