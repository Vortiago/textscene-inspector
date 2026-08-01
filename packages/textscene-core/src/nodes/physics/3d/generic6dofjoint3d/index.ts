/**
 * Generic6DOFJoint3D registration — parser.
 *
 * Reuses the Node3D parse; property knowledge lives in linterParser.ts.
 * Draws nothing by design (ADR-0008), so index.r3f.ts registers Node3D
 * and its children still land in the right transform space.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseNode3D } from '../../../base/node3d/parser';

const generic6DOFJoint3DRegistration: NodeTypeRegistration = {
  typeName: 'Generic6DOFJoint3D',
  parser: parseNode3D,
};

nodeRegistry.register(generic6DOFJoint3DRegistration);

export { generic6DOFJoint3DRegistration };
