import { describe, it, expect, vi } from 'vitest';
import { decodeFont, parsePackedStringArray, resolveInlineFontResource } from './decode';
import type { FontLoaderFn, FontResource } from './types';

/** A loader that resolves nothing, for cases with no Font-valued property to recurse into. */
const NO_OP_LOADER: FontLoaderFn = async () => null;

const FONT_A: FontResource = { kind: 'file', bytes: new ArrayBuffer(1), mimeType: 'font/ttf', fallbacks: [], properties: {} };

describe('parsePackedStringArray', () => {
  it('reads each element as a String slot does', () => {
    expect(parsePackedStringArray('PackedStringArray("sans-serif", "Noto Sans")')).toEqual([
      'sans-serif',
      'Noto Sans',
    ]);
  });

  it('decodes the escapes the tokenizer decodes', () => {
    expect(parsePackedStringArray('PackedStringArray("a\\nb", "say \\"hi\\"")')).toEqual([
      'a\nb',
      'say "hi"',
    ]);
  });

  it('reads nothing from an empty array or another value', () => {
    expect(parsePackedStringArray('PackedStringArray()')).toEqual([]);
    expect(parsePackedStringArray('"sans-serif"')).toEqual([]);
  });
});

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
      properties: { resource_name: '"MySystemFont"' },
    });
  });

  it('decodes a SystemFont with an empty font_names list when the property is absent', async () => {
    const resource = await decodeFont('res://x.tres', 'SystemFont', {}, [], [], NO_OP_LOADER);
    expect(resource).toEqual({ kind: 'system', fontNames: [], properties: {} });
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
    expect(resource).toEqual({ kind: 'variation', baseFont: null, properties: { spacing_glyph: '-8' } });
  });

  it('recurses into an ExtResource base_font via loadFont', async () => {
    const loaded: FontResource = { kind: 'file', bytes: new ArrayBuffer(1), mimeType: 'font/otf', fallbacks: [], properties: {} };
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
    expect(resource).toEqual({ kind: 'variation', baseFont: loaded, properties: {} });
  });

  it('recurses into a SubResource base_font as a res://self::id address', async () => {
    const loaded: FontResource = { kind: 'system', fontNames: ['monospace'], properties: {} };
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
    expect(resource).toEqual({ kind: 'variation', baseFont: loaded, properties: {} });
  });

  it('resolves a FontFile with no fallbacks (bytes-less-only case never keeps a fallback list)', async () => {
    const resource = await decodeFont('res://x.tres', 'FontFile', {}, [], [], NO_OP_LOADER);
    expect(resource).toEqual({ kind: 'file', bytes: undefined, mimeType: undefined, fallbacks: [], properties: {} });
  });

  it('resolves every fallback in a FontFile fallbacks list, in order, dropping ones that fail to load', async () => {
    const good: FontResource = { kind: 'file', bytes: new ArrayBuffer(1), mimeType: 'font/ttf', fallbacks: [], properties: {} };
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
    expect(resource).toEqual({ kind: 'file', bytes: undefined, mimeType: undefined, fallbacks: [good], properties: {} });
  });

  it('throws for an unsupported resource type', async () => {
    await expect(
      decodeFont('res://x.tres', 'StyleBoxFlat', {}, [], [], NO_OP_LOADER)
    ).rejects.toThrow('Unsupported font resource type: StyleBoxFlat');
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
    expect(resource).toEqual({ kind: 'variation', baseFont: null, properties: {} });
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
