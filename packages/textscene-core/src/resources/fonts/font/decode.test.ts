import { describe, it, expect, vi } from 'vitest';
import { decodeFont } from './decode';
import type { FontLoaderFn, FontResource } from './types';

/** A loader that resolves nothing, for cases with no Font-valued property to recurse into. */
const NO_OP_LOADER: FontLoaderFn = async () => null;

const FONT_A: FontResource = {
  kind: 'file',
  bytes: new ArrayBuffer(1),
  mimeType: 'font/ttf',
  fallbacks: [],
  properties: {},
};

describe('decodeFont', () => {
  it('decodes a SystemFont from font_names, leaving other properties raw', async () => {
    const resource = await decodeFont(
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
      baseFont: null,
      fallbacks: [],
      properties: { resource_name: '"MySystemFont"' },
    });
  });

  it('decodes a SystemFont with an empty font_names list when the property is absent', async () => {
    const resource = await decodeFont('res://x.tres', 'SystemFont', {}, [], [], NO_OP_LOADER);
    expect(resource).toEqual({
      kind: 'system',
      fontNames: [],
      baseFont: null,
      fallbacks: [],
      properties: {},
    });
  });

  it('decodes a FontVariation with no base_font (theme default) as baseFont: null', async () => {
    const resource = await decodeFont(
      'res://x.tscn',
      'FontVariation',
      { spacing_glyph: '-8' },
      [],
      [],
      NO_OP_LOADER
    );
    expect(resource).toEqual({
      kind: 'variation',
      baseFont: null,
      fallbacks: [],
      properties: { spacing_glyph: '-8' },
    });
  });

  it('recurses into an ExtResource base_font via loadFont', async () => {
    const loaded: FontResource = {
      kind: 'file',
      bytes: new ArrayBuffer(1),
      mimeType: 'font/otf',
      fallbacks: [],
      properties: {},
    };
    const loadFont = vi.fn(async (address: string) => (address === 'res://fonts/base.otf' ? loaded : null));

    const resource = await decodeFont(
      'res://lib_font.tres',
      'FontVariation',
      { base_font: 'ExtResource("1")' },
      [{ id: '1', path: 'res://fonts/base.otf', type: 'FontFile' }],
      [],
      loadFont
    );

    expect(loadFont).toHaveBeenCalledWith('res://fonts/base.otf');
    expect(resource).toEqual({ kind: 'variation', baseFont: loaded, fallbacks: [], properties: {} });
  });

  it('recurses into a SubResource base_font as a res://self::id address', async () => {
    const loaded: FontResource = {
      kind: 'system',
      fontNames: ['monospace'],
      baseFont: null,
      fallbacks: [],
      properties: {},
    };
    const loadFont = vi.fn(async (address: string) =>
      address === 'res://scene.tscn::SystemFont_x' ? loaded : null
    );

    const resource = await decodeFont(
      'res://scene.tscn',
      'FontVariation',
      { base_font: 'SubResource("SystemFont_x")' },
      [],
      [{ id: 'SystemFont_x', type: 'SystemFont', data: { font_names: 'PackedStringArray("monospace")' } }],
      loadFont
    );

    expect(loadFont).toHaveBeenCalledWith('res://scene.tscn::SystemFont_x');
    expect(resource).toEqual({ kind: 'variation', baseFont: loaded, fallbacks: [], properties: {} });
  });

  it('resolves a FontFile with no fallbacks (bytes-less-only case never keeps a fallback list)', async () => {
    const resource = await decodeFont('res://x.tres', 'FontFile', {}, [], [], NO_OP_LOADER);
    expect(resource).toEqual({
      kind: 'file',
      bytes: undefined,
      mimeType: undefined,
      fallbacks: [],
      properties: {},
    });
  });

  it('resolves every fallback in a FontFile fallbacks list, in order, dropping ones that fail to load', async () => {
    const good: FontResource = {
      kind: 'file',
      bytes: new ArrayBuffer(1),
      mimeType: 'font/ttf',
      fallbacks: [],
      properties: {},
    };
    const loadFont = vi.fn(async (address: string) => (address === 'res://fonts/good.ttf' ? good : null));

    const resource = await decodeFont(
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
    expect(resource).toEqual({
      kind: 'file',
      bytes: undefined,
      mimeType: undefined,
      fallbacks: [good],
      properties: {},
    });
  });

  it('throws for an unsupported resource type', async () => {
    await expect(decodeFont('res://x.tres', 'StyleBoxFlat', {}, [], [], NO_OP_LOADER)).rejects.toThrow(
      'Unsupported font resource type: StyleBoxFlat'
    );
  });

  it('gates the SubResource branch to font types — a non-font sub-resource resolves to no address', async () => {
    const loadFont = vi.fn(async () => null);
    const resource = await decodeFont(
      'res://scene.tscn',
      'FontVariation',
      { base_font: 'SubResource("StandardMaterial3D_x")' },
      [],
      [{ id: 'StandardMaterial3D_x', type: 'StandardMaterial3D', data: {} }],
      loadFont
    );
    expect(loadFont).not.toHaveBeenCalled();
    expect(resource).toEqual({ kind: 'variation', baseFont: null, fallbacks: [], properties: {} });
  });
});

// `fallbacks` is a property of `Font` (`font.cpp:101`), so every Font kind reads it.
describe('the fallbacks of a FontVariation and a SystemFont', () => {
  const extResources = [{ id: '1', path: 'res://fonts/good.ttf', type: 'FontFile' }];
  const loadGood: FontLoaderFn = async (address) => (address === 'res://fonts/good.ttf' ? FONT_A : null);
  const FALLBACKS = { fallbacks: 'Array[Font]([ExtResource("1")])' };

  it.each(['FontVariation', 'SystemFont'])('loads the fallbacks of a %s file', async (type) => {
    const resource = await decodeFont('res://x.tres', type, FALLBACKS, extResources, [], loadGood);
    expect(resource).toMatchObject({ fallbacks: [FONT_A], properties: {} });
  });
});
