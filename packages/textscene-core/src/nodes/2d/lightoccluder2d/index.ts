/**
 * LightOccluder2D registration — parser.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../core/NodeRegistry';
import { parseLightOccluder2D } from './parser';

const lightOccluder2DRegistration: NodeTypeRegistration = {
  typeName: 'LightOccluder2D',
  parser: parseLightOccluder2D,
};

nodeRegistry.register(lightOccluder2DRegistration);

export { lightOccluder2DRegistration };
