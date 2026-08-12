import { describe, it, expect, vi } from 'vitest';
import { buildThemeResource, createThemeResourceFromContent, resolveThemeResource } from './loadTheme';
import type { ThemeAddresses } from './types';
import type { FontLoaderFn, FontResource } from '../../fonts/font/types';

const NO_OP_LOADER: FontLoaderFn = async () => null;

const FONT_A: FontResource = { kind: 'file', bytes: new ArrayBuffer(1), mimeType: 'font/ttf', fallbacks: [], properties: {} };
const FONT_B: FontResource = { kind: 'file', bytes: new ArrayBuffer(1), mimeType: 'font/otf', fallbacks: [], properties: {} };

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
