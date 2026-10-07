import { describe, it, expect } from 'vitest';
import { sectionLoaderServing } from '../../testing/sectionLoaderServing';
import { FONT_SUB_RESOURCE_TYPES } from './decode';
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

    const path = 'res://theme/fonts/montserrat_16.tres';
    const section = await sectionLoaderServing({ [path]: MONTSERRAT_TRES })(path, FONT_SUB_RESOURCE_TYPES);
    const resource = await buildFontResource(path, section, loadFont);

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

  it('throws for text at a container path, which holds no font bytes', () => {
    expect(() => fontResourceFromContainer('res://fonts/x.ttf', 'not a font')).toThrow(
      'res://fonts/x.ttf is text, not font bytes'
    );
  });
});
