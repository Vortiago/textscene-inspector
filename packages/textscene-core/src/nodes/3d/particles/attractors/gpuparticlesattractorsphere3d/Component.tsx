/** <GPUParticlesAttractorSphere3D> draws nothing of its own, but Godot's editor gizmo for every node. */

import { SphereVolumeGizmo } from '../../volume/Gizmo';
import { volumeNode } from '../../volume/volumeNode';
import type { SphereVolumeProperties } from '../../volume/types';

export const GPUParticlesAttractorSphere3D = volumeNode<SphereVolumeProperties>(({ radius }) => (
  <SphereVolumeGizmo radius={radius} kind="attractor" />
));
