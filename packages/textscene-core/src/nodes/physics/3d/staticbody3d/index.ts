/**
 * StaticBody3D registration — parser.
 *
 * A physics body is a transform-only group (ADR-0005): no simulation, no own
 * geometry. It reuses the Node3D transform parse; the render component
 * (registered in index.r3f.ts) reuses Node3D.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import type { ParsedHeading } from '../../../../parser/utils';
import { parseNode3D } from '../../../base/node3d/parser';

const staticBody3DRegistration: NodeTypeRegistration = {
  typeName: 'StaticBody3D',
  typeGuard: (heading: ParsedHeading) =>
    heading.type === 'node' && heading.attributes.type === 'StaticBody3D',
  parser: parseNode3D,
};

nodeRegistry.register(staticBody3DRegistration);

export { staticBody3DRegistration };
