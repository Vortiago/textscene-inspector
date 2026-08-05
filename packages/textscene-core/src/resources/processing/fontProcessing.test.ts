import { describe, it, expect, vi } from 'vitest';
import {
  isFontFilePath,
  isFontPath,
  getFontMimeType,
  fontResourceFromBytes,
  resolveFontResource,
  createFontResourceFromContent,
  buildFontResource,
  type FontResource,
  type FontLoaderFn,
} from './fontProcessing';

describe('isFontFilePath', () => {
  it('matches raw font file extensions', () => {
    expect(isFontFilePath('res://fonts/Xolonium-Regular.ttf')).toBe(true);
    expect(isFontFilePath('res://fonts/Montserrat.otf')).toBe(true);
    expect(isFontFilePath('res://fonts/Recursive.woff')).toBe(true);
    expect(isFontFilePath('res://fonts/Recursive.woff2')).toBe(true);
  });

  it('is case-insensitive on extension', () => {
    expect(isFontFilePath('res://fonts/Xolonium-Regular.TTF')).toBe(true);
  });

  it('rejects a .tres and unrelated extensions', () => {
    expect(isFontFilePath('res://theme/fonts/montserrat.tres')).toBe(false);
    expect(isFontFilePath('res://textures/checker.png')).toBe(false);
    expect(isFontFilePath('res://noext')).toBe(false);
  });
});

describe('isFontPath', () => {
  it('accepts raw font files and any .tres', () => {
    expect(isFontPath('res://fonts/Xolonium-Regular.ttf')).toBe(true);
    expect(isFontPath('res://theme/fonts/montserrat.tres')).toBe(true);
  });

  it('rejects unrelated extensions', () => {
    expect(isFontPath('res://textures/checker.png')).toBe(false);
  });
});

describe('getFontMimeType', () => {
  it('maps every font extension to its mime type', () => {
    expect(getFontMimeType('res://a.ttf')).toBe('font/ttf');
    expect(getFontMimeType('res://a.otf')).toBe('font/otf');
    expect(getFontMimeType('res://a.woff')).toBe('font/woff');
    expect(getFontMimeType('res://a.woff2')).toBe('font/woff2');
  });

  it('returns undefined for a non-font extension', () => {
    expect(getFontMimeType('res://a.png')).toBeUndefined();
  });
});

describe('fontResourceFromBytes', () => {
  it('wraps raw bytes with the derived mime type and no fallbacks', () => {
    const bytes = new ArrayBuffer(4);
    const resource = fontResourceFromBytes('res://fonts/Xolonium-Regular.ttf', bytes);
    expect(resource).toEqual({
      kind: 'file',
      bytes,
      mimeType: 'font/ttf',
      fallbacks: [],
      properties: {},
    });
  });
});

/** A loader that never resolves anything — for cases with no Font-valued property to recurse into. */
const NO_OP_LOADER: FontLoaderFn = async () => null;

