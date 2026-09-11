import { describe, expect, it } from 'vitest';
import { parseColorPicker } from './parser';
import { heading } from '../../../../parser/testing/parserKit';

describe('parseColorPicker', () => {
  it('maps color and picker_shape alongside VBoxContainer\'s own layout props', () => {
    const p = parseColorPicker(heading('ColorPicker', { name: 'Picker' }), {
      color: 'Color(0.2, 0.4, 0.6, 0.8)',
      picker_shape: '1',
      anchors_preset: '15',
      anchor_right: '1.0',
    });
    expect(p.color).toBe('Color(0.2, 0.4, 0.6, 0.8)');
    expect(p.pickerShape).toBe(1);
    expect(p.anchorsPreset).toBe(15);
    expect(p.anchorRight).toBe(1);
  });

  it('defaults color to Godot opaque black and leaves picker_shape undefined when absent', () => {
    // `Color color;` (color_picker.h:274) is the base `Color()` constructor —
    // r=g=b=0, a=1. An absent `picker_shape` stays undefined so the painter's
    // own `?? SHAPE_HSV_RECTANGLE` fallback (Component.tsx) applies Godot's
    // `current_shape = SHAPE_HSV_RECTANGLE` default.
    const p = parseColorPicker(heading('ColorPicker', { name: 'Picker' }), {});
    expect(p.color).toBe('Color(0, 0, 0, 1)');
    expect(p.pickerShape).toBeUndefined();
  });

  it('falls back to the Godot default color for an empty/falsy value (malformed)', () => {
    const p = parseColorPicker(heading('ColorPicker', { name: 'Picker' }), { color: '' });
    expect(p.color).toBe('Color(0, 0, 0, 1)');
  });
});
