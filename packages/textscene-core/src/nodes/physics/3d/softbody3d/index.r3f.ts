/**
 * SoftBody3D derives from MeshInstance3D (`soft_body_3d.h:66`), so it draws its `mesh` at rest: the
 * previewer runs no physics (ADR-0005). Its box is the mesh's (`mesh_instance_3d.cpp:230-233`) until
 * a physics step swaps it (`soft_body_3d.cpp:100-101,450-452`).
 */

import { nodeComponentRegistry } from '../../../../r3f/NodeComponentRegistry';
import { MeshInstance3D } from '../../../3d/meshinstance3d/Component';

nodeComponentRegistry.register({ typeName: 'SoftBody3D', Component: MeshInstance3D });
