import { describe, expect, it } from 'vitest';
import { ColorPickerShape } from '../../../../../godot/scene/gui';
import { drawnShapeVariant } from './pickerShapes';
import { OK_HL_RECTANGLE } from './okHlRectangle';
import { HSV_RECTANGLE } from './hsvRectangle';
import { HSV_WHEEL } from './hsvWheel';

describe('drawnShapeVariant', () => {
  it('is the variant of a drawn picker_shape', () => {
    expect(drawnShapeVariant(ColorPickerShape.SHAPE_HSV_WHEEL)).toBe(HSV_WHEEL);
  });

  it('is null at SHAPE_NONE, which draws no shape', () => {
    expect(drawnShapeVariant(ColorPickerShape.SHAPE_NONE)).toBeNull();
  });

  it('keeps the last value, 6, as the OK HL rectangle', () => {
    expect(drawnShapeVariant(6)).toBe(OK_HL_RECTANGLE);
  });

  it('is the HSV rectangle for a value set_picker_shape refuses (color_picker.cpp:854)', () => {
    expect(drawnShapeVariant(7)).toBe(HSV_RECTANGLE);
    expect(drawnShapeVariant(-1)).toBe(HSV_RECTANGLE);
  });

  it('reads an omitted picker_shape as the HSV rectangle', () => {
    expect(drawnShapeVariant(undefined)).toBe(HSV_RECTANGLE);
  });
});
