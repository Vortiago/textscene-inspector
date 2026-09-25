/**
 * <Marker3D>: a Node3D anchor for its children that draws Godot's 3-axis cross
 * at its origin. Godot draws it at all times. Here `useGizmoVisible()` shows it
 * only while selected, to keep a busy scene clean (ADR-0018).
 */

import { useMemo } from 'react';
import type { NodeComponentProps } from '../../../r3f/NodeComponentRegistry';
import { Node3D } from '../../base/node3d/Component';
import { GizmoLine } from '../../../r3f/components/GizmoLine';
import { useGizmoVisible } from '../../../r3f/hooks/useGizmoVisible';
import type { Marker3DProperties } from './types';

// Per-vertex axis colours, X red, Y green, Z blue, whatever the size.
const AXIS_COLORS = new Float32Array([
  1, 0, 0, 1, 0, 0,
  0, 1, 0, 0, 1, 0,
  0, 0, 1, 0, 0, 1,
]);

export function Marker3D({ node, children }: NodeComponentProps) {
  const props = node.properties as Marker3DProperties;
  const gizmoVisible = useGizmoVisible();
  return (
    <Node3D node={node}>
      {gizmoVisible && <AxisCross extents={props.gizmo_extents} />}
      {children}
    </Node3D>
  );
}

function AxisCross({ extents }: { extents: number }) {
  // Three axis lines through the origin: X, Y, Z.
  const positions = useMemo(() => {
    const e = extents > 0 ? extents : 0.25;
    return new Float32Array([
      -e, 0, 0, e, 0, 0,
      0, -e, 0, 0, e, 0,
      0, 0, -e, 0, 0, e,
    ]);
  }, [extents]);
  return <GizmoLine positions={positions} colors={AXIS_COLORS} />;
}
