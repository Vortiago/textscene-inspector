/**
 * <Marker2D> — a Node2D transform anchor (positions its children) that draws a
 * small "+" cross gizmo at its origin, mirroring Godot's 2D editor marker.
 *
 * The cross is an editor decoration, so it is **selection-gated** via
 * `useGizmoVisible()` — it renders only while this node is the selected node,
 * keeping the workspace clean (the viewer equivalent of Godot drawing the gizmo
 * always; see ADR-0018). The cross is symmetric about the origin, so the Node2D
 * group's diag(1,-1,1) conjugation leaves it unchanged.
 */

import { useMemo } from 'react';
import type { NodeComponentProps } from '../../../r3f/NodeComponentRegistry';
import { Node2D } from '../../base/node2d/Component';
import { GizmoLine } from '../../../r3f/components/GizmoLine';
import { useGizmoVisible } from '../../../r3f/hooks/useGizmoVisible';
import type { Marker2DProperties } from './types';

/** Godot editor marker tint (blue). */
const MARKER_COLOR = 0x6ca6ff;

export function Marker2D({ node, children }: NodeComponentProps) {
  const props = node.properties as Marker2DProperties;
  const gizmoVisible = useGizmoVisible();
  return (
    <Node2D node={node}>
      {gizmoVisible && <MarkerCross extents={props.gizmo_extents} />}
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
