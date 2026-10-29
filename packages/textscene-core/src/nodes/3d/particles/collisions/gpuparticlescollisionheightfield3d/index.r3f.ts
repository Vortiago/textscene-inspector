/**
 * GPUParticlesCollisionHeightField3D draws nothing of its own, so the badge reads "not implemented". Its component mounts the
 * Node3D base for `visible` and the workspace split, and the editor gizmo.
 */

import { nodeComponentRegistry } from '../../../../../r3f/NodeComponentRegistry';
import { GPUParticlesCollisionHeightField3D } from './Component';

nodeComponentRegistry.register({
  typeName: 'GPUParticlesCollisionHeightField3D',
  Component: GPUParticlesCollisionHeightField3D,
  renderIntent: 'pending',
});
