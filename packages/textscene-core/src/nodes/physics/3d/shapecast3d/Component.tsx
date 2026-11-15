/**
 * <ShapeCast3D>: a Node3D group that draws Godot's sweep gizmo for every node: the origin→target
 * line plus the shape's wireframe at the sweep's end. Without a shape the line alone draws, and a
 * zero target draws the wireframe alone, as in shape_cast_3d.cpp:498-515.
 */

import type { NodeComponentProps } from '../../../../r3f/NodeComponentRegistry';
import { Node3D } from '../../../base/node3d/Component';
import { useGizmoDrawn } from '../../../../r3f/hooks/useGizmoState';
import { useNodeResource } from '../../../../resources/reading';
import { SHAPE_3D } from '../../../../resources/shapes/shape3d';
import { ShapeCastGizmo } from './ShapeCastGizmo';
import { DEFAULT_ENABLED, DEFAULT_TARGET_POSITION } from './types';
import type { ShapeCast3DProperties } from './types';

export function ShapeCast3D({ node, children }: NodeComponentProps) {
  const props = node.properties as ShapeCast3DProperties;
  const shape = useNodeResource(props.shape, SHAPE_3D).value;
  const drawsGizmo = useGizmoDrawn('every-node');
  return (
    <Node3D node={node}>
      {drawsGizmo && (
        <ShapeCastGizmo
          target={props.target_position ?? DEFAULT_TARGET_POSITION}
          shape={shape}
          customColor={props.debug_shape_custom_color}
          enabled={props.enabled ?? DEFAULT_ENABLED}
        />
      )}
      {children}
    </Node3D>
  );
}
