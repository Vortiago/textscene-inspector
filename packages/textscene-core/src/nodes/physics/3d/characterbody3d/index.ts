/**
 * CharacterBody3D registration: the parser.
 *
 * A non-visual node that renders as a transform-only group (ADR-0005, ADR-0008). It reuses
 * the Node3D transform parse, and the render component (index.r3f.ts) reuses Node3D.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseNode3D } from '../../../base/node3d/parser';

const characterBody3DRegistration: NodeTypeRegistration = {
  typeName: 'CharacterBody3D',
  parser: parseNode3D,
};

nodeRegistry.register(characterBody3DRegistration);

export { characterBody3DRegistration };
