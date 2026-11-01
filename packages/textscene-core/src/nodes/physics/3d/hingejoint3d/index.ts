/** HingeJoint3D registration: the parser. Property knowledge for linting lives in linterParser.ts. */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseHingeJoint3D } from './parser';

const hingeJoint3DRegistration: NodeTypeRegistration = {
  typeName: 'HingeJoint3D',
  parser: parseHingeJoint3D,
};

nodeRegistry.register(hingeJoint3DRegistration);
