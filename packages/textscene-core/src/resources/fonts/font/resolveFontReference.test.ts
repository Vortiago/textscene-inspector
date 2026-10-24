import { describe, expect, it } from 'vitest';
import type { SceneResources } from '../../../r3f/SceneResourcesContext';
import { resolveFontReference } from './resolveFontReference';
import type { FontFileResource, FontResource } from './types';

const FONT_PATH = 'res://fonts/a.ttf';
const BASE_PATH = 'res://fonts/base.ttf';

const FONT_FILE: FontFileResource = {
  kind: 'file',
  bytes: new ArrayBuffer(4),
  mimeType: 'font/ttf',
  fallbacks: [],
  properties: {},
};

const RESOURCES: SceneResources = {
  externalResources: [
    { id: 'a', path: FONT_PATH, type: 'FontFile' },
    { id: 'base', path: BASE_PATH, type: 'FontFile' },
  ],
  internalResources: [{ id: 'v', type: 'FontVariation', data: { base_font: 'ExtResource("base")' } }],
};

const nothingLoaded = () => undefined;

describe('resolveFontReference', () => {
  it('names the font file an ExtResource names, and finds no font while it is not loaded', () => {
    expect(resolveFontReference('ExtResource("a")', RESOURCES, nothingLoaded)).toEqual({
      font: null,
      paths: [FONT_PATH],
    });
  });

  it('serves the font once it is loaded', () => {
    const { font, paths } = resolveFontReference('ExtResource("a")', RESOURCES, () => FONT_FILE);

    expect(font).toBe(FONT_FILE);
    expect(paths).toEqual([FONT_PATH]);
  });

  it('names the base font a FontVariation of the scene names, and serves the variation over it', () => {
    const loaded = (path: string): FontResource | undefined => (path === BASE_PATH ? FONT_FILE : undefined);

    const { font, paths } = resolveFontReference('SubResource("v")', RESOURCES, loaded);

    expect(paths).toEqual([BASE_PATH]);
    expect(font).toMatchObject({ kind: 'variation', baseFont: FONT_FILE });
  });

  it('names no file and finds no font when the property names none', () => {
    expect(resolveFontReference(undefined, RESOURCES, nothingLoaded)).toEqual({ font: null, paths: [] });
  });
});
