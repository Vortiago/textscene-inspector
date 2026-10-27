/**
 * VoxelGI lights nothing here yet, so the badge reads "not implemented". Its component mounts the
 * Node3D base for `visible` and the workspace split, and the selected editor gizmo.
 */

import { nodeComponentRegistry } from '../../../r3f/NodeComponentRegistry';
import { VoxelGI } from './Component';

nodeComponentRegistry.register({
  typeName: 'VoxelGI',
  Component: VoxelGI,
  renderIntent: 'pending',
  editorIcon: { icon: 'GizmoVoxelGI' },
});
