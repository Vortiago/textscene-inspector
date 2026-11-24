/** AreaLight3D parser and formatter registration. */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseAreaLight3D } from './parser';

const areaLight3DRegistration: NodeTypeRegistration = {
  typeName: 'AreaLight3D',
  parser: parseAreaLight3D,
};

nodeRegistry.register(areaLight3DRegistration);

export * from './parser';
export * from './types';
