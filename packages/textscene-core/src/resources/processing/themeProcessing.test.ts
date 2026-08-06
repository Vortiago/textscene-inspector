import { describe, it, expect, vi } from 'vitest';
import {
  decodeThemeAddresses,
  resolveThemeResource,
  resolveInlineFontResource,
  resolveInlineThemeResource,
  createThemeResourceFromContent,
  buildThemeResource,
  buildThemeTypeChain,
  resolveThemeFont,
  resolveThemeFontSizePx,
  type ThemeResource,
  type ThemeAddresses,
} from './themeProcessing';
import type { FontLoaderFn, FontResource } from './fontProcessing';

const NO_OP_LOADER: FontLoaderFn = async () => null;

const FONT_A: FontResource = { kind: 'file', bytes: new ArrayBuffer(1), mimeType: 'font/ttf', fallbacks: [], properties: {} };
const FONT_B: FontResource = { kind: 'file', bytes: new ArrayBuffer(1), mimeType: 'font/otf', fallbacks: [], properties: {} };

/** An empty `ThemeResource`, overridden per test — keeps every literal short. */
function theme(overrides: Partial<ThemeResource> = {}): ThemeResource {
  return {
    defaultFont: null,
    defaultFontSize: undefined,
    fonts: {},
    fontSizes: {},
    typeVariations: {},
    properties: {},
    ...overrides,
  };
}

