/** CanvasLayer registration: the parser. */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseCanvasLayer } from './parser';

const canvasLayerRegistration: NodeTypeRegistration = {
  typeName: 'CanvasLayer',
  parser: parseCanvasLayer,
};

nodeRegistry.register(canvasLayerRegistration);

export { canvasLayerRegistration };
export * from './parser';
export * from './types';
