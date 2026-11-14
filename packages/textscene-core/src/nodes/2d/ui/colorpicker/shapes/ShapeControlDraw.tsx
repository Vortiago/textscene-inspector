/** What a shape Control's `draw` callback draws on it, at its own rect (`color_picker_shape.cpp`). */
import { useMemo } from 'react';
import type { Rgba } from '../../../../../godot/math/math';
import type { ControlProperties } from '../../control/types';
import type { NativeControlComponentProps } from '../../../../../r3f/controls/ControlComponentRegistry';
import { painterView } from '../../../../../r3f/controls/native/solveTree';
import { ShapeRow } from './ShapeRow';
import type { PickerShapeColor, ShapeDraw } from './shapeDrawing';

/** A shape Control's properties: its callback and what the callback reads of the picker. */
export interface ShapeControlDrawProperties {
  shapeDraw: ShapeDraw;
  shapeColor: PickerShapeColor;
  /** The picker's `color`: a cursor's background takes it opaque. */
  pickColor: Rgba;
}

export function ShapeControlDraw({ solveNode, rect, tint, theme, renderOrder }: NativeControlComponentProps) {
  const { shapeDraw, shapeColor, pickColor } = painterView<ControlProperties & ShapeControlDrawProperties>(
    solveNode
  );
  const { w, h } = rect;
  const drawing = useMemo(() => shapeDraw({ x: 0, y: 0, w, h }, shapeColor), [shapeDraw, w, h, shapeColor]);
  return (
    <ShapeRow
      drawing={drawing}
      pickColor={pickColor}
      solveNode={solveNode}
      tint={tint}
      scale={theme.scale}
      renderOrder={renderOrder}
    />
  );
}
