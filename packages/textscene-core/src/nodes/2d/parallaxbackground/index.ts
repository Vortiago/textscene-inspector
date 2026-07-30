/**
 * ParallaxBackground registration — parser.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../core/NodeRegistry';
import { parseParallaxBackground } from './parser';

const parallaxBackgroundRegistration: NodeTypeRegistration = {
  typeName: 'ParallaxBackground',
  parser: parseParallaxBackground,
};

nodeRegistry.register(parallaxBackgroundRegistration);

export { parallaxBackgroundRegistration };
export * from './parser';
export * from './types';
