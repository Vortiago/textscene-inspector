/**
 * The shape variant of each `picker_shape` (`ColorPicker::add_shape`, `color_picker.cpp:2104-2109`).
 * `SHAPE_NONE` has none: it draws no shape and hides `btn_shape`.
 */
import { ColorPickerShape } from '../../../../../godot/scene/gui';
import { resolvePickerShape, type DrawnPickerShape } from './shapeRow';
import type { ShapeVariant } from './shapeDrawing';
import { HSV_RECTANGLE } from './hsvRectangle';
import { HSV_WHEEL } from './hsvWheel';
import { VHS_CIRCLE } from './vhsCircle';
import { OKHSL_CIRCLE } from './okhslCircle';
import { OK_HS_RECTANGLE } from './okHsRectangle';
import { OK_HL_RECTANGLE } from './okHlRectangle';

const VARIANTS: Record<DrawnPickerShape, ShapeVariant> = {
  [ColorPickerShape.SHAPE_HSV_RECTANGLE]: HSV_RECTANGLE,
  [ColorPickerShape.SHAPE_HSV_WHEEL]: HSV_WHEEL,
  [ColorPickerShape.SHAPE_VHS_CIRCLE]: VHS_CIRCLE,
  [ColorPickerShape.SHAPE_OKHSL_CIRCLE]: OKHSL_CIRCLE,
  [ColorPickerShape.SHAPE_OK_HS_RECTANGLE]: OK_HS_RECTANGLE,
  [ColorPickerShape.SHAPE_OK_HL_RECTANGLE]: OK_HL_RECTANGLE,
};

/** The variant `picker_shape` draws, `null` at `SHAPE_NONE`. */
export function drawnShapeVariant(pickerShape: number | undefined): ShapeVariant | null {
  const shape = resolvePickerShape(pickerShape);
  return shape === ColorPickerShape.SHAPE_NONE ? null : VARIANTS[shape];
}
