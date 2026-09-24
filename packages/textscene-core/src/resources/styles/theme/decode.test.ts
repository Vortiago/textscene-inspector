import { describe, it, expect } from 'vitest';
import { decodeThemeAddresses, resolveInlineThemeResource } from './decode';
import type { FontResource } from '../../fonts/font/types';

const FONT_A: FontResource = { kind: 'file', bytes: new ArrayBuffer(1), mimeType: 'font/ttf', fallbacks: [], properties: {} };

describe('decodeThemeAddresses', () => {
  it('decodes default_font/default_font_size and leaves an unrecognised key raw', () => {
    const addresses = decodeThemeAddresses(
      'res://theme.tres',
      { default_font: 'ExtResource("1")', default_font_size: '20', 'Panel/unknown_data_type/panel': 'SubResource("2")' },
      [{ id: '1', path: 'res://fonts/a.ttf', type: 'FontFile' }],
      []
    );
    expect(addresses.defaultFont).toBe('res://fonts/a.ttf');
    expect(addresses.defaultFontSize).toBe(20);
    expect(addresses.properties).toEqual({ 'Panel/unknown_data_type/panel': 'SubResource("2")' });
  });

  it('decodes <Type>/icons/<name> as a raw ref string, same as styles', () => {
    const addresses = decodeThemeAddresses(
      'res://theme.tres',
      { 'CheckBox/icons/checked': 'SubResource("2")' },
      [],
      []
    );
    expect(addresses.icons?.CheckBox?.checked).toBe('SubResource("2")');
  });

  it('decodes <Type>/styles/<name> as a raw ref string, and carries the theme file\'s own resource pools', () => {
    const ext = [{ id: '1', path: 'res://fonts/a.ttf', type: 'FontFile' }];
    const sub = [{ id: '2', type: 'StyleBoxFlat', data: {} }];
    const addresses = decodeThemeAddresses('res://theme.tres', { 'Panel/styles/panel': 'SubResource("2")' }, ext, sub);
    expect(addresses.styles?.Panel?.panel).toBe('SubResource("2")');
    expect(addresses.resources).toEqual({ externalResources: ext, internalResources: sub });
  });

  it('decodes <Type>/colors/<name> (Theme::get_color, theme.cpp:761-767)', () => {
    const addresses = decodeThemeAddresses(
      'res://theme.tres',
      { 'Label/colors/font_color': 'Color(0.2, 0.4, 0.6, 1)' },
      [],
      []
    );
    expect(addresses.colors?.Label?.font_color).toEqual({ r: 0.2, g: 0.4, b: 0.6, a: 1 });
  });

  it('omits a colors entry whose value is not a Color literal', () => {
    const addresses = decodeThemeAddresses('res://theme.tres', { 'Label/colors/font_color': 'not-a-color' }, [], []);
    expect(addresses.colors?.Label).toBeUndefined();
  });

  it('decodes <Type>/constants/<name> as a literal int, unscaled (Theme::get_constant, theme.cpp:858-864)', () => {
    const addresses = decodeThemeAddresses(
      'res://theme.tres',
      { 'Button/constants/h_separation': '4', 'Button/constants/outline_size': '-1.9' },
      [],
      []
    );
    expect(addresses.constants?.Button?.h_separation).toBe(4);
    // `int constant_map` (`theme.h`): a fractional literal truncates towards zero.
    expect(addresses.constants?.Button?.outline_size).toBe(-1);
  });

  it('is absent when default_font/default_font_size are not declared', () => {
    const addresses = decodeThemeAddresses('res://theme.tres', {}, [], []);
    expect(addresses.defaultFont).toBeNull();
    expect(addresses.defaultFontSize).toBeUndefined();
  });

  it('gates default_font_size to > 0 (Theme::has_default_font_size, theme.cpp:274-276)', () => {
    const addresses = decodeThemeAddresses('res://theme.tres', { default_font_size: '0' }, [], []);
    expect(addresses.defaultFontSize).toBeUndefined();
  });

  it('decodes <Type>/fonts/<name> and <Type>/font_sizes/<name> into per-type maps', () => {
    const addresses = decodeThemeAddresses(
      'res://theme.tres',
      {
        'Label/fonts/font': 'ExtResource("1")',
        'Label/font_sizes/font_size': '24',
        'RichTextLabel/font_sizes/normal_font_size': '18',
      },
      [{ id: '1', path: 'res://fonts/a.ttf', type: 'FontFile' }],
      []
    );
    expect(addresses.fonts.Label?.font).toBe('res://fonts/a.ttf');
    expect(addresses.fontSizes.Label?.font_size).toBe(24);
    expect(addresses.fontSizes.RichTextLabel?.normal_font_size).toBe(18);
  });

  it('omits a font_sizes entry that is <= 0 (Theme::has_font_size, theme.cpp:669)', () => {
    const addresses = decodeThemeAddresses('res://theme.tres', { 'Label/font_sizes/font_size': '0' }, [], []);
    expect(addresses.fontSizes.Label).toBeUndefined();
  });

  it('omits a fonts entry whose ref is absent/malformed', () => {
    const addresses = decodeThemeAddresses('res://theme.tres', { 'Button/fonts/font': 'null' }, [], []);
    expect(addresses.fonts.Button).toBeUndefined();
  });

  it('decodes <variationType>/base_type, stripping the StringName sigil and quotes', () => {
    const addresses = decodeThemeAddresses('res://theme.tres', { 'title_panel/base_type': '&"Panel"' }, [], []);
    expect(addresses.typeVariations.title_panel).toBe('Panel');
  });

  it('resolves a SubResource font ref into a res://self::id address', () => {
    const addresses = decodeThemeAddresses(
      'res://scene.tscn',
      { 'Button/fonts/font': 'SubResource("6")' },
      [],
      [{ id: '6', type: 'FontVariation', data: {} }]
    );
    expect(addresses.fonts.Button?.font).toBe('res://scene.tscn::6');
  });
});

