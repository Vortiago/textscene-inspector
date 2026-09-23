/**
 * ConeTwistJoint3D registration: the parser.
 *
 * It reuses the Node3D parse, and property knowledge lives in linterParser.ts. It
 * draws nothing by design (ADR-0008), so index.r3f.ts registers Node3D and its children
 * still land in the right transform space.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseNode3D } from '../../../base/node3d/parser';

const coneTwistJoint3DRegistration: NodeTypeRegistration = {
  typeName: 'ConeTwistJoint3D',
  parser: parseNode3D,
};

nodeRegistry.register(coneTwistJoint3DRegistration);

export { coneTwistJoint3DRegistration };
