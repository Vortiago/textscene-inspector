/**
 * <VoxelGI> lights nothing yet, so the intent is `pending` and the badge reads "not implemented". The
 * Node3D base still mounts for `visible` and the workspace split, with Godot's editor gizmo on it
 * while the node is selected (`voxel_gi_gizmo_plugin.cpp:99`).
 */

import type { NodeComponentProps } from '../../../r3f/NodeComponentRegistry';
import { PluginGizmo } from '../../../r3f/gizmo/PluginGizmo';
import { invisibleBase } from '../../../r3f/invisibleBase';
import { Node3D } from '../../base/node3d/Component';
import { VoxelGIGizmo } from './Gizmo';
import type { VoxelGIProperties } from './types';

function UndrawnVoxelGI({ node, children }: NodeComponentProps) {
  return (
    <Node3D node={node}>
      <PluginGizmo drawnFor="selected-only">
        <VoxelGIGizmo voxelGi={node.properties as VoxelGIProperties} />
      </PluginGizmo>
      {children}
    </Node3D>
  );
}

export const VoxelGI = invisibleBase(UndrawnVoxelGI);
