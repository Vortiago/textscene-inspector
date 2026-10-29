/**
 * GPUParticlesCollisionSphere3D draws nothing of its own, so the badge reads "not implemented". Its component mounts the
 * Node3D base for `visible` and the workspace split, and the editor gizmo.
 */

import { nodeComponentRegistry } from '../../../../../r3f/NodeComponentRegistry';
import { GPUParticlesCollisionSphere3D } from './Component';

nodeComponentRegistry.register({
  typeName: 'GPUParticlesCollisionSphere3D',
  Component: GPUParticlesCollisionSphere3D,
  renderIntent: 'pending',
});
