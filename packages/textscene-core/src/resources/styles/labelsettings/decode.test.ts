/** LabelSettings decode against Godot 4.6.3: `scene/resources/label_settings.h:54-65`. */
import { describe, expect, it } from 'vitest';
import { decodeLabelSettings, labelSettingsFromResource, resolveLabelSettings } from './decode';
import type { TscnInternalResource } from '../../../parser/types';
import type { ParsedResource } from '../../../parser/parsedResource';

describe('decodeLabelSettings', () => {
  it('reads every field at an authored value (happy path)', () => {
    const result = decodeLabelSettings({
      line_spacing: '5.5',
      font: 'ExtResource("1_font")',
      font_size: '24',
      font_color: 'Color(1, 0, 0, 1)',
      outline_size: '2',
      outline_color: 'Color(0, 0, 0, 1)',
      shadow_size: '3',
      shadow_color: 'Color(0, 0, 0, 0.8)',
      shadow_offset: 'Vector2(2, 4)',
    });
    expect(result).toEqual({
      lineSpacing: 5.5,
      font: 'ExtResource("1_font")',
      fontSize: 24,
      fontColor: { r: 1, g: 0, b: 0, a: 1 },
      outlineSize: 2,
      outlineColor: { r: 0, g: 0, b: 0, a: 1 },
      shadowSize: 3,
      shadowColor: { r: 0, g: 0, b: 0, a: 0.8 },
      shadowOffset: { x: 2, y: 4 },
    });
  });

  it('falls back to the class defaults absent every field (edge case)', () => {
    // label_settings.h:54,58-59,61-62,64-66.
    const result = decodeLabelSettings({});
    expect(result).toEqual({
      lineSpacing: 3,
      font: undefined,
      fontSize: 16,
      fontColor: { r: 1, g: 1, b: 1, a: 1 },
      outlineSize: 0,
      outlineColor: { r: 1, g: 1, b: 1, a: 1 },
      shadowSize: 1,
      shadowColor: { r: 0, g: 0, b: 0, a: 0 },
      shadowOffset: { x: 1, y: 1 },
    });
  });

  it('falls back per-field on a malformed literal rather than refusing the whole resource (error path)', () => {
    const result = decodeLabelSettings({ font_size: 'not-a-number', line_spacing: '5' });
    expect(result.fontSize).toBe(16);
    expect(result.lineSpacing).toBe(5);
  });
});

describe('resolveLabelSettings', () => {
  const internal: TscnInternalResource[] = [
    { id: '1', type: 'LabelSettings', data: { id: '1', font_size: '32' } } as unknown as TscnInternalResource,
  ];

  it('decodes the SubResource a ref names (happy path)', () => {
    expect(resolveLabelSettings('SubResource("1")', internal)?.fontSize).toBe(32);
  });

  it('is null for an ExtResource reference — no SubResource to resolve (error path)', () => {
    expect(resolveLabelSettings('ExtResource("1_x")', internal)).toBeNull();
  });

  it('is null for an absent ref (edge case)', () => {
    expect(resolveLabelSettings(undefined, internal)).toBeNull();
  });
});

describe('labelSettingsFromResource', () => {
  it('decodes a standalone .tres carrying a LabelSettings (happy path)', () => {
    const parsed: ParsedResource = {
      resourceType: 'LabelSettings',
      properties: { font_size: '40' },
      extResources: [],
      subResources: [],
    };
    expect(labelSettingsFromResource(parsed)?.fontSize).toBe(40);
  });

  it('is null for a .tres of some other resource type (error path)', () => {
    const parsed: ParsedResource = {
      resourceType: 'Curve',
      properties: {},
      extResources: [],
      subResources: [],
    };
    expect(labelSettingsFromResource(parsed)).toBeNull();
  });
});
