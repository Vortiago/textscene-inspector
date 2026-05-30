/**
 * Area3D registration — parser.
 *
 * Transform-only group (ADR-0005): reuses the Node3D transform parse; the
 * render component (index.r3f.ts) reuses Node3D.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import type { ParsedHeading } from '../../../../parser/utils';
import { parseNode3D } from '../../../base/node3d/parser';

const area3DRegistration: NodeTypeRegistration = {
  typeName: 'Area3D',
  typeGuard: (heading: ParsedHeading) =>
    heading.type === 'node' && heading.attributes.type === 'Area3D',
  parser: parseNode3D,
};

nodeRegistry.register(area3DRegistration);

export { area3DRegistration };
