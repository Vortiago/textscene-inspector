/**
 * SpringArm3D parser registration: the Node3D parse plus `spring_length`. Property
 * knowledge lives in linterParser.ts. Its Godot effect on its children is not
 * implemented here yet (ADR-0045), so index.r3f.ts registers it as `pending`.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseSpringArm3D } from './parser';

const springArm3DRegistration: NodeTypeRegistration = {
  typeName: 'SpringArm3D',
  parser: parseSpringArm3D,
};

nodeRegistry.register(springArm3DRegistration);

export * from './parser';
export * from './types';
