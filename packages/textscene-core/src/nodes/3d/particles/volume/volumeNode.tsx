/**
 * The components of the GPU particles collision and attractor nodes. They draw nothing of their own,
 * so the intent stays `pending`: the Node3D base mounts for `visible` and the workspace split, with
 * Godot's editor gizmo on it for every node, faint while unselected (ADR-0056).
 */

import { useMemo, type ReactNode } from 'react';
import { centredAabb, cubeAabb, type Aabb } from '../../../../godot/math/aabb';
import { NodeAabb } from '../../../../r3f/components/NodeAabb';
import type { NodeComponentProps } from '../../../../r3f/NodeComponentRegistry';
import { PluginGizmo } from '../../../../r3f/gizmo/PluginGizmo';
import { invisibleBase } from '../../../../r3f/invisibleBase';
import { Node3D } from '../../../base/node3d/Component';
import type { Node3DProperties } from '../../../base/node3d/types';
import { ATTRACTOR_COLOR, BoxVolumeGizmo, COLLISION_COLOR, SdfVolumeGizmo, SphereVolumeGizmo } from './Gizmo';
import type { BoxVolumeProperties, SdfVolumeProperties, SphereVolumeProperties } from './types';

type Kind = 'collision' | 'attractor';

const colorOf = (kind: Kind) => (kind === 'collision' ? COLLISION_COLOR : ATTRACTOR_COLOR);

function volumeNode<P extends Node3DProperties>(
  aabbOf: (properties: P) => Aabb,
  drawGizmo: (properties: P) => ReactNode
) {
  return invisibleBase(function VolumeNode({ node, children }: NodeComponentProps) {
    const properties = node.properties as P;
    const aabb = useMemo(() => aabbOf(properties), [properties]);
    return (
      <Node3D node={node}>
        <NodeAabb aabb={aabb} />
        <PluginGizmo drawnFor="every-node">{drawGizmo(properties)}</PluginGizmo>
        {children}
      </Node3D>
    );
  });
}

export const boxVolumeNode = (kind: Kind) =>
  volumeNode<BoxVolumeProperties>(
    ({ size }) => centredAabb(size),
    ({ size }) => <BoxVolumeGizmo size={size} color={colorOf(kind)} />
  );

export const sphereVolumeNode = (kind: Kind) =>
  volumeNode<SphereVolumeProperties>(
    ({ radius }) => cubeAabb(radius),
    ({ radius }) => <SphereVolumeGizmo radius={radius} color={colorOf(kind)} />
  );

export const sdfVolumeNode = () =>
  volumeNode<SdfVolumeProperties>(
    ({ size }) => centredAabb(size),
    ({ size, resolution }) => <SdfVolumeGizmo size={size} resolution={resolution} />
  );
