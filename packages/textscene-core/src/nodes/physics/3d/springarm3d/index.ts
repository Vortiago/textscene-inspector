/** SpringArm3D parser registration. Property knowledge lives in linterParser.ts. */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseSpringArm3D } from './parser';

const springArm3DRegistration: NodeTypeRegistration = {
  typeName: 'SpringArm3D',
  parser: parseSpringArm3D,
};

nodeRegistry.register(springArm3DRegistration);

export * from './parser';
export * from './types';
