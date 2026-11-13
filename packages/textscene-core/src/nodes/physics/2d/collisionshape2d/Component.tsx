/**
 * <CollisionShape2D>: a transform-only Node2D whose collision-shape resource draws as a gizmo in
 * the node's debug colour, grey when disabled, with an arrow when one-way (`collision_shape_2d.cpp:85-129`).
 * Like CollisionShape3D (ADR-0005/ADR-0006) the gizmo shows only while
 * `ViewportModeContext.showCollisions` is on (off by default), like Godot's "Visible Collision Shapes".
 */

import { useMemo } from 'react';
import type { CollisionShape2DProperties } from './types';
import type { NodeComponentProps } from '../../../../r3f/NodeComponentRegistry';
import { CanvasItem2D } from '../../../../r3f/components/CanvasItem2D';
import { useNodeResource } from '../../../../resources/reading';
import { SHAPE_2D } from '../../../../resources/shapes/shape2d';
import { useViewportMode } from '../../../../r3f/contexts/ViewportModeContext';
import { DEFAULT_COLLISION_DEBUG_COLOR } from '../../shared/debugColor';
import { drawColour, ONE_WAY_ARROW, oneWayArrowColour } from './debugDraw';
import { ShapeGizmo2D } from './ShapeGizmo2D';

export function CollisionShape2D({ node, children }: NodeComponentProps) {
  const properties = node.properties as CollisionShape2DProperties;
  const { showCollisions } = useViewportMode();

  const shape = useNodeResource(properties.shape, SHAPE_2D);
  const debugColour = properties.debugColor ?? DEFAULT_COLLISION_DEBUG_COLOR;
  const isDisabled = properties.disabled === true;
  const isOneWay = properties.oneWayCollision === true;
  const parts = useMemo(() => {
    if (!shape.value) return [];
    const shapePart = { drawing: shape.value, colour: drawColour(debugColour, isDisabled) };
    if (!isOneWay) return [shapePart];
    return [shapePart, { drawing: ONE_WAY_ARROW, colour: oneWayArrowColour(debugColour, isDisabled) }];
  }, [shape.value, debugColour, isDisabled, isOneWay]);

  return (
    <CanvasItem2D
      node={node}
      props={properties}
      body={() => (showCollisions && parts.length > 0 ? <ShapeGizmo2D parts={parts} /> : null)}
    >
      {children}
    </CanvasItem2D>
  );
}
