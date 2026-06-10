/**
 * Marker3D registration — parser.
 *
 * Non-visual node: renders as a transform-only group (ADR-0008), reusing the
 * Node3D transform parse; the render component (index.r3f.ts) reuses Node3D.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../core/NodeRegistry';
import { parseNode3D } from '../../base/node3d/parser';

const marker3DRegistration: NodeTypeRegistration = {
  typeName: 'Marker3D',
  parser: parseNode3D,
};

nodeRegistry.register(marker3DRegistration);

export { marker3DRegistration };
