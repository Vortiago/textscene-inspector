/**
 * The components of the GPU particles collision and attractor nodes. They draw nothing of their own,
 * so the intent stays `pending`: the Node3D base mounts for `visible` and the workspace split, with
 * Godot's editor gizmo on it for every node, faint while unselected (ADR-0056).
 */

import type { ReactNode } from 'react';
import type { NodeComponentProps } from '../../../../r3f/NodeComponentRegistry';
import { PluginGizmo } from '../../../../r3f/gizmo/PluginGizmo';
import { invisibleBase } from '../../../../r3f/invisibleBase';
import { Node3D } from '../../../base/node3d/Component';
import type { Node3DProperties } from '../../../base/node3d/types';
import { ATTRACTOR_COLOR, BoxVolumeGizmo, COLLISION_COLOR, SdfVolumeGizmo, SphereVolumeGizmo } from './Gizmo';
import type { BoxVolumeProperties, SdfVolumeProperties, SphereVolumeProperties } from './types';

type Kind = 'collision' | 'attractor';

const colorOf = (kind: Kind) => (kind === 'collision' ? COLLISION_COLOR : ATTRACTOR_COLOR);

function volumeNode<P extends Node3DProperties>(drawGizmo: (properties: P) => ReactNode) {
  return invisibleBase(function VolumeNode({ node, children }: NodeComponentProps) {
    return (
      <Node3D node={node}>
        <PluginGizmo drawnFor="every-node">{drawGizmo(node.properties as P)}</PluginGizmo>
        {children}
      </Node3D>
    );
  });
}

export const boxVolumeNode = (kind: Kind) =>
  volumeNode<BoxVolumeProperties>(({ size }) => <BoxVolumeGizmo size={size} color={colorOf(kind)} />);

export const sphereVolumeNode = (kind: Kind) =>
  volumeNode<SphereVolumeProperties>(({ radius }) => (
    <SphereVolumeGizmo radius={radius} color={colorOf(kind)} />
  ));

export const sdfVolumeNode = () =>
  volumeNode<SdfVolumeProperties>(({ size, resolution }) => (
    <SdfVolumeGizmo size={size} resolution={resolution} />
  ));
