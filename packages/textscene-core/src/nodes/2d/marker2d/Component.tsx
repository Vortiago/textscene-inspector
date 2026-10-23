/**
 * <Marker2D> positions its children and draws Godot's "+" editor cross at its origin for every
 * node, in full colour (`marker_2d.cpp:47-59,85`, ADR-0056): a red x axis and a green y axis, each
 * negative half darkened.
 */

import { useMemo } from 'react';
import type { NodeComponentProps } from '../../../r3f/NodeComponentRegistry';
import { Node2D } from '../../base/node2d/Component';
import { GizmoLine } from '../../../r3f/components/GizmoLine';
import { useGizmoDrawn } from '../../../r3f/hooks/useGizmoState';
import { Vector3Axis } from '../../../godot/math/vector3Axis';
import { axisCross, FLOATS_PER_VERTEX } from '../../../r3f/gizmo/axisCross';
import type { Marker2DProperties } from './types';

const { X, Y } = Vector3Axis;

export function Marker2D({ node, children }: NodeComponentProps) {
  const props = node.properties as Marker2DProperties;
  const drawsCross = useGizmoDrawn('every-node');
  return (
    <Node2D node={node}>
      {drawsCross && <MarkerCross extents={props.gizmo_extents} />}
      {children}
    </Node2D>
  );
}

/** Godot's y points down the screen and three's up. The Node2D group leaves a child's points alone. */
function crossInGroupSpace(extents: number) {
  const cross = axisCross(extents, [X, Y]);
  // `0 - y`, not `-y`: a zero stays +0, so no vertex reads -0.
  for (let i = Y; i < cross.positions.length; i += FLOATS_PER_VERTEX)
    cross.positions[i] = 0 - cross.positions[i]!;
  return cross;
}

function MarkerCross({ extents }: { extents: number }) {
  const { positions, colors } = useMemo(() => crossInGroupSpace(extents), [extents]);
  return <GizmoLine positions={positions} colors={colors} />;
}
