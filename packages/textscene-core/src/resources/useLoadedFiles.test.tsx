import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { ParsedResource } from '../parser/parsedResource';
import { useMissingResources } from '../r3f/contexts/MissingResourcesContext';
import type { FontFileResource } from './fonts/font/types';
import type { LoadedFile } from './scopedResource';
import { createFakeResourceLoader, type FakeResourceLoader } from './testing/createFakeResourceLoader';
import { missingResourcesWrapper } from './testing/missingResourcesWrapper';
import { FONT_FILES, useCachedFiles, useLoadedFiles } from './useLoadedFiles';

const OUTER = 'res://outer.tres';
const INNER = 'res://inner.tres';
const FILE: ParsedResource = { resourceType: 'Resource', properties: {}, extResources: [], subResources: [] };

/** A plan that names `OUTER`, and `INNER` once `OUTER` has loaded: a mesh file that names a curve file. */
const NESTED_PLAN = (loadedFile: LoadedFile) => [OUTER, ...(loadedFile(OUTER) ? [INNER] : [])];

function renderFiles(plan: (loadedFile: LoadedFile) => readonly string[], fake: FakeResourceLoader) {
  return renderHook(() => ({ files: useLoadedFiles(plan), missing: useMissingResources().missingPaths }), {
    wrapper: missingResourcesWrapper(fake.loader),
  }).result;
}

function fakeRequesting() {
  const fake = createFakeResourceLoader();
  const request = vi.fn();
  fake.resources.setRequestImpl(request);
  return { fake, request };
}

describe('useLoadedFiles', () => {
  it('requests the file a plan names, and loads while it is not there', () => {
    const { fake, request } = fakeRequesting();

    const result = renderFiles(() => [OUTER], fake);

    expect(request).toHaveBeenCalledWith(OUTER);
    expect(result.current.files.isLoading).toBe(true);
    expect(result.current.files.loadedFile(OUTER)).toBeUndefined();
  });

  it('serves the file once it loads', () => {
    const { fake } = fakeRequesting();
    const result = renderFiles(() => [OUTER], fake);

    act(() => fake.resources._resolve(OUTER, FILE));

    expect(result.current.files.isLoading).toBe(false);
    expect(result.current.files.loadedFile(OUTER)).toBe(FILE);
  });

  it('requests a file the plan names only after the file before it has loaded', () => {
    const { fake, request } = fakeRequesting();
    const result = renderFiles(NESTED_PLAN, fake);
    expect(request).not.toHaveBeenCalledWith(INNER);

    act(() => fake.resources._resolve(OUTER, FILE));

    expect(request).toHaveBeenCalledWith(INNER);
    expect(result.current.files.isLoading).toBe(true);
  });

  it('keeps the lookup when a file the plan does not name loads', () => {
    const { fake } = fakeRequesting();
    const result = renderFiles(() => [OUTER], fake);
    const { loadedFile } = result.current.files;

    act(() => fake.resources._resolve('res://other.tres', FILE));

    expect(result.current.files.loadedFile).toBe(loadedFile);
  });

  it('pins each file while mounted', () => {
    const { fake } = fakeRequesting();

    renderFiles(() => [OUTER], fake);

    expect(fake.resources.pinCounts.get(OUTER)).toBe(1);
  });

  it('reports a file that failed as missing, and stops loading', () => {
    const { fake } = fakeRequesting();
    const result = renderFiles(() => [OUTER], fake);

    act(() => fake.resources._fail(OUTER, 'gone'));

    expect(result.current.files.isLoading).toBe(false);
    expect(result.current.missing.has(OUTER)).toBe(true);
  });

  it('requests and pins a file once, however often the plan names it', () => {
    const { fake, request } = fakeRequesting();

    renderFiles(() => [OUTER, OUTER], fake);

    expect(request).toHaveBeenCalledTimes(1);
    expect(fake.resources.pinCounts.get(OUTER)).toBe(1);
  });

  it('re-reads the lookup when a file the plan names loads, and not when another one does', () => {
    const { fake } = fakeRequesting();
    const result = renderFiles(() => [OUTER], fake);
    const { loadedFile } = result.current.files;

    act(() => fake.resources._resolve('res://other.tres', FILE));
    expect(result.current.files.loadedFile).toBe(loadedFile);

    act(() => fake.resources._resolve(OUTER, FILE));
    expect(result.current.files.loadedFile).not.toBe(loadedFile);
  });

  it('is not loading, and requests nothing, for a plan that names no file (edge case)', () => {
    const { fake, request } = fakeRequesting();

    const result = renderFiles(() => [], fake);

    expect(result.current.files.isLoading).toBe(false);
    expect(request).not.toHaveBeenCalled();
  });
});

describe('useCachedFiles', () => {
  const FONT_PATH = 'res://fonts/a.ttf';
  const FONT_FILE: FontFileResource = {
    kind: 'file',
    bytes: new ArrayBuffer(4),
    mimeType: 'font/ttf',
    fallbacks: [],
    properties: {},
  };

  function renderFonts(kind: typeof FONT_FILES | null, fake: FakeResourceLoader) {
    return renderHook(
      () => ({
        files: useCachedFiles(kind, () => [FONT_PATH]),
        missing: useMissingResources().missingPaths,
      }),
      { wrapper: missingResourcesWrapper(fake.loader) }
    ).result;
  }

  it('requests a font file on the font bus, and loads while it is not there', () => {
    const fake = createFakeResourceLoader();
    const request = vi.fn();
    fake.fonts.setRequestImpl(request);

    const result = renderFonts(FONT_FILES, fake);

    expect(request).toHaveBeenCalledWith(FONT_PATH);
    expect(result.current.files.isLoading).toBe(true);
  });

  it('serves the font once it loads, and pins it while mounted', () => {
    const fake = createFakeResourceLoader();
    const result = renderFonts(FONT_FILES, fake);

    act(() => fake.fonts._resolve(FONT_PATH, FONT_FILE));

    expect(result.current.files.loadedFile(FONT_PATH)).toBe(FONT_FILE);
    expect(result.current.files.isLoading).toBe(false);
    expect(fake.fonts.pinCounts.get(FONT_PATH)).toBe(1);
  });

  it('reports a font that failed as missing, and stops loading', () => {
    const fake = createFakeResourceLoader();
    const result = renderFonts(FONT_FILES, fake);

    act(() => fake.fonts._fail(FONT_PATH, 'gone'));

    expect(result.current.files.isLoading).toBe(false);
    expect(result.current.missing.has(FONT_PATH)).toBe(true);
  });

  it('reads no file, listens to no bus and never loads for no kind', () => {
    const fake = createFakeResourceLoader();
    const request = vi.fn();
    fake.fonts.setRequestImpl(request);
    const onChange = vi.spyOn(fake.eventBus, 'onChange');

    const result = renderFonts(null, fake);

    expect(request).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
    expect(result.current.files.isLoading).toBe(false);
    expect(result.current.files.loadedFile(FONT_PATH)).toBeUndefined();
  });
});
