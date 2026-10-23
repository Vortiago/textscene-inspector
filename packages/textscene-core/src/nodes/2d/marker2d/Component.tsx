/**
 * <Marker2D> positions its children and draws Godot's "+" editor cross at its origin for every
 * node, in full colour (`marker_2d.cpp:85`, ADR-0056). The cross is symmetric, so the Node2D
 * group's diag(1,-1,1) conjugation leaves it unchanged.
 */

import { useMemo } from 'react';
import type { NodeComponentProps } from '../../../r3f/NodeComponentRegistry';
import { Node2D } from '../../base/node2d/Component';
import { GizmoLine } from '../../../r3f/components/GizmoLine';
import { useGizmoState } from '../../../r3f/hooks/useGizmoState';
import type { Marker2DProperties } from './types';

/** Godot editor marker tint (blue). */
const MARKER_COLOR = 0x6ca6ff;

export function Marker2D({ node, children }: NodeComponentProps) {
  const props = node.properties as Marker2DProperties;
  const drawsCross = useGizmoState('every-node') !== 'hidden';
  return (
    <Node2D node={node}>
      {drawsCross && <MarkerCross extents={props.gizmo_extents} />}
      {children}
    </Node2D>
  );
}

function MarkerCross({ extents }: { extents: number }) {
  // Two segments: horizontal (−e,0)→(e,0) and vertical (0,−e)→(0,e).
  const positions = useMemo(() => {
    const e = extents > 0 ? extents : 10;
    return new Float32Array([-e, 0, 0, e, 0, 0, 0, -e, 0, 0, e, 0]);
  }, [extents]);
  return <GizmoLine positions={positions} color={MARKER_COLOR} />;
}
