/**
 * XRCamera3D registration: the parser. It reuses the Camera3D parse, since XRCamera3D declares no
 * ADD_PROPERTY (xr_nodes.cpp has no XRCamera3D::_bind_methods) and everything it serialises arrives
 * through the Camera3D/Node3D base-walk. index.r3f.ts likewise reuses the Camera3D component.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseCamera3D } from '../../camera3d/parser';

const xRCamera3DRegistration: NodeTypeRegistration = {
  typeName: 'XRCamera3D',
  parser: parseCamera3D,
};

nodeRegistry.register(xRCamera3DRegistration);

export { xRCamera3DRegistration };