describe('resolveFontResource', () => {
  it('decodes a SystemFont from font_names, leaving other properties raw', async () => {
    const resource = await resolveFontResource(
      'res://x.tres',
      'SystemFont',
      { font_names: 'PackedStringArray("sans-serif")', resource_name: '"MySystemFont"' },
      [],
      [],
      NO_OP_LOADER
    );
    expect(resource).toEqual({
      kind: 'system',
      fontNames: ['sans-serif'],
      properties: { resource_name: '"MySystemFont"' },
    });
  });

  it('decodes a SystemFont with an empty font_names list when the property is absent', async () => {
    const resource = await resolveFontResource('res://x.tres', 'SystemFont', {}, [], [], NO_OP_LOADER);
    expect(resource).toEqual({ kind: 'system', fontNames: [], properties: {} });
  });

  it('decodes a FontVariation with no base_font (theme default) as baseFont: null', async () => {
    const resource = await resolveFontResource(
      'res://x.tscn',
      'FontVariation',
      { spacing_glyph: '-8' },
      [],
      [],
      NO_OP_LOADER
    );
    expect(resource).toEqual({ kind: 'variation', baseFont: null, properties: { spacing_glyph: '-8' } });
  });

  it('recurses into an ExtResource base_font via loadFont', async () => {
    const loaded: FontResource = { kind: 'file', bytes: new ArrayBuffer(1), mimeType: 'font/otf', fallbacks: [], properties: {} };
    const loadFont = vi.fn(async (address: string) => (address === 'res://fonts/base.otf' ? loaded : null));

    const resource = await resolveFontResource(
      'res://lib_font.tres',
      'FontVariation',
      { base_font: 'ExtResource("1")' },
      [{ id: '1', path: 'res://fonts/base.otf', type: 'FontFile' }],
      [],
      loadFont
    );

    expect(loadFont).toHaveBeenCalledWith('res://fonts/base.otf');
    expect(resource).toEqual({ kind: 'variation', baseFont: loaded, properties: {} });
  });

  it('recurses into a SubResource base_font as a res://self::id address', async () => {
    const loaded: FontResource = { kind: 'system', fontNames: ['monospace'], properties: {} };
    const loadFont = vi.fn(async (address: string) =>
      address === 'res://scene.tscn::SystemFont_x' ? loaded : null
    );

    const resource = await resolveFontResource(
      'res://scene.tscn',
      'FontVariation',
      { base_font: 'SubResource("SystemFont_x")' },
      [],
      [{ id: 'SystemFont_x', type: 'SystemFont', data: { font_names: 'PackedStringArray("monospace")' } }],
      loadFont
    );

    expect(loadFont).toHaveBeenCalledWith('res://scene.tscn::SystemFont_x');
    expect(resource).toEqual({ kind: 'variation', baseFont: loaded, properties: {} });
  });

  it('resolves a FontFile with no fallbacks (bytes-less-only case never keeps a fallback list)', async () => {
    const resource = await resolveFontResource('res://x.tres', 'FontFile', {}, [], [], NO_OP_LOADER);
    expect(resource).toEqual({ kind: 'file', bytes: undefined, mimeType: undefined, fallbacks: [], properties: {} });
  });

  it('resolves every fallback in a FontFile fallbacks list, in order, dropping ones that fail to load', async () => {
    const good: FontResource = { kind: 'file', bytes: new ArrayBuffer(1), mimeType: 'font/ttf', fallbacks: [], properties: {} };
    const loadFont = vi.fn(async (address: string) => (address === 'res://fonts/good.ttf' ? good : null));

    const resource = await resolveFontResource(
      'res://droid_sans.tres',
      'FontFile',
      { fallbacks: 'Array[Font]([ExtResource("1"), ExtResource("2")])' },
      [
        { id: '1', path: 'res://fonts/good.ttf', type: 'FontFile' },
        { id: '2', path: 'res://fonts/missing.ttf', type: 'FontFile' },
      ],
      [],
      loadFont
    );

    expect(loadFont).toHaveBeenCalledTimes(2);
    expect(resource).toEqual({ kind: 'file', bytes: undefined, mimeType: undefined, fallbacks: [good], properties: {} });
  });

  it('throws for an unsupported resource type', async () => {
    await expect(
      resolveFontResource('res://x.tres', 'StyleBoxFlat', {}, [], [], NO_OP_LOADER)
    ).rejects.toThrow('Unsupported font resource type: StyleBoxFlat');
  });

  it('gates the SubResource branch to font types — a non-font sub-resource resolves to no address', async () => {
    const loadFont = vi.fn(async () => null);
    const resource = await resolveFontResource(
      'res://scene.tscn',
      'FontVariation',
      { base_font: 'SubResource("StandardMaterial3D_x")' },
      [],
      [{ id: 'StandardMaterial3D_x', type: 'StandardMaterial3D', data: {} }],
      loadFont
    );
    expect(loadFont).not.toHaveBeenCalled();
    expect(resource).toEqual({ kind: 'variation', baseFont: null, properties: {} });
  });
});

const MONTSERRAT_TRES = [
  '[gd_resource type="FontFile" load_steps=2 format=3]',
  '',
  '[ext_resource type="FontFile" path="res://theme/fonts/montserrat_extra_bold.otf" id="1"]',
  '',
  '[resource]',
  'fallbacks = Array[Font]([ExtResource("1")])',
  'cache/0/variation_coordinates = {}',
  '',
].join('\n');

