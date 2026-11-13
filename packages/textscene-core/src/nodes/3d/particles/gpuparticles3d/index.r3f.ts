/**
 * GPUParticles3D draws its frozen particle pose, and its selected editor gizmos. Its component
 * mounts the GeometryInstance3D base for `visible`, the workspace split and the scene cull.
 */

import { nodeComponentRegistry } from '../../../../r3f/NodeComponentRegistry';
import { GPUParticles3D } from './Component';

nodeComponentRegistry.register({
  typeName: 'GPUParticles3D',
  Component: GPUParticles3D,
  renderIntent: 'draws',
  editorIcon: { icon: 'GizmoGPUParticles3D' },
});
