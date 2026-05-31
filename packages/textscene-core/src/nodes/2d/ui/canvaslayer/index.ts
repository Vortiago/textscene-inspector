/** CanvasLayer registration — parser. */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseCanvasLayer, isCanvasLayer } from './parser';

const canvasLayerRegistration: NodeTypeRegistration = {
  typeName: 'CanvasLayer',
  typeGuard: isCanvasLayer,
  parser: parseCanvasLayer,
};

nodeRegistry.register(canvasLayerRegistration);

export { canvasLayerRegistration };
export * from './parser';
export * from './types';
