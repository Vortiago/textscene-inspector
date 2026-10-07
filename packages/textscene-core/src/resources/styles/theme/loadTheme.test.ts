import { describe, it, expect, vi } from 'vitest';
import { parseTresFile } from '../../../parser/parsedResource';
import { buildThemeResource, resolveThemeResource } from './loadTheme';
import type { ThemeAddresses } from './types';
import type { FontLoaderFn, FontResource } from '../../fonts/font/types';

const NO_OP_LOADER: FontLoaderFn = async () => null;

const FONT_A: FontResource = {
  kind: 'file',
  bytes: new ArrayBuffer(1),
  mimeType: 'font/ttf',
  fallbacks: [],
  properties: {},
};
const FONT_B: FontResource = {
  kind: 'file',
  bytes: new ArrayBuffer(1),
  mimeType: 'font/otf',
  fallbacks: [],
  properties: {},
};

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

describe('resolveThemeResource', () => {
  it('carries icons through unresolved, same as styles', async () => {
    const addresses: ThemeAddresses = {
      defaultFont: null,
      defaultFontSize: undefined,
      fonts: {},
      fontSizes: {},
      styles: {},
      icons: { CheckBox: { checked: 'ExtResource("1")' } },
      colors: {},
      constants: {},
      typeVariations: {},
      properties: {},
      resources: { externalResources: [], internalResources: [] },
    };
    const resource = await resolveThemeResource(addresses, NO_OP_LOADER);
    expect(resource.icons?.CheckBox?.checked).toBe('ExtResource("1")');
  });

  it('resolves default_font and every <Type>/fonts/<name> address through loadFont', async () => {
    const loadFont = vi.fn(async (address: string) =>
      address === 'res://fonts/default.ttf' ? FONT_A : address === 'res://fonts/label.ttf' ? FONT_B : null
    );
    const addresses: ThemeAddresses = {
      defaultFont: 'res://fonts/default.ttf',
      defaultFontSize: 20,
      fonts: { Label: { font: 'res://fonts/label.ttf' } },
      fontSizes: { Label: { font_size: 24 } },
      styles: {},
      colors: {},
      constants: {},
      typeVariations: {},
      properties: {},
      resources: { externalResources: [], internalResources: [] },
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
      styles: {},
      colors: {},
      constants: {},
      typeVariations: {},
      properties: {},
      resources: { externalResources: [], internalResources: [] },
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
      styles: {},
      colors: {},
      constants: {},
      typeVariations: {},
      properties: {},
      resources: { externalResources: [], internalResources: [] },
    };
    const resource = await resolveThemeResource(addresses, NO_OP_LOADER);
    expect(resource.defaultFont).toBeNull();
  });
});

describe('buildThemeResource', () => {
  it('decodes the addressed section and resolves its fonts', async () => {
    const loadFont: FontLoaderFn = async (address) => (address === 'res://fonts/base.ttf' ? FONT_A : null);
    const resource = await buildThemeResource('res://theme.tres', parseTresFile(THEME_TRES), loadFont);
    expect(resource.defaultFont).toBe(FONT_A);
    expect(resource.defaultFontSize).toBe(20);
    expect(resource.fonts.Label?.font).toBe(FONT_A);
    expect(resource.typeVariations.title_panel).toBe('Panel');
    expect(resource.styles?.Panel?.panel).toBe('null');
  });
});
