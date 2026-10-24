import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { ParsedResource } from '../parser/parsedResource';
import type { FontFileResource } from './fonts/font/types';
import type { LoadedFile, LoadedFont } from './scopedResource';
import { createFakeResourceLoader } from './testing/createFakeResourceLoader';
import { missingResourcesWrapper } from './testing/missingResourcesWrapper';
import { useLoadedFilesAndFonts } from './useLoadedFilesAndFonts';

const MESH_FILE = 'res://mesh.tres';
const FONT_FILE = 'res://font.ttf';
const PARSED: ParsedResource = {
  resourceType: 'Resource',
  properties: {},
  extResources: [],
  subResources: [],
};
const FONT: FontFileResource = {
  kind: 'file',
  bytes: new ArrayBuffer(8),
  mimeType: 'font/ttf',
  fallbacks: [],
  properties: {},
};

const filesPlan = () => [MESH_FILE];
/** Names the font file once the mesh file has loaded, as a mesh file names its font. */
const fontsPlan = (_loadedFont: LoadedFont, loadedFile: LoadedFile) =>
  loadedFile(MESH_FILE) ? [FONT_FILE] : [];

function renderBoth(readsFonts: boolean) {
  const fake = createFakeResourceLoader();
  const requestFont = vi.fn();
  fake.fonts.setRequestImpl(requestFont);
  const { result } = renderHook(() => useLoadedFilesAndFonts(filesPlan, fontsPlan, readsFonts), {
    wrapper: missingResourcesWrapper(fake.loader),
  });
  return { fake, result, requestFont };
}

describe('useLoadedFilesAndFonts', () => {
  it('requests a font the font plan names once the file it reads has loaded', () => {
    const { fake, requestFont } = renderBoth(true);
    expect(requestFont).not.toHaveBeenCalled();

    act(() => fake.resources._resolve(MESH_FILE, PARSED));

    expect(requestFont).toHaveBeenCalledWith(FONT_FILE);
  });

  it('loads until the font has loaded, and then serves both', () => {
    const { fake, result } = renderBoth(true);
    act(() => fake.resources._resolve(MESH_FILE, PARSED));
    expect(result.current.isLoading).toBe(true);

    act(() => fake.fonts._resolve(FONT_FILE, FONT));

    expect(result.current.isLoading).toBe(false);
    expect(result.current.loadedFile(MESH_FILE)).toBe(PARSED);
    expect(result.current.loadedFont(FONT_FILE)).toBe(FONT);
  });

  it('requests no font for a caller that reads none', () => {
    const { fake, requestFont } = renderBoth(false);

    act(() => fake.resources._resolve(MESH_FILE, PARSED));

    expect(requestFont).not.toHaveBeenCalled();
  });
});
