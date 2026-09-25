/**
 * Skeleton3D registration: the parser. A non-visual node renders as a transform-only group
 * (ADR-0008), so both this parse and index.r3f.ts reuse Node3D's. The previewer shows where the
 * skeleton sits, not its bones.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../core/NodeRegistry';
import { parseNode3D } from '../../base/node3d/parser';

const skeleton3DRegistration: NodeTypeRegistration = {
  typeName: 'Skeleton3D',
  parser: parseNode3D,
};

nodeRegistry.register(skeleton3DRegistration);

export { skeleton3DRegistration };
