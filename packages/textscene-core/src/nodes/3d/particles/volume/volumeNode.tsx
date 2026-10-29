/**
 * The component of a GPU particles collision or attractor node. It draws nothing of its own, so the
 * intent stays `pending`: the Node3D base mounts for `visible` and the workspace split, with Godot's
 * editor gizmo on it for every node, faint while unselected (ADR-0056).
 */

import type { ReactNode } from 'react';
import type { NodeComponentProps } from '../../../../r3f/NodeComponentRegistry';
import { PluginGizmo } from '../../../../r3f/gizmo/PluginGizmo';
import { invisibleBase } from '../../../../r3f/invisibleBase';
import { Node3D } from '../../../base/node3d/Component';
import type { Node3DProperties } from '../../../base/node3d/types';

/** The component of a node whose gizmo `drawGizmo` builds from the parsed `properties`. */
export function volumeNode<P extends Node3DProperties>(drawGizmo: (properties: P) => ReactNode) {
  return invisibleBase(function VolumeNode({ node, children }: NodeComponentProps) {
    return (
      <Node3D node={node}>
        <PluginGizmo drawnFor="every-node">{drawGizmo(node.properties as P)}</PluginGizmo>
        {children}
      </Node3D>
    );
  });
}
