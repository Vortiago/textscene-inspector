/**
 * <Marker3D> — a Node3D transform anchor (positions its children) that draws a
 * 3-axis cross gizmo at its origin (X red, Y green, Z blue), mirroring Godot's
 * 3D editor marker.
 *
 * Godot draws this cross for every Marker3D "at all times"; we instead gate it on
 * selection via useGizmoVisible() — a deliberate viewer-vs-editor divergence to
 * keep a busy scene clean (ADR-0018, generalizing the light/camera gizmo gate).
 */

import { useMemo } from 'react';
import type { NodeComponentProps } from '../../../r3f/NodeComponentRegistry';
import { Node3D } from '../../base/node3d/Component';
import { GizmoLine } from '../../../r3f/components/GizmoLine';
import { useGizmoVisible } from '../../../r3f/hooks/useGizmoVisible';
import type { Marker3DProperties } from './types';

// Per-vertex axis colors: X red, Y green, Z blue (independent of size).
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
