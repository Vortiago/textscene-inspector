/**
 * <Marker3D>: a Node3D anchor for its children that draws Godot's 3-axis cross at its origin, each
 * negative arm darkened. Godot draws it for every node, in one material with no selected or
 * unselected variant (`marker_3d_gizmo_plugin.cpp:60-92,115`), so the cross stays full colour
 * (ADR-0056).
 */

import { useMemo } from 'react';
import type { NodeComponentProps } from '../../../r3f/NodeComponentRegistry';
import { Node3D } from '../../base/node3d/Component';
import { GizmoLine } from '../../../r3f/components/GizmoLine';
import { Vector3Axis } from '../../../godot/math/vector3Axis';
import { axisCross } from '../../../r3f/gizmo/axisCross';
import { useGizmoDrawn } from '../../../r3f/hooks/useGizmoState';
import type { Marker3DProperties } from './types';

const { X, Y, Z } = Vector3Axis;

export function Marker3D({ node, children }: NodeComponentProps) {
  const props = node.properties as Marker3DProperties;
  const drawsCross = useGizmoDrawn('every-node');
  return (
    <Node3D node={node}>
      {drawsCross && <AxisCross extents={props.gizmo_extents} />}
      {children}
    </Node3D>
  );
}

function AxisCross({ extents }: { extents: number }) {
  const { positions, colors } = useMemo(() => axisCross(extents, [X, Y, Z]), [extents]);
  return <GizmoLine positions={positions} colors={colors} />;
}
