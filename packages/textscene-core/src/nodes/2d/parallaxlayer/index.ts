/** Registers the ParallaxLayer parser. */

import { nodeRegistry, type NodeTypeRegistration } from '../../../core/NodeRegistry';
import { parseParallaxLayer } from './parser';

const parallaxLayerRegistration: NodeTypeRegistration = {
  typeName: 'ParallaxLayer',
  parser: parseParallaxLayer,
};

nodeRegistry.register(parallaxLayerRegistration);

export { parallaxLayerRegistration };
export * from './parser';
export * from './types';
