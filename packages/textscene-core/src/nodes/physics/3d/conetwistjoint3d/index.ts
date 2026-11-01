/** ConeTwistJoint3D registration: the parser. Property knowledge for linting lives in linterParser.ts. */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseConeTwistJoint3D } from './parser';

const coneTwistJoint3DRegistration: NodeTypeRegistration = {
  typeName: 'ConeTwistJoint3D',
  parser: parseConeTwistJoint3D,
};

nodeRegistry.register(coneTwistJoint3DRegistration);
