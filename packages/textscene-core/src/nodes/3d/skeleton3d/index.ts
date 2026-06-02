/**
 * Skeleton3D registration — parser.
 *
 * Non-visual node: renders as a transform-only group (ADR-0008), reusing the
 * Node3D transform parse; the render component (index.r3f.ts) reuses Node3D.
 * In Godot the skeleton drives mesh deformation — the previewer shows where it
 * sits, not the bones.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../core/NodeRegistry';
import type { ParsedHeading } from '../../../parser/utils';
import { parseNode3D } from '../../base/node3d/parser';

const skeleton3DRegistration: NodeTypeRegistration = {
  typeName: 'Skeleton3D',
  typeGuard: (heading: ParsedHeading) =>
    heading.type === 'node' && heading.attributes.type === 'Skeleton3D',
  parser: parseNode3D,
};

nodeRegistry.register(skeleton3DRegistration);

export { skeleton3DRegistration };
