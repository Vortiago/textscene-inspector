import { describe, it, expect } from 'vitest';
import { parseTresFile } from '../../../parser/parsedResource';
import { buildFontResource, fontResourceFromContainer } from './loadFont';
import type { FontLoaderFn, FontResource } from './types';

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

describe('buildFontResource', () => {
  it('decodes the addressed section and resolves its fallbacks', async () => {
    const base: FontResource = {
      kind: 'file',
      bytes: new ArrayBuffer(1),
      mimeType: 'font/otf',
      fallbacks: [],
      properties: {},
    };
    const loadFont: FontLoaderFn = async (address) =>
      address === 'res://theme/fonts/montserrat_extra_bold.otf' ? base : null;

    const resource = await buildFontResource(
      'res://theme/fonts/montserrat_16.tres',
      parseTresFile(MONTSERRAT_TRES),
      loadFont
    );

    expect(resource.kind).toBe('file');
    expect((resource as { fallbacks: FontResource[] }).fallbacks).toEqual([base]);
  });
});

describe('fontResourceFromContainer', () => {
  it('wraps the bytes of a raw font file', () => {
    const bytes = new ArrayBuffer(2);
    const resource = fontResourceFromContainer('res://fonts/Xolonium-Regular.ttf', bytes);
    expect(resource).toEqual({ kind: 'file', bytes, mimeType: 'font/ttf', fallbacks: [], properties: {} });
  });

  it('throws for a sub-resource id on a raw font file, which holds no named resources', () => {
    expect(() => fontResourceFromContainer('res://fonts/x.ttf::SomeId', new ArrayBuffer(2))).toThrow(
      'Not a recognised font file extension'
    );
  });

  it('throws for bytes whose path has no recognised font extension', () => {
    expect(() => fontResourceFromContainer('res://images/x.png', new ArrayBuffer(2))).toThrow(
      'Not a recognised font file extension: res://images/x.png'
    );
  });
});
