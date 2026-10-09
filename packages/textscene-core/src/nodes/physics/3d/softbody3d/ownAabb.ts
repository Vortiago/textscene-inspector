/**
 * The box a SoftBody3D gives its instance at rest: its mesh's. Once the physics server steps it,
 * the server writes the bounds of the simulated points over it each frame
 * (`soft_body_3d.cpp:100-101,450-452`, `jolt_soft_body_3d.cpp:657`), which needs the physics this
 * previewer does not run.
 */

import type { TscnNode } from '../../../../parser/types';
import type { Aabb } from '../../../../godot/aabb';
import { useSceneResources } from '../../../../r3f/SceneResourcesContext';
import { useMeshAabb } from '../../../3d/meshinstance3d/meshAabb';
import type { MeshInstance3DProperties } from '../../../3d/meshinstance3d/types';

export function useSoftBody3DAabb(node: TscnNode): Aabb | null {
  const { mesh } = node.properties as MeshInstance3DProperties;
  return useMeshAabb(mesh, useSceneResources());
}
