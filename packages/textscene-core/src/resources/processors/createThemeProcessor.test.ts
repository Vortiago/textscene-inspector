/**
 * The theme processor on the corpus shapes: a Theme .tres carrying a
 * `default_font`, and a font ref into a separate file resolved through the
 * injected `loadFont`.
 */
import { describe, expect, it, vi } from 'vitest';
import { FileEventBus } from '../FileEventBus';
import { ResourceEventBus } from '../ResourceEventBus';
import type { ResourceProvider } from '../ResourceProvider';
import { createThemeProcessor } from './createThemeProcessor';
import type { ThemeResource } from '../styles/theme/types';
import type { FontLoaderFn, FontResource } from '../fonts/font/types';

/** Shaped like scenes/demos/gui/ui_mirroring/ui_mirroring.tscn's inline Theme (here as a standalone file). */
const THEME_TRES = [
  '[gd_resource type="Theme" load_steps=2 format=3]',
  '',
  '[ext_resource type="FontFile" path="res://fonts/base.ttf" id="1"]',
  '',
  '[resource]',
  'default_font = ExtResource("1")',
  'default_font_size = 20',
  'Label/font_sizes/font_size = 24',
  '',
].join('\n');

class MapProvider implements ResourceProvider {
  constructor(private files: Map<string, string | ArrayBuffer>) {}
  loadResource = vi.fn(async (path: string): Promise<string | ArrayBuffer | null> => {
    return this.files.get(path) ?? null;
  });
}

function setup(files: Record<string, string | ArrayBuffer>, loadFont: FontLoaderFn = async () => null) {
  const provider = new MapProvider(new Map(Object.entries(files)));
  const eventBus = new ResourceEventBus();
  const processor = createThemeProcessor(new FileEventBus(provider), eventBus, loadFont);
  return { provider, eventBus, processor };
}

describe('createThemeProcessor', () => {
  it('resolves default_font through the injected loadFont and decodes default_font_size', async () => {
    const font: FontResource = { kind: 'file', bytes: new ArrayBuffer(1), mimeType: 'font/ttf', fallbacks: [], properties: {} };
    const loadFont: FontLoaderFn = vi.fn(async (address) => (address === 'res://fonts/base.ttf' ? font : null));
    const { processor, eventBus } = setup({ 'res://theme.tres': THEME_TRES }, loadFont);

    const loaded = eventBus.once<ThemeResource>('theme', 'loaded', 'res://theme.tres', 2000);
    processor.request('res://theme.tres');
    const resource = await loaded;

    expect(loadFont).toHaveBeenCalledWith('res://fonts/base.ttf');
    expect(resource.defaultFont).toBe(font);
    expect(resource.defaultFontSize).toBe(20);
    expect(resource.fontSizes.Label?.font_size).toBe(24);
    expect(processor.getCached('res://theme.tres')).toBe(resource);
  });

  it('addresses a Theme declared as a named sub-resource of a shared .tres', async () => {
    const multiThemeTres = [
      '[gd_resource type="Resource" load_steps=1 format=3]',
      '',
      '[sub_resource type="Theme" id="5"]',
      'default_font_size = 18',
      '',
      '[resource]',
      '',
    ].join('\n');
    const { processor, eventBus } = setup({ 'res://shared.tres': multiThemeTres });

    const address = 'res://shared.tres::5';
    const loaded = eventBus.once<ThemeResource>('theme', 'loaded', address, 2000);
    processor.request(address);
    const resource = await loaded;

    expect(resource.defaultFontSize).toBe(18);
  });

  it('emits theme:failed and caches null for a .tres whose type is not a Theme', async () => {
    const { processor, eventBus } = setup({
      'res://materials/green.tres': '[gd_resource type="StyleBoxFlat" format=3]\n\n[resource]\n',
    });

    const failed = eventBus.once<Error>('theme', 'failed', 'res://materials/green.tres', 2000);
    processor.request('res://materials/green.tres');

    await expect(failed).resolves.toBeInstanceOf(Error);
    expect(processor.getCached('res://materials/green.tres')).toBeNull();
  });

  it('fails loudly for a sub-resource address into a .tscn — the owning file is not a .tres', async () => {
    const tscn = '[gd_scene load_steps=1 format=3]\n\n[node name="Root" type="Node"]\n';
    const { processor, eventBus } = setup({ 'res://scene.tscn': tscn });

    const address = 'res://scene.tscn::Theme_1';
    const failed = eventBus.once<Error>('theme', 'failed', address, 2000);
    processor.request(address);

    await expect(failed).resolves.toBeInstanceOf(Error);
    expect(processor.getCached(address)).toBeNull();
    expect(processor.isLoading(address)).toBe(false);
  });

  it('declines an ArrayBuffer — a Theme is never raw bytes, unlike a Font', async () => {
    const { processor, eventBus } = setup({ 'res://images/x.png': new ArrayBuffer(4) });

    // shouldProcess declines (not a string), so process() never runs and the
    // request stays inflight for this processor rather than failing, like the
    // material processor's extension gate and unlike the font processor.
    const failed = eventBus.once<Error>('theme', 'failed', 'res://images/x.png', 500).catch(() => null);
    processor.request('res://images/x.png');

    expect(await failed).toBeNull();
    expect(processor.isLoading('res://images/x.png')).toBe(true);
  });

  it('shares one resource by identity across two requests for the same path', async () => {
    const { processor, eventBus } = setup({ 'res://theme.tres': THEME_TRES });

    const first = await (async () => {
      const loaded = eventBus.once<ThemeResource>('theme', 'loaded', 'res://theme.tres', 2000);
      processor.request('res://theme.tres');
      return loaded;
    })();
    const again = eventBus.once<ThemeResource>('theme', 'loaded', 'res://theme.tres', 2000);
    processor.request('res://theme.tres');

    expect(await again).toBe(first);
  });
});
