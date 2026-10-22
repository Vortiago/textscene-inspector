import { describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react';
import type { ParsedResource } from '../parser/parsedResource';
import { MissingResourcesProvider, useMissingResources } from '../r3f/contexts/MissingResourcesContext';
import { ResourceLoaderProvider } from './ResourceLoaderContext';
import type { LoadedFile } from './scopedResource';
import { createFakeResourceLoader, type FakeResourceLoader } from './testing/createFakeResourceLoader';
import { useLoadedFiles } from './useLoadedFiles';

const OUTER = 'res://outer.tres';
const INNER = 'res://inner.tres';
const FILE: ParsedResource = { resourceType: 'Resource', properties: {}, extResources: [], subResources: [] };

/** A plan that names `OUTER`, and `INNER` once `OUTER` has loaded: a mesh file that names a curve file. */
const NESTED_PLAN = (loadedFile: LoadedFile) => [OUTER, ...(loadedFile(OUTER) ? [INNER] : [])];

function renderFiles(plan: (loadedFile: LoadedFile) => readonly string[], fake: FakeResourceLoader) {
  return renderHook(() => ({ files: useLoadedFiles(plan), missing: useMissingResources().missingPaths }), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <MissingResourcesProvider>
        <ResourceLoaderProvider loader={fake.loader}>{children}</ResourceLoaderProvider>
      </MissingResourcesProvider>
    ),
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

    renderFiles(NESTED_PLAN, fake);

    expect(fake.resources.pinCounts.get(OUTER)).toBe(1);
  });

  it('reports a file that failed as missing, and stops loading', () => {
    const { fake } = fakeRequesting();
    const result = renderFiles(() => [OUTER], fake);

    act(() => fake.resources._fail(OUTER, 'gone'));

    expect(result.current.files.isLoading).toBe(false);
    expect(result.current.missing.has(OUTER)).toBe(true);
  });

  it('is not loading, and requests nothing, for a plan that names no file (edge case)', () => {
    const { fake, request } = fakeRequesting();

    const result = renderFiles(() => [], fake);

    expect(result.current.files.isLoading).toBe(false);
    expect(request).not.toHaveBeenCalled();
  });
});
