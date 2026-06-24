/** Marker2D registration — parser. */

import { nodeRegistry, type NodeTypeRegistration } from '../../../core/NodeRegistry';
import { parseMarker2D } from './parser';

const marker2DRegistration: NodeTypeRegistration = {
  typeName: 'Marker2D',
  parser: parseMarker2D,
};

nodeRegistry.register(marker2DRegistration);

export { marker2DRegistration };
export * from './parser';
export * from './types';
