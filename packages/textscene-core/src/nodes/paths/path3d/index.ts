/**
 * Path3D registration — parser.
 *
 * Non-visual node: renders as a transform-only group (ADR-0008), reusing the
 * Node3D transform parse; the render component (index.r3f.ts) reuses Node3D.
 * The Curve3D itself is not drawn.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../core/NodeRegistry';
import type { ParsedHeading } from '../../../parser/utils';
import { parseNode3D } from '../../base/node3d/parser';

const path3DRegistration: NodeTypeRegistration = {
  typeName: 'Path3D',
  typeGuard: (heading: ParsedHeading) =>
    heading.type === 'node' && heading.attributes.type === 'Path3D',
  parser: parseNode3D,
};

nodeRegistry.register(path3DRegistration);

export { path3DRegistration };