describe('decodeThemeAddresses', () => {
  it('decodes default_font/default_font_size and leaves the rest raw', () => {
    const addresses = decodeThemeAddresses(
      'res://theme.tres',
      { default_font: 'ExtResource("1")', default_font_size: '20', 'Panel/styles/panel': 'SubResource("2")' },
      [{ id: '1', path: 'res://fonts/a.ttf', type: 'FontFile' }],
      []
    );
    expect(addresses.defaultFont).toBe('res://fonts/a.ttf');
    expect(addresses.defaultFontSize).toBe(20);
    expect(addresses.properties).toEqual({ 'Panel/styles/panel': 'SubResource("2")' });
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

describe('resolveThemeResource', () => {
  it('resolves default_font and every <Type>/fonts/<name> address through loadFont', async () => {
    const loadFont = vi.fn(async (address: string) =>
      address === 'res://fonts/default.ttf' ? FONT_A : address === 'res://fonts/label.ttf' ? FONT_B : null
    );
    const addresses: ThemeAddresses = {
      defaultFont: 'res://fonts/default.ttf',
      defaultFontSize: 20,
      fonts: { Label: { font: 'res://fonts/label.ttf' } },
      fontSizes: { Label: { font_size: 24 } },
      typeVariations: {},
      properties: {},
    };

    const resource = await resolveThemeResource(addresses, loadFont);

    expect(resource.defaultFont).toBe(FONT_A);
    expect(resource.fonts.Label?.font).toBe(FONT_B);
    expect(resource.fontSizes).toEqual({ Label: { font_size: 24 } });
  });

  it('omits a font entry whose address fails to load (collapses to absent, not null)', async () => {
    const addresses: ThemeAddresses = {
      defaultFont: null,
      defaultFontSize: undefined,
      fonts: { Button: { font: 'res://fonts/missing.ttf' } },
      fontSizes: {},
      typeVariations: {},
      properties: {},
    };
    const resource = await resolveThemeResource(addresses, NO_OP_LOADER);
    expect(resource.fonts.Button).toBeUndefined();
  });

  it('defaultFont is null when the address is absent', async () => {
    const addresses: ThemeAddresses = {
      defaultFont: null,
      defaultFontSize: undefined,
      fonts: {},
      fontSizes: {},
      typeVariations: {},
      properties: {},
    };
    const resource = await resolveThemeResource(addresses, NO_OP_LOADER);
    expect(resource.defaultFont).toBeNull();
  });
});

describe('resolveInlineFontResource', () => {
  it('resolves an ExtResource ref through the cache', () => {
    const cache = { getCached: (address: string) => (address === 'res://fonts/a.ttf' ? FONT_A : undefined) };
    const pending = new Set<string>();
    const resolved = resolveInlineFontResource(
      'ExtResource("1")',
      [{ id: '1', path: 'res://fonts/a.ttf', type: 'FontFile' }],
      [],
      cache,
      pending
    );
    expect(resolved).toBe(FONT_A);
    expect(pending.size).toBe(0);
  });

  it('collects an uncached ExtResource address into pending and returns null for this pass', () => {
    const cache = { getCached: () => undefined };
    const pending = new Set<string>();
    const resolved = resolveInlineFontResource(
      'ExtResource("1")',
      [{ id: '1', path: 'res://fonts/a.ttf', type: 'FontFile' }],
      [],
      cache,
      pending
    );
    expect(resolved).toBeNull();
    expect(pending.has('res://fonts/a.ttf')).toBe(true);
  });

  it('a previously-failed (cached null) address is null, not pending', () => {
    const cache = { getCached: () => null };
    const pending = new Set<string>();
    const resolved = resolveInlineFontResource(
      'ExtResource("1")',
      [{ id: '1', path: 'res://fonts/dead.ttf', type: 'FontFile' }],
      [],
      cache,
      pending
    );
    expect(resolved).toBeNull();
    expect(pending.size).toBe(0);
  });

  it('decodes a scene-inline SystemFont sub-resource synchronously, no cache involved', () => {
    const cache = { getCached: () => undefined };
    const pending = new Set<string>();
    const resolved = resolveInlineFontResource(
      'SubResource("SystemFont_1")',
      [],
      [{ id: 'SystemFont_1', type: 'SystemFont', data: { font_names: 'PackedStringArray("sans-serif")' } }],
      cache,
      pending
    );
    expect(resolved).toEqual({ kind: 'system', fontNames: ['sans-serif'], properties: {} });
    expect(pending.size).toBe(0);
  });

  it("decodes a scene-inline FontVariation, recursing into base_font's ExtResource through the cache", () => {
    const cache = { getCached: (address: string) => (address === 'res://fonts/base.ttf' ? FONT_A : undefined) };
    const pending = new Set<string>();
    const resolved = resolveInlineFontResource(
      'SubResource("FontVariation_1")',
      [{ id: '1', path: 'res://fonts/base.ttf', type: 'FontFile' }],
      [{ id: 'FontVariation_1', type: 'FontVariation', data: { base_font: 'ExtResource("1")', spacing_glyph: '-8' } }],
      cache,
      pending
    );
    expect(resolved).toEqual({ kind: 'variation', baseFont: FONT_A, properties: { spacing_glyph: '-8' } });
  });

  it('a FontVariation with no base_font resolves to a null baseFont', () => {
    const cache = { getCached: () => undefined };
    const pending = new Set<string>();
    const resolved = resolveInlineFontResource(
      'SubResource("FontVariation_1")',
      [],
      [{ id: 'FontVariation_1', type: 'FontVariation', data: {} }],
      cache,
      pending
    );
    expect(resolved).toEqual({ kind: 'variation', baseFont: null, properties: {} });
  });

  it('decodes a scene-inline FontFile, resolving every fallback', () => {
    const cache = { getCached: (address: string) => (address === 'res://fonts/good.ttf' ? FONT_A : null) };
    const pending = new Set<string>();
    const resolved = resolveInlineFontResource(
      'SubResource("FontFile_1")',
      [
        { id: '1', path: 'res://fonts/good.ttf', type: 'FontFile' },
        { id: '2', path: 'res://fonts/missing.ttf', type: 'FontFile' },
      ],
      [
        {
          id: 'FontFile_1',
          type: 'FontFile',
          data: { fallbacks: 'Array[Font]([ExtResource("1"), ExtResource("2")])' },
        },
      ],
      cache,
      pending
    );
    expect(resolved).toEqual({ kind: 'file', bytes: undefined, mimeType: undefined, fallbacks: [FONT_A], properties: {} });
  });

  it('returns null for a SubResource id that is not declared', () => {
    const resolved = resolveInlineFontResource('SubResource("Missing")', [], [], { getCached: () => undefined }, new Set());
    expect(resolved).toBeNull();
  });

  it('returns null for a SubResource that is not a Font type', () => {
    const resolved = resolveInlineFontResource(
      'SubResource("StyleBoxFlat_1")',
      [],
      [{ id: 'StyleBoxFlat_1', type: 'StyleBoxFlat', data: {} }],
      { getCached: () => undefined },
      new Set()
    );
    expect(resolved).toBeNull();
  });

  it('returns null for an absent or malformed ref', () => {
    const cache = { getCached: () => undefined };
    expect(resolveInlineFontResource(undefined, [], [], cache, new Set())).toBeNull();
    expect(resolveInlineFontResource('not-a-ref', [], [], cache, new Set())).toBeNull();
  });
});

describe('resolveInlineThemeResource', () => {
  it('resolves default_font and <Type>/fonts/<name> against the scene\'s own scope', () => {
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

  it('leaves non-font properties raw', () => {
    const resource = resolveInlineThemeResource(
      { 'Panel/styles/panel': 'null' },
      [],
      [],
      { getCached: () => undefined },
      new Set()
    );
    expect(resource.properties).toEqual({ 'Panel/styles/panel': 'null' });
  });
});

const THEME_TRES = [
  '[gd_resource type="Theme" load_steps=2 format=3]',
  '',
  '[ext_resource type="FontFile" path="res://fonts/base.ttf" id="1"]',
  '',
  '[resource]',
  'default_font = ExtResource("1")',
  'default_font_size = 20',
  'Label/fonts/font = ExtResource("1")',
  'title_panel/base_type = &"Panel"',
  'Panel/styles/panel = null',
  '',
].join('\n');

const MULTI_THEME_TRES = [
  '[gd_resource type="Resource" load_steps=1 format=3]',
  '',
  '[sub_resource type="Theme" id="5"]',
  'default_font_size = 18',
  '',
  '[resource]',
  '',
].join('\n');

describe('createThemeResourceFromContent', () => {
  it('resolves the whole file when no subResourceId is given', async () => {
    const loadFont: FontLoaderFn = async (address) => (address === 'res://fonts/base.ttf' ? FONT_A : null);
    const resource = await createThemeResourceFromContent('res://theme.tres', THEME_TRES, loadFont);
    expect(resource.defaultFont).toBe(FONT_A);
    expect(resource.defaultFontSize).toBe(20);
    expect(resource.fonts.Label?.font).toBe(FONT_A);
    expect(resource.typeVariations.title_panel).toBe('Panel');
    expect(resource.properties['Panel/styles/panel']).toBe('null');
  });

  it('resolves a named Theme sub-resource inside a shared file', async () => {
    const resource = await createThemeResourceFromContent(
      'res://shared.tres',
      MULTI_THEME_TRES,
      NO_OP_LOADER,
      '5'
    );
    expect(resource.defaultFontSize).toBe(18);
  });

  it('throws for an unknown sub-resource id', async () => {
    await expect(
      createThemeResourceFromContent('res://shared.tres', MULTI_THEME_TRES, NO_OP_LOADER, 'DoesNotExist')
    ).rejects.toThrow('Sub-resource "DoesNotExist" is not declared');
  });

  it('throws when parsing content with no [gd_resource] header — a .tscn is never addressed this way', async () => {
    const tscn = '[gd_scene load_steps=1 format=3]\n\n[node name="Root" type="Node"]\n';
    await expect(createThemeResourceFromContent('res://scene.tscn', tscn, NO_OP_LOADER)).rejects.toThrow(
      'missing [gd_resource] header type'
    );
  });

  it('throws when the whole file is not a Theme resource type', async () => {
    const tres = '[gd_resource type="FontFile" format=3]\n\n[resource]\n';
    await expect(createThemeResourceFromContent('res://x.tres', tres, NO_OP_LOADER)).rejects.toThrow(
      'Not a Theme resource: FontFile'
    );
  });

  it('throws when a named sub-resource is not a Theme', async () => {
    const tres = '[gd_resource type="Resource" format=3]\n\n[sub_resource type="StyleBoxFlat" id="1"]\n\n[resource]\n';
    await expect(createThemeResourceFromContent('res://x.tres', tres, NO_OP_LOADER, '1')).rejects.toThrow(
      'Not a Theme resource: StyleBoxFlat'
    );
  });
});

describe('buildThemeResource', () => {
  it('dispatches a plain address to the whole file', async () => {
    const resource = await buildThemeResource('res://theme.tres', THEME_TRES, NO_OP_LOADER);
    expect(resource.defaultFontSize).toBe(20);
  });

  it('dispatches a res://file.tres::SubId address to the named sub-resource', async () => {
    const resource = await buildThemeResource('res://shared.tres::5', MULTI_THEME_TRES, NO_OP_LOADER);
    expect(resource.defaultFontSize).toBe(18);
  });
});

describe('buildThemeTypeChain', () => {
  it('is just the native inheritance chain when no type variation is set', () => {
    expect(buildThemeTypeChain('Label', undefined, [], null)).toEqual(['Label', 'Control', 'Node']);
  });

  it('walks the variation base_type chain from the theme that registers it, then appends the native chain', () => {
    const t = theme({ typeVariations: { title_panel: 'Panel' } });
    expect(buildThemeTypeChain('Panel', 'title_panel', [t], null)).toEqual([
      'title_panel',
      'Panel',
      'Control',
      'Node',
    ]);
  });

  it('falls back to the native chain alone when no ancestor/project theme registers the variation', () => {
    expect(buildThemeTypeChain('Label', 'HeaderLabel', [theme()], null)).toEqual(['Label', 'Control', 'Node']);
  });

  it('uses the FIRST theme (nearest ancestor before project) that registers the variation', () => {
    const nearest = theme({ typeVariations: { title_panel: 'Panel' } });
    const project = theme({ typeVariations: { title_panel: 'Control' } });
    expect(buildThemeTypeChain('Panel', 'title_panel', [nearest], project)).toEqual([
      'title_panel',
      'Panel',
      'Control',
      'Node',
    ]);
  });

  it('finds the variation on the project theme when no ancestor registers it', () => {
    const project = theme({ typeVariations: { title_panel: 'Panel' } });
    expect(buildThemeTypeChain('Panel', 'title_panel', [], project)).toEqual([
      'title_panel',
      'Panel',
      'Control',
      'Node',
    ]);
  });
});

describe('resolveThemeFont', () => {
  it('a valid node-local override wins over any ancestor theme', () => {
    const ancestor = theme({ fonts: { Label: { font: FONT_B } } });
    expect(resolveThemeFont('font', FONT_A, 'Label', undefined, [ancestor], null)).toBe(FONT_A);
  });

  it('an override explicitly authored to nothing (null) STOPS the walk — it does not fall through', () => {
    const ancestor = theme({ fonts: { Label: { font: FONT_B } } });
    expect(resolveThemeFont('font', null, 'Label', undefined, [ancestor], null)).toBeNull();
  });

  it('no override (undefined) falls through to the ancestor theme', () => {
    const ancestor = theme({ fonts: { Label: { font: FONT_B } } });
    expect(resolveThemeFont('font', undefined, 'Label', undefined, [ancestor], null)).toBe(FONT_B);
  });

  it('the nearest ancestor wins over a farther one', () => {
    const nearest = theme({ fonts: { Label: { font: FONT_A } } });
    const farther = theme({ fonts: { Label: { font: FONT_B } } });
    expect(resolveThemeFont('font', undefined, 'Label', undefined, [nearest, farther], null)).toBe(FONT_A);
  });

  it('a gap ancestor (its theme does not define the key) falls through to the next ancestor', () => {
    const gap = theme();
    const farther = theme({ fonts: { Label: { font: FONT_B } } });
    expect(resolveThemeFont('font', undefined, 'Label', undefined, [gap, farther], null)).toBe(FONT_B);
  });

  it('falls through every ancestor to the project theme', () => {
    const project = theme({ fonts: { Label: { font: FONT_B } } });
    expect(resolveThemeFont('font', undefined, 'Label', undefined, [theme(), theme()], project)).toBe(FONT_B);
  });

  it('resolves to null (the caller renders its own bundled default) when nothing anywhere defines it', () => {
    expect(resolveThemeFont('font', undefined, 'Label', undefined, [theme(), theme()], theme())).toBeNull();
  });

  it("a theme's own default_font SHORT-CIRCUITS the type chain for a NEARER type before a farther type's own explicit entry is ever tried (theme_owner.cpp:236-245's types-inner loop)", () => {
    // `Control/fonts/font` is explicit on this SAME theme, but `Label` (the
    // nearer type in the chain) already satisfies `has_font` via this
    // theme's own `default_font` — so `Control/fonts/font` is shadowed.
    const shadowing = theme({ defaultFont: FONT_A, fonts: { Control: { font: FONT_B } } });
    expect(resolveThemeFont('font', undefined, 'Label', undefined, [shadowing], null)).toBe(FONT_A);
  });

  it('a type registered as a variation IN THIS THEME skips ONLY that type\'s default_font fallback — the walk continues within the SAME theme\'s turn (has_font_no_default, theme.cpp:1009-1017) and still finds ITS OWN default_font one type later, never reaching a farther ancestor\'s explicit entry', () => {
    // "title_panel" is a registered variation in `nearest`, so `nearest`
    // contributes nothing AT THAT TYPE — but the very next type in the chain
    // ("Panel", a real class, never itself a variation) is not gated, and
    // `nearest`'s own `default_font` fires there. `farther`'s explicit
    // `title_panel/fonts/font` is never reached at all.
    const nearest = theme({ defaultFont: FONT_A, typeVariations: { title_panel: 'Panel' } });
    const farther = theme({ fonts: { title_panel: { font: FONT_B } } });
    expect(
      resolveThemeFont('font', undefined, 'Panel', 'title_panel', [nearest, farther], null)
    ).toBe(FONT_A);
  });
});

describe('resolveThemeFontSizePx', () => {
  it('a positive node-local override wins over any ancestor theme', () => {
    const ancestor = theme({ fontSizes: { Label: { font_size: 30 } } });
    expect(resolveThemeFontSizePx('font_size', 24, 'Label', undefined, [ancestor], null, 16)).toBe(24);
  });

  it('an override of 0 does NOT win — falls through like an absent one (Control::get_theme_font_size, control.cpp:3114-3117)', () => {
    const ancestor = theme({ fontSizes: { Label: { font_size: 30 } } });
    expect(resolveThemeFontSizePx('font_size', 0, 'Label', undefined, [ancestor], null, 16)).toBe(30);
  });

  it('falls through the ancestor chain to the theme default_font_size', () => {
    const ancestor = theme({ defaultFontSize: 22 });
    expect(resolveThemeFontSizePx('font_size', undefined, 'Label', undefined, [ancestor], null, 16)).toBe(22);
  });

  it('falls back to the built-in default size when nothing anywhere defines it', () => {
    expect(resolveThemeFontSizePx('font_size', undefined, 'Label', undefined, [theme()], theme(), 16)).toBe(16);
  });

  it('the nearest ancestor wins over a farther one', () => {
    const nearest = theme({ fontSizes: { Label: { font_size: 20 } } });
    const farther = theme({ fontSizes: { Label: { font_size: 30 } } });
    expect(
      resolveThemeFontSizePx('font_size', undefined, 'Label', undefined, [nearest, farther], null, 16)
    ).toBe(20);
  });
});
