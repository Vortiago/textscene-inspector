/** SliderJoint3D registration: the parser. Property knowledge for linting lives in linterParser.ts. */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseSliderJoint3D } from './parser';

const sliderJoint3DRegistration: NodeTypeRegistration = {
  typeName: 'SliderJoint3D',
  parser: parseSliderJoint3D,
};

nodeRegistry.register(sliderJoint3DRegistration);
