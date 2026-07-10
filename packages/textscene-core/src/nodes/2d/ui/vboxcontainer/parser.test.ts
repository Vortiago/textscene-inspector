import { describe, expect, it } from 'vitest';
import { parseVBoxContainer } from './parser';
import { heading } from '../../../../parser/testing/parserKit';

describe('parseVBoxContainer', () => {
  it('parses base Control layout props plus the separation theme override', () => {
    const p = parseVBoxContainer(heading('VBoxContainer', { name: 'Stack' }), {
      layout_mode: '1',
      anchors_preset: '15',
      'theme_override_constants/separation': '12',
    });
    expect(p.layoutMode).toBe(1);
    expect(p.anchorsPreset).toBe(15);
    expect(p.themeOverrideConstants?.separation).toBe(12);
  });

  it('separation of 0 is a real parsed value, NOT collapsed to the Component default of 4', () => {
    const p = parseVBoxContainer(heading('VBoxContainer', { name: 'Stack' }), {
      'theme_override_constants/separation': '0',
    });
    expect(p.themeOverrideConstants?.separation).toBe(0);
  });

  it('leaves themeOverrideConstants undefined when no override is present', () => {
    const p = parseVBoxContainer(heading('VBoxContainer', { name: 'Stack' }), {});
    expect(p.themeOverrideConstants).toBeUndefined();
  });

  it('ignores a malformed (non-numeric) separation override', () => {
    const p = parseVBoxContainer(heading('VBoxContainer', { name: 'Stack' }), {
      'theme_override_constants/separation': 'garbage',
    });
    expect(p.themeOverrideConstants).toBeUndefined();
  });
});
