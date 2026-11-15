/** Registers the ScrollContainer parser. */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { registerPaintRoom } from '../../../../r3f/canvasItemPass/paintRoom';
import { scrollContainerPaintRoom } from './paintRoom';
import { parseScrollContainer } from './parser';

const scrollContainerRegistration: NodeTypeRegistration = {
  typeName: 'ScrollContainer',
  parser: parseScrollContainer,
};

nodeRegistry.register(scrollContainerRegistration);
registerPaintRoom('ScrollContainer', scrollContainerPaintRoom);

export * from './parser';
