/**
 * GrooveJoint2D registration: the parser. Property knowledge for the linter lives in linterParser.ts.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseGrooveJoint2D } from './parser';

const grooveJoint2DRegistration: NodeTypeRegistration = {
  typeName: 'GrooveJoint2D',
  parser: parseGrooveJoint2D,
};

nodeRegistry.register(grooveJoint2DRegistration);

export * from './parser';
export * from './types';
