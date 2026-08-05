/**
 * Font processor — the fifth peer of texture/material/GLB/scene, sharing the
 * same createResourceProcessor cache/inflight/event loop. Exercises the
 * actual corpus shapes: a raw binary font file, a FontFile .tres wrapper
 * whose fallbacks point at that raw file, and a FontVariation whose
 * base_font crosses back into the SAME wrapper file.
 */
import { describe, expect, it, vi } from 'vitest';
import { FileEventBus } from '../FileEventBus';
import { ResourceEventBus } from '../ResourceEventBus';
import type { ResourceProvider } from '../ResourceProvider';
import { createFontProcessor } from './createFontProcessor';
import type { FontResource, FontFileResource, FontVariationResource } from '../processing/fontProcessing';

/** Shaped like scenes/demos/2d/role_playing_game/theme/fonts/montserrat_extra_bold_16.tres. */
const MONTSERRAT_16_TRES = [
  '[gd_resource type="FontFile" load_steps=2 format=3]',
  '',
  '[ext_resource type="FontFile" path="res://theme/fonts/montserrat_extra_bold.otf" id="1"]',
  '',
  '[resource]',
  'fallbacks = Array[Font]([ExtResource("1")])',
  '',
].join('\n');

/** Shaped like scenes/demos/gui/bidi_and_font_features/bidi.tscn's inline FontVariation. */
const VARIATION_TRES = [
  '[gd_resource type="FontVariation" load_steps=2 format=3]',
  '',
  '[ext_resource type="FontFile" path="res://theme/fonts/montserrat_extra_bold.otf" id="1"]',
  '',
  '[resource]',
  'base_font = ExtResource("1")',
  'spacing_glyph = -8',
  '',
].join('\n');

const SYSTEM_FONT_TRES = [
  '[gd_resource type="SystemFont" format=3]',
  '',
  '[resource]',
  'font_names = PackedStringArray("sans-serif")',
  '',
].join('\n');

class MapProvider implements ResourceProvider {
  constructor(private files: Map<string, string | ArrayBuffer>) {}
  loadResource = vi.fn(async (path: string): Promise<string | ArrayBuffer | null> => {
    return this.files.get(path) ?? null;
  });
}

function setup(files: Record<string, string | ArrayBuffer>) {
  const provider = new MapProvider(new Map(Object.entries(files)));
  const eventBus = new ResourceEventBus();
  const processor = createFontProcessor(new FileEventBus(provider), eventBus);
  return { provider, eventBus, processor };
}

