/** Control registration: the parser. */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { registerPaintRoom } from '../../../../r3f/canvasItemPass/paintRoom';
import { controlPaintRoom } from './paintRoom';
import { parseControl } from './parser';

const controlRegistration: NodeTypeRegistration = {
  typeName: 'Control',
  parser: parseControl,
};

nodeRegistry.register(controlRegistration);
registerPaintRoom('Control', controlPaintRoom);

export * from './parser';
export * from './types';
