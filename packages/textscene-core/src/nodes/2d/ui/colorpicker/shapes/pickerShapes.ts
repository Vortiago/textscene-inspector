/**
 * The shape variant of each `picker_shape` (`ColorPicker::add_shape`, `color_picker.cpp:2104-2109`).
 * `SHAPE_NONE` has none: it draws no shape and hides `btn_shape`.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */
import type { EnumValue } from '../../../../../godot/classdb/enumNames';
import { ColorPickerShape } from '../../../../../godot/scene/gui';
import type { ShapeVariant } from './shapeDrawing';
import { HSV_RECTANGLE } from './hsvRectangle';
import { HSV_WHEEL } from './hsvWheel';
import { VHS_CIRCLE } from './vhsCircle';
import { OKHSL_CIRCLE } from './okhslCircle';
import { OK_HS_RECTANGLE } from './okHsRectangle';
import { OK_HL_RECTANGLE } from './okHlRectangle';

type PickerShape = EnumValue<typeof ColorPickerShape>;

type DrawnPickerShape = Exclude<PickerShape, typeof ColorPickerShape.SHAPE_NONE>;

/**
 * `set_picker_shape` refuses a value outside 0 to 6 (`ERR_FAIL_INDEX`, `color_picker.cpp:854`), so
 * the constructor's `SHAPE_HSV_RECTANGLE` stays.
 */
function resolvePickerShape(value: number | undefined): PickerShape {
  const isKnown = Number.isInteger(value) && value! >= 0 && value! <= ColorPickerShape.SHAPE_OK_HL_RECTANGLE;
  return isKnown ? (value as PickerShape) : ColorPickerShape.SHAPE_HSV_RECTANGLE;
}

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
