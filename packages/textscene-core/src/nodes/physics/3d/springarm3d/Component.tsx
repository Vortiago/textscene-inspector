/**
 * <SpringArm3D>: a Node3D group that draws Godot's length line while selected (ADR-0018):
 * one segment from the origin to (0, 0, spring_length), unguarded, so 0 and a negative
 * length draw as in spring_arm_3d_gizmo_plugin.cpp:35-54. A non-finite length draws nothing.
 */

import { useMemo } from 'react';
import type { NodeComponentProps } from '../../../../r3f/NodeComponentRegistry';
import { Node3D } from '../../../base/node3d/Component';
import { GizmoLine } from '../../../../r3f/components/GizmoLine';
import { useGizmoVisible } from '../../../../r3f/hooks/useGizmoVisible';
import { useGodotLinearColor } from '../../../../r3f/godotColor';
import { DEFAULT_COLLISION_DEBUG_COLOR } from '../../shared/debugColor';
import { DEFAULT_SPRING_LENGTH } from './types';
import type { SpringArm3DProperties } from './types';

function LengthGizmo({ length }: { length: number }) {
  const positions = useMemo(() => new Float32Array([0, 0, 0, 0, 0, length]), [length]);
  const color = useGodotLinearColor(DEFAULT_COLLISION_DEBUG_COLOR);
  return <GizmoLine positions={positions} color={color} />;
}

export function SpringArm3D({ node, children }: NodeComponentProps) {
  const props = node.properties as SpringArm3DProperties;
  const length = props.spring_length ?? DEFAULT_SPRING_LENGTH;
  // Vector3(0, 0, 1) * ±inf is (nan, nan, ±inf), and Godot draws no pixel for a line with that end.
  const gizmoVisible = useGizmoVisible() && Number.isFinite(length);
  return (
    <Node3D node={node}>
      {gizmoVisible && <LengthGizmo length={length} />}
      {children}
    </Node3D>
  );
}
