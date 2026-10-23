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
import { writeGodotPointAsThree } from '../../../r3f/node2dTransform';
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

function crossInGroupSpace(extents: number) {
  const { positions, colors } = axisCross(extents, [X, Y]);
  const inGroupSpace = new Float32Array(positions.length);
  for (let i = 0; i < positions.length; i += FLOATS_PER_VERTEX) {
    writeGodotPointAsThree(inGroupSpace, i, positions[i]!, positions[i + Y]!);
  }
  return { positions: inGroupSpace, colors };
}

function MarkerCross({ extents }: { extents: number }) {
  const { positions, colors } = useMemo(() => crossInGroupSpace(extents), [extents]);
  return <GizmoLine positions={positions} colors={colors} />;
}