describe('resolveInlineThemeResource', () => {
  it("resolves default_font and <Type>/fonts/<name> against the scene's own scope", () => {
    const cache = { getCached: (address: string) => (address === 'res://fonts/base.ttf' ? FONT_A : undefined) };
    const pending = new Set<string>();
    const resource = resolveInlineThemeResource(
      {
        default_font: 'ExtResource("1")',
        default_font_size: '20',
        'Label/fonts/font': 'SubResource("SystemFont_1")',
      },
      [{ id: '1', path: 'res://fonts/base.ttf', type: 'FontFile' }],
      [{ id: 'SystemFont_1', type: 'SystemFont', data: { font_names: 'PackedStringArray("monospace")' } }],
      cache,
      pending
    );
    expect(resource.defaultFont).toBe(FONT_A);
    expect(resource.defaultFontSize).toBe(20);
    expect(resource.fonts.Label?.font).toEqual({ kind: 'system', fontNames: ['monospace'], properties: {} });
  });

  it('leaves an unrecognised key raw, and decodes styles/icons/colors/constants inline', () => {
    const ext = [{ id: '1', path: 'res://tex.png', type: 'Texture2D' }];
    const int = [{ id: '2', type: 'StyleBoxFlat', data: {} }];
    const resource = resolveInlineThemeResource(
      {
        'Panel/unknown_data_type/panel': 'null',
        'Panel/styles/panel': 'SubResource("2")',
        'CheckBox/icons/checked': 'ExtResource("1")',
        'Label/colors/font_color': 'Color(1, 0, 0, 1)',
        'Button/constants/h_separation': '4',
      },
      ext,
      int,
      { getCached: () => undefined },
      new Set()
    );
    expect(resource.properties).toEqual({ 'Panel/unknown_data_type/panel': 'null' });
    expect(resource.styles?.Panel?.panel).toBe('SubResource("2")');
    expect(resource.icons?.CheckBox?.checked).toBe('ExtResource("1")');
    expect(resource.colors?.Label?.font_color).toEqual({ r: 1, g: 0, b: 0, a: 1 });
    expect(resource.constants?.Button?.h_separation).toBe(4);
    expect(resource.resources).toEqual({ externalResources: ext, internalResources: int });
  });
});
