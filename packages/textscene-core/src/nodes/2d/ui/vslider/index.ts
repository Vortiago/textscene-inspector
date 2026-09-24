/** VSlider registration: the parser. */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseVSlider } from './parser';

const vSliderRegistration: NodeTypeRegistration = {
  typeName: 'VSlider',
  parser: parseVSlider,
};

nodeRegistry.register(vSliderRegistration);

export { vSliderRegistration };
export * from './parser';
export * from './types';
