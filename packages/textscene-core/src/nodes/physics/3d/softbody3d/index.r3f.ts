/**
 * SoftBody3D draws its `mesh` as a MeshInstance3D does, since it derives from it
 * (`soft_body_3d.h:66`). The previewer runs no physics (ADR-0005), so the body stays at rest, and
 * the cull keeps the rest mesh's box. Godot overwrites that box with the simulated points'
 * (`soft_body_3d.cpp:100-101,450-452`).
 */

import { nodeComponentRegistry } from '../../../../r3f/NodeComponentRegistry';
import { MeshInstance3D } from '../../../3d/meshinstance3d/Component';

nodeComponentRegistry.register({ typeName: 'SoftBody3D', Component: MeshInstance3D });
