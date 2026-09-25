/**
 * AimModifier3D registration: the parser. It reuses the Node3D parse, and property knowledge
 * lives in linterParser.ts. It draws nothing by design (ADR-0008), so index.r3f.ts registers Node3D.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseNode3D } from '../../../base/node3d/parser';

const aimModifier3DRegistration: NodeTypeRegistration = {
  typeName: 'AimModifier3D',
  parser: parseNode3D,
};

nodeRegistry.register(aimModifier3DRegistration);

export { aimModifier3DRegistration };
