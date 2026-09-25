import { describe, expect, it } from 'vitest';
import { parseColorPickerButton } from './parser';
import { heading } from '../../../../parser/testing/parserKit';

describe('parseColorPickerButton', () => {
  it('maps color alongside Button\'s own text/icon properties', () => {
    const p = parseColorPickerButton(heading('ColorPickerButton', { name: 'Swatch' }), {
      color: 'Color(0.8, 0.3, 0.5, 0.6)',
      text: '"Pick"',
      disabled: 'true',
    });
    expect(p.color).toBe('Color(0.8, 0.3, 0.5, 0.6)');
    expect(p.text).toBe('Pick');
    expect(p.disabled).toBe(true);
  });

  it('defaults to Godot opaque black when the property is absent entirely', () => {
    // `Color color;` (color_picker.h:513) is `Color()`: r=g=b=0, a=1.
    const p = parseColorPickerButton(heading('ColorPickerButton', { name: 'Swatch' }), {});
    expect(p.color).toBe('Color(0, 0, 0, 1)');
  });

  it('falls back to the Godot default for an empty/falsy value (malformed)', () => {
    const p = parseColorPickerButton(heading('ColorPickerButton', { name: 'Swatch' }), { color: '' });
    expect(p.color).toBe('Color(0, 0, 0, 1)');
  });
});
