/** GraphEdit registration: the parser. */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { registerPaintRoom } from '../../../../r3f/canvasItemPass/paintRoom';
import { graphEditPaintRoom } from './paintRoom';
import { parseGraphEdit } from './parser';

const graphEditRegistration: NodeTypeRegistration = {
  typeName: 'GraphEdit',
  parser: parseGraphEdit,
};

nodeRegistry.register(graphEditRegistration);
registerPaintRoom('GraphEdit', graphEditPaintRoom);

export * from './parser';
export * from './types';
