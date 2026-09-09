/**
 * XRCamera3D IS a Camera3D, so it reuses that component rather than the coarse
 * Node3D base: the slice already parses with `parseCamera3D`, so the node
 * carries Camera3DProperties and the same selection-gated frustum gizmo draws.
 */

import { nodeComponentRegistry } from '../../../../r3f/NodeComponentRegistry';
import { Camera3D } from '../../camera3d/Component';

nodeComponentRegistry.register({ typeName: 'XRCamera3D', Component: Camera3D });
