/** RayCast3D parser registration. Property knowledge lives in linterParser.ts. */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseRayCast3D } from './parser';

const rayCast3DRegistration: NodeTypeRegistration = {
  typeName: 'RayCast3D',
  parser: parseRayCast3D,
};

nodeRegistry.register(rayCast3DRegistration);

export * from './parser';
export * from './types';
