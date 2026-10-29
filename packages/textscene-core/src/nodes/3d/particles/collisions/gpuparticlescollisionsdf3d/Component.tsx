/** <GPUParticlesCollisionSDF3D> draws nothing of its own, but Godot's editor gizmo for every node. */

import { SdfVolumeGizmo } from '../../volume/Gizmo';
import { volumeNode } from '../../volume/volumeNode';
import type { SdfVolumeProperties } from '../../volume/types';

export const GPUParticlesCollisionSDF3D = volumeNode<SdfVolumeProperties>(({ size, resolution }) => (
  <SdfVolumeGizmo size={size} resolution={resolution} />
));
