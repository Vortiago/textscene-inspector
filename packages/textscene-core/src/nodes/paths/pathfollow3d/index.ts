/**
 * PathFollow3D registration — parser.
 *
 * Non-visual node: renders as a transform-only group (ADR-0008), reusing the
 * Node3D transform parse; the render component (index.r3f.ts) reuses Node3D.
 * Children sit at the node's authored transform (no curve evaluation).
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../core/NodeRegistry';
import type { ParsedHeading } from '../../../parser/utils';
import { parseNode3D } from '../../base/node3d/parser';

const pathFollow3DRegistration: NodeTypeRegistration = {
  typeName: 'PathFollow3D',
  typeGuard: (heading: ParsedHeading) =>
    heading.type === 'node' && heading.attributes.type === 'PathFollow3D',
  parser: parseNode3D,
};

nodeRegistry.register(pathFollow3DRegistration);

export { pathFollow3DRegistration };
