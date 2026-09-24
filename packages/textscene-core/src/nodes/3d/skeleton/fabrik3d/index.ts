/**
 * FABRIK3D registration: the parser. It reuses the Node3D parse, and property knowledge
 * lives in linterParser.ts. It draws nothing by design (ADR-0008), so index.r3f.ts registers Node3D.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseNode3D } from '../../../base/node3d/parser';

const fABRIK3DRegistration: NodeTypeRegistration = {
  typeName: 'FABRIK3D',
  parser: parseNode3D,
};

nodeRegistry.register(fABRIK3DRegistration);

export { fABRIK3DRegistration };
