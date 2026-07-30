/** HSlider registration — parser. */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseHSlider } from './parser';

const hSliderRegistration: NodeTypeRegistration = {
  typeName: 'HSlider',
  parser: parseHSlider,
};

nodeRegistry.register(hSliderRegistration);

export { hSliderRegistration };
export * from './parser';
export * from './types';
