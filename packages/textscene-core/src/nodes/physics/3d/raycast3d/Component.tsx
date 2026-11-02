/**
 * <RayCast3D>: a Node3D group that draws Godot's ray gizmo for every node: the origin→target line
 * and the pyramid of a thickness above 1. The node's own debug material never varies, and a zero
 * target draws nothing, as in Godot.
 */

import type { NodeComponentProps } from '../../../../r3f/NodeComponentRegistry';
import { Node3D } from '../../../base/node3d/Component';
import { useGizmoDrawn } from '../../../../r3f/hooks/useGizmoState';
import { RayGizmo } from './RayGizmo';
import { DEFAULT_DEBUG_SHAPE_THICKNESS, DEFAULT_ENABLED, DEFAULT_TARGET_POSITION } from './types';
import type { RayCast3DProperties } from './types';

export function RayCast3D({ node, children }: NodeComponentProps) {
  const props = node.properties as RayCast3DProperties;
  const drawsGizmo = useGizmoDrawn('every-node');
  return (
    <Node3D node={node}>
      {drawsGizmo && (
        <RayGizmo
          target={props.target_position ?? DEFAULT_TARGET_POSITION}
          thickness={props.debug_shape_thickness ?? DEFAULT_DEBUG_SHAPE_THICKNESS}
          customColor={props.debug_shape_custom_color}
          enabled={props.enabled ?? DEFAULT_ENABLED}
        />
      )}
      {children}
    </Node3D>
  );
}
