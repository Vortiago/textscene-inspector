/** Generic6DOFJoint3D registration: the parser. Property knowledge for linting lives in linterParser.ts. */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseGeneric6DOFJoint3D } from './parser';

const generic6DOFJoint3DRegistration: NodeTypeRegistration = {
  typeName: 'Generic6DOFJoint3D',
  parser: parseGeneric6DOFJoint3D,
};

nodeRegistry.register(generic6DOFJoint3DRegistration);
