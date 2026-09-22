/** AspectRatioContainer registration — parser. Render side: `./index.r3f`. */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseAspectRatioContainer } from './parser';

const aspectRatioContainerRegistration: NodeTypeRegistration = {
  typeName: 'AspectRatioContainer',
  parser: parseAspectRatioContainer,
};

nodeRegistry.register(aspectRatioContainerRegistration);

export { aspectRatioContainerRegistration };
export * from './parser';
export * from './types';
