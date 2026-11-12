/**
 * The drawings of a 2D collision shape as a gizmo: the fills, strokes and one pixel lines Godot's
 * `Shape2D::draw` puts on the node's canvas item. Component.tsx and ShapeOverlay.tsx mount it only
 * when `showCollisions` is on.
 */

import { useMemo } from 'react';
import type { Rgba } from '../../../../godot/math/math';
import type { ShapeDrawing } from '../../../../resources/shapes/shape2d/drawing';
import { GizmoLine } from '../../../../r3f/components/GizmoLine';
import { GizmoMesh } from '../../../../r3f/components/GizmoMesh';
import { shapeLayers } from './shapeLayers';

/** One drawing and the sRGB colour the node draws it in. */
export interface ShapePart {
  drawing: ShapeDrawing;
  colour: Rgba;
}

/** The parts draw in order, each over the one before, as the draw calls of a canvas item do. */
export function ShapeGizmo2D({ parts }: { parts: readonly ShapePart[] }) {
  const layers = useMemo(() => parts.flatMap(({ drawing, colour }) => shapeLayers(drawing, colour)), [parts]);

  return layers.map((layer, index) => {
    const order = (index + 1) / (layers.length + 1);
    return layer.kind === 'mesh' ? (
      <GizmoMesh key={index} geometry={layer.geometry} color={0xffffff} alpha={1} order={order} />
    ) : (
      <GizmoLine
        key={index}
        positions={layer.positions}
        color={layer.colour}
        opacity={layer.alpha}
        order={order}
      />
    );
  });
}
