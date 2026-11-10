/** LabelSettings decode against Godot 4.6.3: `scene/resources/label_settings.h:54-65`. */
import { describe, expect, it } from 'vitest';
import { labelSettingsFromResource, resolveLabelSettings } from './decode';
import { resolveOnlySubResource } from '../../../testing/subResource';
import type { TscnInternalResource } from '../../../parser/types';
import type { ParsedResource } from '../../../parser/parsedResource';
import type { LabelSettingsResource } from './types';

/** The LabelSettings a sub-resource with this body decodes to. */
function decode(data: Record<string, string>): LabelSettingsResource {
  return resolveOnlySubResource('LabelSettings', data, resolveLabelSettings)!;
}

describe('the LabelSettings body resolveLabelSettings decodes', () => {
  it('reads every field at an authored value (happy path)', () => {
    const result = decode({
      line_spacing: '5.5',
      paragraph_spacing: '7.25',
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
      paragraphSpacing: 7.25,
      font: 'ExtResource("1_font")',
      fontSize: 24,
      fontColor: { r: 1, g: 0, b: 0, a: 1 },
      outlineSize: 2,
      outlineColor: { r: 0, g: 0, b: 0, a: 1 },
      shadowSize: 3,
      shadowColor: { r: 0, g: 0, b: 0, a: 0.8 },
      shadowOffset: { x: 2, y: 4 },
      stackedOutlines: [],
      stackedShadows: [],
    });
  });

  it('falls back to the class defaults absent every field (edge case)', () => {
    // label_settings.h:54-55,58-59,61-62,64-66.
    const result = decode({});
    expect(result).toEqual({
      lineSpacing: 3,
      paragraphSpacing: 0,
      font: undefined,
      fontSize: 16,
      fontColor: { r: 1, g: 1, b: 1, a: 1 },
      outlineSize: 0,
      outlineColor: { r: 1, g: 1, b: 1, a: 1 },
      shadowSize: 1,
      shadowColor: { r: 0, g: 0, b: 0, a: 0 },
      shadowOffset: { x: 1, y: 1 },
      stackedOutlines: [],
      stackedShadows: [],
    });
  });

  it('falls back per-field on a malformed literal rather than refusing the whole resource (error path)', () => {
    const result = decode({ font_size: 'not-a-number', line_spacing: '5' });
    expect(result.fontSize).toBe(16);
    expect(result.lineSpacing).toBe(5);
  });
});

describe('the stacked arrays resolveLabelSettings decodes', () => {
  const BLACK = { r: 0, g: 0, b: 0, a: 1 };

  it('reads each stacked outline and stacked shadow at an authored value (happy path)', () => {
    const result = decode({
      stacked_outline_count: '2',
      'stacked_outline_0/size': '8',
      'stacked_outline_0/color': 'Color(1, 0, 0, 1)',
      'stacked_outline_1/size': '6',
      'stacked_outline_1/color': 'Color(0, 1, 0, 1)',
      stacked_shadow_count: '1',
      'stacked_shadow_0/offset': 'Vector2(6, 7)',
      'stacked_shadow_0/color': 'Color(0, 0, 1, 1)',
      'stacked_shadow_0/outline_size': '4',
    });
    expect(result.stackedOutlines).toEqual([
      { size: 8, color: { r: 1, g: 0, b: 0, a: 1 } },
      { size: 6, color: { r: 0, g: 1, b: 0, a: 1 } },
    ]);
    expect(result.stackedShadows).toEqual([
      { offset: { x: 6, y: 7 }, color: { r: 0, g: 0, b: 1, a: 1 }, outlineSize: 4 },
    ]);
  });

  it('gives an entry with no property the class default of its element (edge case)', () => {
    // label_settings.h:43-51: size 0, offset Vector2i(1, 1), outline_size 0, colour opaque black.
    const result = decode({ stacked_outline_count: '1', stacked_shadow_count: '1' });
    expect(result.stackedOutlines).toEqual([{ size: 0, color: BLACK }]);
    expect(result.stackedShadows).toEqual([{ offset: { x: 1, y: 1 }, color: BLACK, outlineSize: 0 }]);
  });

  it('truncates a stacked shadow offset toward zero, as its Vector2i does (edge case)', () => {
    const result = decode({
      stacked_shadow_count: '1',
      'stacked_shadow_0/offset': 'Vector2(-2.9, 3.9)',
    });
    expect(result.stackedShadows[0]!.offset).toEqual({ x: -2, y: 3 });
  });

  it('decodes nothing for a negative count (error path)', () => {
    // label_settings.cpp:255-262,359-365: the count setter rejects a negative.
    const result = decode({ stacked_outline_count: '-1', stacked_shadow_count: '-3' });
    expect(result.stackedOutlines).toEqual([]);
    expect(result.stackedShadows).toEqual([]);
  });

  it('ignores an element at or past the count (error path)', () => {
    // label_settings.cpp:290-296: ERR_FAIL_INDEX on a setter past the array.
    const result = decode({
      stacked_outline_count: '1',
      'stacked_outline_0/size': '2',
      'stacked_outline_1/size': '9',
      'stacked_shadow_0/outline_size': '9',
    });
    expect(result.stackedOutlines).toEqual([{ size: 2, color: BLACK }]);
    expect(result.stackedShadows).toEqual([]);
  });
});

describe('resolveLabelSettings', () => {
  const internal: TscnInternalResource[] = [
    { id: '1', type: 'LabelSettings', data: { font_size: '32' } } as unknown as TscnInternalResource,
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
