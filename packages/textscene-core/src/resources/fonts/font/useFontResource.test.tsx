import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useMissingResources } from '../../../r3f/contexts/MissingResourcesContext';
import type { SceneResources } from '../../../r3f/SceneResourcesContext';
import { createFakeResourceLoader } from '../../testing/createFakeResourceLoader';
import { missingResourcesWrapper } from '../../testing/missingResourcesWrapper';
import type { FontFileResource, FontResource } from './types';
import { useFontResource } from './useFontResource';

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

function renderFont(ref: string | undefined) {
  const fake = createFakeResourceLoader();
  const request = vi.fn();
  fake.fonts.setRequestImpl(request);
  const { result } = renderHook(
    () => ({ load: useFontResource(ref, RESOURCES), missing: useMissingResources().missingPaths }),
    { wrapper: missingResourcesWrapper(fake.loader) }
  );
  return { fake, request, result };
}

describe('useFontResource', () => {
  it('requests the font file an ExtResource names, and loads while it is not there', () => {
    const { request, result } = renderFont('ExtResource("a")');

    expect(request).toHaveBeenCalledWith(FONT_PATH);
    expect(result.current.load).toEqual({ font: null, isLoading: true });
  });

  it('serves the font once it loads', () => {
    const { fake, result } = renderFont('ExtResource("a")');

    act(() => fake.fonts._resolve(FONT_PATH, FONT_FILE));

    expect(result.current.load).toEqual({ font: FONT_FILE, isLoading: false });
  });

  it('requests the base font a FontVariation of the scene names, and serves the variation over it', () => {
    const { fake, request, result } = renderFont('SubResource("v")');
    expect(request).toHaveBeenCalledWith(BASE_PATH);

    act(() => fake.fonts._resolve(BASE_PATH, FONT_FILE));

    const font = result.current.load.font as FontResource;
    expect(font).toMatchObject({ kind: 'variation', baseFont: FONT_FILE });
    expect(result.current.load.isLoading).toBe(false);
  });

  it('asks for nothing and does not load when the property names no font', () => {
    const { request, result } = renderFont(undefined);

    expect(request).not.toHaveBeenCalled();
    expect(result.current.load).toEqual({ font: null, isLoading: false });
  });

  it('pins the font while mounted', () => {
    const { fake } = renderFont('ExtResource("a")');

    expect(fake.fonts.pinCounts.get(FONT_PATH)).toBe(1);
  });

  it('reports a font that failed as missing, and stops loading', () => {
    const { fake, result } = renderFont('ExtResource("a")');

    act(() => fake.fonts._fail(FONT_PATH, 'gone'));

    expect(result.current.load).toEqual({ font: null, isLoading: false });
    expect(result.current.missing.has(FONT_PATH)).toBe(true);
  });
});
