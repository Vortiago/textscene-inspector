/** <GPUParticlesAttractorVectorField3D> draws nothing of its own, but Godot's editor gizmo for every node. */

import { BoxVolumeGizmo } from '../../volume/Gizmo';
import { volumeNode } from '../../volume/volumeNode';
import type { BoxVolumeProperties } from '../../volume/types';

export const GPUParticlesAttractorVectorField3D = volumeNode<BoxVolumeProperties>(({ size }) => (
  <BoxVolumeGizmo size={size} kind="attractor" />
));
