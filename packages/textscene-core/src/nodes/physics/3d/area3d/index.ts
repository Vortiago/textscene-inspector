/**
 * Area3D registration: the parser.
 *
 * A transform-only group (ADR-0005): it reuses the Node3D transform parse, and the
 * render component (index.r3f.ts) reuses Node3D.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseNode3D } from '../../../base/node3d/parser';

const area3DRegistration: NodeTypeRegistration = {
  typeName: 'Area3D',
  parser: parseNode3D,
};

nodeRegistry.register(area3DRegistration);

export { area3DRegistration };
