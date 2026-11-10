/**
 * DampedSpringJoint2D registration: the parser. Property knowledge for the linter lives in linterParser.ts.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseDampedSpringJoint2D } from './parser';

const dampedSpringJoint2DRegistration: NodeTypeRegistration = {
  typeName: 'DampedSpringJoint2D',
  parser: parseDampedSpringJoint2D,
};

nodeRegistry.register(dampedSpringJoint2DRegistration);

export * from './parser';
export * from './types';
