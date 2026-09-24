/** CanvasModulate registration: the parser. */

import { nodeRegistry, type NodeTypeRegistration } from '../../../core/NodeRegistry';
import { parseCanvasModulate } from './parser';

const canvasModulateRegistration: NodeTypeRegistration = {
  typeName: 'CanvasModulate',
  parser: parseCanvasModulate,
};

nodeRegistry.register(canvasModulateRegistration);

export { canvasModulateRegistration };
export * from './parser';
export * from './types';
