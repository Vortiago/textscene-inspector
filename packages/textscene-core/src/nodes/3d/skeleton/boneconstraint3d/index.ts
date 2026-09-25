/**
 * BoneConstraint3D registration: the parser. A non-visual node, it renders as a transform-only group
 * (ADR-0008) through the Node3D transform parse, and index.r3f.ts reuses the Node3D component.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseNode3D } from '../../../base/node3d/parser';

const boneConstraint3DRegistration: NodeTypeRegistration = {
  typeName: 'BoneConstraint3D',
  parser: parseNode3D,
};

nodeRegistry.register(boneConstraint3DRegistration);

export { boneConstraint3DRegistration };
