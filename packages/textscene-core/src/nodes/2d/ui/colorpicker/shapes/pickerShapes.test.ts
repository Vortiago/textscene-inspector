import { describe, expect, it } from 'vitest';
import { ColorPickerShape } from '../../../../../godot/scene/gui';
import { drawnShapeVariant } from './pickerShapes';
import { HSV_RECTANGLE } from './hsvRectangle';
import { HSV_WHEEL } from './hsvWheel';

describe('drawnShapeVariant', () => {
  it('is the variant of a drawn picker_shape', () => {
    expect(drawnShapeVariant(ColorPickerShape.SHAPE_HSV_WHEEL)).toBe(HSV_WHEEL);
  });

  it('is null at SHAPE_NONE, which draws no shape', () => {
    expect(drawnShapeVariant(ColorPickerShape.SHAPE_NONE)).toBeNull();
  });

  it('is the HSV rectangle for a value set_picker_shape refuses (color_picker.cpp:854)', () => {
    expect(drawnShapeVariant(7)).toBe(HSV_RECTANGLE);
  });
});
