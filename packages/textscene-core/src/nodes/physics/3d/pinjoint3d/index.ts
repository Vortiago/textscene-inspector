/** PinJoint3D registration: the parser. Property knowledge for linting lives in linterParser.ts. */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseJoint3D } from '../joint3d/parser';

const pinJoint3DRegistration: NodeTypeRegistration = {
  typeName: 'PinJoint3D',
  parser: parseJoint3D,
};

nodeRegistry.register(pinJoint3DRegistration);
