import { describe, it, expect } from 'vitest';
import { buildFontResource, createFontResourceFromContent } from './loadFont';
import type { FontLoaderFn, FontResource } from './types';

/** A loader that never resolves anything — for cases with no Font-valued property to recurse into. */
const NO_OP_LOADER: FontLoaderFn = async () => null;

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
