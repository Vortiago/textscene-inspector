/**
 * XRCamera3D registration — parser.
 *
 * Reuses the Camera3D parse; XRCamera3D declares no ADD_PROPERTY of its own
 * (xr_nodes.cpp has no XRCamera3D::_bind_methods at all) and has no
 * linterParser.ts for the same reason — everything it serialises arrives
 * through the Camera3D/Node3D base-walk. Its one semantic check (the
 * XROrigin3D-parent configuration warning) lives in linter.ts instead.
 * index.r3f.ts reuses the Camera3D component for the same reason: both halves
 * resolve to the nearest ancestor that has one, not to the coarse Node3D base.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseCamera3D } from '../../camera3d/parser';

const xRCamera3DRegistration: NodeTypeRegistration = {
  typeName: 'XRCamera3D',
  parser: parseCamera3D,
};

nodeRegistry.register(xRCamera3DRegistration);

export { xRCamera3DRegistration };
