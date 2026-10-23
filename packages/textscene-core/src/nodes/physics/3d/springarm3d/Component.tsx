/**
 * <SpringArm3D>: a Node3D group that draws Godot's length line for every node, faint while
 * unselected (ADR-0056): one segment from the origin to (0, 0, spring_length), unguarded, so 0 and a
 * negative length draw as in spring_arm_3d_gizmo_plugin.cpp:35-54.
 */

import { useMemo } from 'react';
import type { NodeComponentProps } from '../../../../r3f/NodeComponentRegistry';
import { Node3D } from '../../../base/node3d/Component';
import { GizmoLine } from '../../../../r3f/components/GizmoLine';
import { useGizmoState } from '../../../../r3f/hooks/useGizmoState';
import type { GizmoVariant } from '../../../../r3f/gizmo/gizmoVariant';
import { useGodotLinearColor } from '../../../../r3f/godotColor';
import { DEFAULT_COLLISION_DEBUG_COLOR } from '../../shared/debugColor';
import { DEFAULT_SPRING_LENGTH } from './types';
import type { SpringArm3DProperties } from './types';

function LengthGizmo({ length, variant }: { length: number; variant: GizmoVariant }) {
  const positions = useMemo(() => new Float32Array([0, 0, 0, 0, 0, length]), [length]);
  const color = useGodotLinearColor(DEFAULT_COLLISION_DEBUG_COLOR);
  return (
    <GizmoLine
      positions={positions}
      color={color}
      opacity={DEFAULT_COLLISION_DEBUG_COLOR.a}
      variant={variant}
    />
  );
}

export function SpringArm3D({ node, children }: NodeComponentProps) {
  const props = node.properties as SpringArm3DProperties;
  const gizmoState = useGizmoState('every-node');
  return (
    <Node3D node={node}>
      {gizmoState !== 'hidden' && (
        <LengthGizmo length={props.spring_length ?? DEFAULT_SPRING_LENGTH} variant={gizmoState} />
      )}
      {children}
    </Node3D>
  );
}
