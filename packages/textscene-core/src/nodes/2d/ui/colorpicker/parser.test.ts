import { describe, expect, it } from 'vitest';
import { parseColorPicker } from './parser';
import { heading } from '../../../../parser/testing/parserKit';

describe('parseColorPicker', () => {
  it('maps every ColorPicker-own property alongside VBoxContainer\'s own layout props', () => {
    const p = parseColorPicker(heading('ColorPicker', { name: 'Picker' }), {
      color: 'Color(0.2, 0.4, 0.6, 0.8)',
      picker_shape: '1',
      color_mode: '2',
      color_modes_visible: 'false',
      sliders_visible: 'false',
      hex_visible: 'false',
      presets_visible: 'false',
      sampler_visible: 'false',
      edit_alpha: 'false',
      edit_intensity: 'false',
      anchors_preset: '15',
      anchor_right: '1.0',
    });
    expect(p.color).toBe('Color(0.2, 0.4, 0.6, 0.8)');
    expect(p.pickerShape).toBe(1);
    expect(p.colorMode).toBe(2);
    expect(p.colorModesVisible).toBe(false);
    expect(p.slidersVisible).toBe(false);
    expect(p.hexVisible).toBe(false);
    expect(p.presetsVisible).toBe(false);
    expect(p.samplerVisible).toBe(false);
    expect(p.editAlpha).toBe(false);
    expect(p.editIntensity).toBe(false);
    expect(p.anchorsPreset).toBe(15);
    expect(p.anchorRight).toBe(1);
  });

  it('defaults color to Godot opaque white and leaves every other own property undefined when absent', () => {
    // `ColorPicker::ColorPicker()` calls `set_pick_color(Color(1, 1, 1))`
    // (color_picker.cpp:2289) before the scene loader ever runs, so an
    // omitted `color` key means opaque white, not the raw `Color()` member
    // default. Every visibility/mode key stays undefined so the painter's own
    // `?? <Godot default>` fallbacks (nativeSolver.ts) apply.
    const p = parseColorPicker(heading('ColorPicker', { name: 'Picker' }), {});
    expect(p.color).toBe('Color(1, 1, 1, 1)');
    expect(p.pickerShape).toBeUndefined();
    expect(p.colorMode).toBeUndefined();
    expect(p.colorModesVisible).toBeUndefined();
    expect(p.slidersVisible).toBeUndefined();
    expect(p.hexVisible).toBeUndefined();
    expect(p.presetsVisible).toBeUndefined();
    expect(p.samplerVisible).toBeUndefined();
    expect(p.editAlpha).toBeUndefined();
    expect(p.editIntensity).toBeUndefined();
  });

  it('falls back to the Godot default color for an empty/falsy value (malformed)', () => {
    const p = parseColorPicker(heading('ColorPicker', { name: 'Picker' }), { color: '' });
    expect(p.color).toBe('Color(1, 1, 1, 1)');
  });
});