// A `.tres` (`[gd_resource]` header) carrying more than one Font as named
// sub-resources — the ONLY shape `res://file.tres::SubId` addresses. A
// scene's own inline sub-resource never goes through this path (see
// `createFontResourceFromContent`'s docstring): `parseTresFile` requires a
// `[gd_resource]` header and rejects a `.tscn`'s `[gd_scene]` outright.
const MULTI_FONT_TRES = [
  '[gd_resource type="Resource" load_steps=2 format=3]',
  '',
  '[ext_resource type="FontFile" path="res://theme/fonts/montserrat_extra_bold.otf" id="1"]',
  '',
  '[sub_resource type="FontFile" id="1"]',
  'fallbacks = Array[Font]([ExtResource("1")])',
  'msdf_size = 128',
  '',
  '[resource]',
  '',
].join('\n');

describe('createFontResourceFromContent', () => {
  it('resolves the whole file when no subResourceId is given', async () => {
    const base: FontResource = { kind: 'file', bytes: new ArrayBuffer(1), mimeType: 'font/otf', fallbacks: [], properties: {} };
    const loadFont: FontLoaderFn = async (address) =>
      address === 'res://theme/fonts/montserrat_extra_bold.otf' ? base : null;

    const resource = await createFontResourceFromContent('res://theme/fonts/montserrat_16.tres', MONTSERRAT_TRES, loadFont);

    expect(resource.kind).toBe('file');
    expect((resource as { fallbacks: FontResource[] }).fallbacks).toEqual([base]);
  });

  it('resolves a named FontFile sub-resource inside a shared fonts-library .tres', async () => {
    const base: FontResource = { kind: 'file', bytes: new ArrayBuffer(1), mimeType: 'font/otf', fallbacks: [], properties: {} };
    const loadFont: FontLoaderFn = async (address) =>
      address === 'res://theme/fonts/montserrat_extra_bold.otf' ? base : null;

    const resource = await createFontResourceFromContent(
      'res://fonts/multi.tres',
      MULTI_FONT_TRES,
      loadFont,
      '1'
    );

    expect(resource).toEqual({ kind: 'file', bytes: undefined, mimeType: undefined, fallbacks: [base], properties: { msdf_size: '128' } });
  });

  it('throws for an unknown sub-resource id', async () => {
    await expect(
      createFontResourceFromContent('res://fonts/multi.tres', MULTI_FONT_TRES, NO_OP_LOADER, 'DoesNotExist')
    ).rejects.toThrow('Sub-resource "DoesNotExist" is not declared');
  });

  it('throws when parsing content with no [gd_resource] header — a .tscn is never addressed this way', async () => {
    const tscn = '[gd_scene load_steps=1 format=3]\n\n[node name="Root" type="Node"]\n';
    await expect(createFontResourceFromContent('res://scene.tscn', tscn, NO_OP_LOADER)).rejects.toThrow(
      'missing [gd_resource] header type'
    );
  });

  it('throws when the whole file is not a font resource type', async () => {
    const tres = '[gd_resource type="StyleBoxFlat" format=3]\n\n[resource]\nbg_color = Color(1, 1, 1, 1)\n';
    await expect(createFontResourceFromContent('res://x.tres', tres, NO_OP_LOADER)).rejects.toThrow(
      'Not a font resource type: StyleBoxFlat'
    );
  });
});

describe('buildFontResource', () => {
  it('routes raw ArrayBuffer data to fontResourceFromBytes', async () => {
    const bytes = new ArrayBuffer(2);
    const resource = await buildFontResource('res://fonts/Xolonium-Regular.ttf', bytes, NO_OP_LOADER);
    expect(resource).toEqual({ kind: 'file', bytes, mimeType: 'font/ttf', fallbacks: [], properties: {} });
  });

  it('routes text data through createFontResourceFromContent, honouring a ::SubId address', async () => {
    const resource = await buildFontResource('res://fonts/multi.tres::1', MULTI_FONT_TRES, NO_OP_LOADER);
    expect(resource.kind).toBe('file');
  });

  it('throws for a sub-resource id nonsensically addressed on a raw font file — no named resources live inside one', async () => {
    const bytes = new ArrayBuffer(2);
    await expect(buildFontResource('res://fonts/x.ttf::SomeId', bytes, NO_OP_LOADER)).rejects.toThrow(
      'Not a recognised font file extension'
    );
  });

  it('throws for an ArrayBuffer whose path has no recognised font extension', async () => {
    await expect(buildFontResource('res://images/x.png', new ArrayBuffer(2), NO_OP_LOADER)).rejects.toThrow(
      'Not a recognised font file extension: res://images/x.png'
    );
  });
});
