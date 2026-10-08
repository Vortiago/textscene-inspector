/** The box a GPUParticles3D gives its instance: its `visibility_aabb` (`particles_storage.cpp:691-696`). */

import type { TscnNode } from '../../../../parser/types';
import type { Aabb } from '../../../../godot/aabb';
import type { GPUParticles3DProperties } from './types';

export function useGPUParticles3DAabb(node: TscnNode): Aabb {
  return (node.properties as GPUParticles3DProperties).visibilityAabb;
}