describe('createFontProcessor', () => {
  it('loads a raw binary font file as bytes with no parsing', async () => {
    const bytes = new ArrayBuffer(8);
    const { processor, eventBus } = setup({ 'res://fonts/Xolonium-Regular.ttf': bytes });

    const loaded = eventBus.once<FontResource>('font', 'loaded', 'res://fonts/Xolonium-Regular.ttf', 2000);
    processor.request('res://fonts/Xolonium-Regular.ttf');
    const resource = (await loaded) as FontFileResource;

    expect(resource.kind).toBe('file');
    expect(resource.bytes).toBe(bytes);
    expect(resource.mimeType).toBe('font/ttf');
    expect(resource.fallbacks).toEqual([]);
    expect(processor.getCached('res://fonts/Xolonium-Regular.ttf')).toBe(resource);
  });

  it('resolves a FontFile .tres wrapper by loading its fallback across files', async () => {
    const otfBytes = new ArrayBuffer(4);
    const { processor, eventBus } = setup({
      'res://theme/fonts/montserrat_extra_bold_16.tres': MONTSERRAT_16_TRES,
      'res://theme/fonts/montserrat_extra_bold.otf': otfBytes,
    });

    const loaded = eventBus.once<FontResource>(
      'font',
      'loaded',
      'res://theme/fonts/montserrat_extra_bold_16.tres',
      2000
    );
    processor.request('res://theme/fonts/montserrat_extra_bold_16.tres');
    const resource = (await loaded) as FontFileResource;

    expect(resource.kind).toBe('file');
    expect(resource.bytes).toBeUndefined(); // the .tres wrapper carries no bytes of its own
    expect(resource.fallbacks).toHaveLength(1);
    const fallback = resource.fallbacks[0] as FontFileResource;
    expect(fallback.kind).toBe('file');
    expect(fallback.bytes).toBe(otfBytes);
    expect(fallback.mimeType).toBe('font/otf');

    // The fallback settles on its OWN bus entry too — a future consumer
    // requesting the raw .otf directly gets the same identity back.
    expect(processor.getCached('res://theme/fonts/montserrat_extra_bold.otf')).toBe(fallback);
  });

  it('resolves a FontVariation whose base_font crosses to another file', async () => {
    const otfBytes = new ArrayBuffer(4);
    const { processor, eventBus } = setup({
      'res://lib_font.tres': VARIATION_TRES,
      'res://theme/fonts/montserrat_extra_bold.otf': otfBytes,
    });

    const loaded = eventBus.once<FontResource>('font', 'loaded', 'res://lib_font.tres', 2000);
    processor.request('res://lib_font.tres');
    const resource = (await loaded) as FontVariationResource;

    expect(resource.kind).toBe('variation');
    expect(resource.properties).toEqual({ spacing_glyph: '-8' });
    const base = resource.baseFont as FontFileResource;
    expect(base.kind).toBe('file');
    expect(base.bytes).toBe(otfBytes);
  });

  it('resolves a SystemFont with no file at all', async () => {
    const { processor, eventBus } = setup({ 'res://fonts/system.tres': SYSTEM_FONT_TRES });

    const loaded = eventBus.once<FontResource>('font', 'loaded', 'res://fonts/system.tres', 2000);
    processor.request('res://fonts/system.tres');
    const resource = await loaded;

    expect(resource).toEqual({ kind: 'system', fontNames: ['sans-serif'], properties: {} });
  });

  it('addresses a FontFile declared as a named sub-resource of a .tres', async () => {
    const otfBytes = new ArrayBuffer(4);
    const multiFontTres = [
      '[gd_resource type="Resource" load_steps=3 format=3]',
      '',
      '[ext_resource type="FontFile" path="res://theme/fonts/montserrat_extra_bold.otf" id="1"]',
      '',
      '[sub_resource type="FontFile" id="FontFile_a"]',
      'fallbacks = Array[Font]([ExtResource("1")])',
      '',
      '[resource]',
      '',
    ].join('\n');
    const { processor, eventBus } = setup({
      'res://fonts/multi.tres': multiFontTres,
      'res://theme/fonts/montserrat_extra_bold.otf': otfBytes,
    });

    const address = 'res://fonts/multi.tres::FontFile_a';
    const loaded = eventBus.once<FontResource>('font', 'loaded', address, 2000);
    processor.request(address);
    const resource = (await loaded) as FontFileResource;

    expect(resource.kind).toBe('file');
    expect(resource.fallbacks).toHaveLength(1);
    expect((resource.fallbacks[0] as FontFileResource).bytes).toBe(otfBytes);
  });

  it('emits font:failed and caches null for a .tres whose type is not a font resource', async () => {
    const { processor, eventBus } = setup({
      'res://materials/green.tres': '[gd_resource type="StyleBoxFlat" format=3]\n\n[resource]\n',
    });

    const failed = eventBus.once<Error>('font', 'failed', 'res://materials/green.tres', 2000);
    processor.request('res://materials/green.tres');

    await expect(failed).resolves.toBeInstanceOf(Error);
    expect(processor.getCached('res://materials/green.tres')).toBeNull();
  });

  it('fails loudly (never hangs pending) for a sub-resource address into a .tscn — the owning file is not a .tres', async () => {
    // A scene's OWN inline FontVariation/FontFile is resolved synchronously
    // elsewhere (useSceneResources), never through this processor — but
    // nothing stops a caller from constructing this address anyway, and
    // `shouldProcess` cannot see the `::SubId` to decline it up front (it
    // only ever sees the bare file path). Without `buildFontResource`
    // throwing on a non-`.tres` file, this address would sit `inflight`
    // forever: no `loaded`, no `failed`, a `useResource` consumer stuck in
    // `pending` permanently.
    const tscn = '[gd_scene load_steps=1 format=3]\n\n[node name="Root" type="Node"]\n';
    const { processor, eventBus } = setup({ 'res://scene.tscn': tscn });

    const address = 'res://scene.tscn::FontVariation_1';
    const failed = eventBus.once<Error>('font', 'failed', address, 2000);
    processor.request(address);

    await expect(failed).resolves.toBeInstanceOf(Error);
    expect(processor.getCached(address)).toBeNull();
    expect(processor.isLoading(address)).toBe(false);
  });

  it('fails loudly for an ArrayBuffer requested through the font processor with a non-font extension', async () => {
    const { processor, eventBus } = setup({ 'res://images/x.png': new ArrayBuffer(4) });

    const failed = eventBus.once<Error>('font', 'failed', 'res://images/x.png', 2000);
    processor.request('res://images/x.png');

    await expect(failed).resolves.toBeInstanceOf(Error);
    expect(processor.getCached('res://images/x.png')).toBeNull();
  });

  it('shares one resource by identity across two requests for the same path', async () => {
    const { processor, eventBus } = setup({ 'res://fonts/system.tres': SYSTEM_FONT_TRES });

    const first = await (async () => {
      const loaded = eventBus.once<FontResource>('font', 'loaded', 'res://fonts/system.tres', 2000);
      processor.request('res://fonts/system.tres');
      return loaded;
    })();
    const again = eventBus.once<FontResource>('font', 'loaded', 'res://fonts/system.tres', 2000);
    processor.request('res://fonts/system.tres');

    expect(await again).toBe(first);
  });

  it('fails loudly (never silently ignores) a non-font, non-.tres text file requested through it', async () => {
    // shouldProcess accepts every loaded file — see createFontProcessor's
    // docstring for why a `.gd` script gets the SAME treatment as a
    // sub-resource address into a `.tscn`: `buildFontResource` is the one
    // place that must decide, and it decides by trying to parse and
    // throwing, never by silently declining and leaving the address
    // `inflight` forever.
    const { processor, eventBus } = setup({ 'res://scripts/thing.gd': 'extends Node\n' });

    const failed = eventBus.once<Error>('font', 'failed', 'res://scripts/thing.gd', 2000);
    processor.request('res://scripts/thing.gd');

    await expect(failed).resolves.toBeInstanceOf(Error);
    expect(processor.getCached('res://scripts/thing.gd')).toBeNull();
    expect(processor.isLoading('res://scripts/thing.gd')).toBe(false);
  });
});
