import { describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { parseTresFile } from '../../parser/parsedResource';
import { notifySceneFontSettled } from '../../r3f/controls/native/text/settledChannel';
import { NO_RESOURCES } from '../../r3f/SceneResourcesContext';
import type { ScopedResource } from '../scopedResource';
import { createFakeResourceLoader } from '../testing/createFakeResourceLoader';
import { missingResourcesWrapper } from '../testing/missingResourcesWrapper';
import { COARSE_TUBE, curveEndingAt } from './primitivemesh/surface.testkit';
import { FONT_PATH, textMeshWith, trueTypeFontFile } from './textmesh/textMeshFont.testkit';
import { useResolvableMesh } from './useResolvableMesh';

const CURVE_PATH = 'res://grow.tres';
const CURVE_FILE = parseTresFile(
  `[gd_resource type="Curve" format=3]\n\n[resource]\n_data = ${curveEndingAt('3')._data}\n`
);

const TUBE: ScopedResource = {
  resource: { id: 'tube', type: 'TubeTrailMesh', data: { ...COARSE_TUBE, curve: 'ExtResource("1")' } },
  resources: { ...NO_RESOURCES, externalResources: [{ id: '1', type: 'Curve', path: CURVE_PATH }] },
};
const BOX: ScopedResource = {
  resource: { id: 'box', type: 'BoxMesh', data: {} },
  resources: NO_RESOURCES,
};

function renderMesh(scoped: ScopedResource | null) {
  const fake = createFakeResourceLoader();
  const result = renderHook(() => useResolvableMesh(scoped), {
    wrapper: missingResourcesWrapper(fake.loader),
  }).result;
  return { fake, result };
}

describe('useResolvableMesh', () => {
  it('is no mesh while the Curve file of a TubeTrailMesh loads, then serves it', () => {
    const { fake, result } = renderMesh(TUBE);
    expect(result.current).toEqual({ mesh: null, isLoading: true });

    act(() => fake.resources._resolve(CURVE_PATH, CURVE_FILE));

    expect(result.current.isLoading).toBe(false);
    expect(result.current.mesh!.loadedFile(CURVE_PATH)).toBe(CURVE_FILE);
  });

  it('keeps the mesh and its tables as given', () => {
    const { fake, result } = renderMesh(TUBE);
    act(() => fake.resources._resolve(CURVE_PATH, CURVE_FILE));

    expect(result.current.mesh).toMatchObject(TUBE);
  });

  it('is not loading for a mesh that reads no file', () => {
    const { result } = renderMesh(BOX);

    expect(result.current.isLoading).toBe(false);
  });

  it('is no mesh, and not loading, for none', () => {
    const { result } = renderMesh(null);

    expect(result.current).toEqual({ mesh: null, isLoading: false });
  });
});

describe('useResolvableMesh for a TextMesh', () => {
  const TEXT = textMeshWith();
  const textScoped: ScopedResource = { resource: TEXT.resource, resources: TEXT.resources };

  it('requests the font file, and is no mesh while it loads', () => {
    const fake = createFakeResourceLoader();
    const request = vi.fn();
    fake.fonts.setRequestImpl(request);
    const { result } = renderHook(() => useResolvableMesh(textScoped), {
      wrapper: missingResourcesWrapper(fake.loader),
    });

    expect(request).toHaveBeenCalledWith(FONT_PATH);
    expect(result.current).toEqual({ mesh: null, isLoading: true });
  });

  it('is no mesh while the metrics of the loaded font settle, then serves the mesh with its font', async () => {
    const fake = createFakeResourceLoader();
    const { result } = renderHook(() => useResolvableMesh(textScoped), {
      wrapper: missingResourcesWrapper(fake.loader),
    });
    const font = trueTypeFontFile();

    act(() => fake.fonts._resolve(FONT_PATH, font));
    expect(result.current).toEqual({ mesh: null, isLoading: true });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.mesh!.loadedFont(FONT_PATH)).toBe(font);
  });

  it('serves the mesh with the bundled font, once it has settled, for a font that failed to load', async () => {
    const fake = createFakeResourceLoader();
    const { result } = renderHook(() => useResolvableMesh(textScoped), {
      wrapper: missingResourcesWrapper(fake.loader),
    });

    act(() => fake.fonts._fail(FONT_PATH, 'gone'));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.mesh!.loadedFont(FONT_PATH)).toBeUndefined();
  });
});

describe('useResolvableMesh and the metrics of a font that settle', () => {
  function renderCounting(scoped: ScopedResource, fake = createFakeResourceLoader()) {
    let renders = 0;
    const { result } = renderHook(
      () => {
        renders += 1;
        return useResolvableMesh(scoped);
      },
      { wrapper: missingResourcesWrapper(fake.loader) }
    );
    return { fake, result, renders: () => renders };
  }

  it('does not render again for a mesh that reads no font', () => {
    const { renders } = renderCounting(BOX);
    const before = renders();

    act(() => notifySceneFontSettled());

    expect(renders()).toBe(before);
  });

  it('does not render again for a TextMesh whose font has no outlines the reader opens', async () => {
    const text = textMeshWith();
    const { fake, result, renders } = renderCounting({ resource: text.resource, resources: text.resources });
    act(() => fake.fonts._resolve(FONT_PATH, { ...trueTypeFontFile(), bytes: new ArrayBuffer(8) }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    const before = renders();

    act(() => notifySceneFontSettled());

    expect(renders()).toBe(before);
  });

  it('does not render again for a TextMesh whose metrics have settled', async () => {
    const text = textMeshWith();
    const { fake, result, renders } = renderCounting({ resource: text.resource, resources: text.resources });
    act(() => fake.fonts._resolve(FONT_PATH, trueTypeFontFile()));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    const before = renders();

    act(() => notifySceneFontSettled());

    expect(renders()).toBe(before);
  });

  it('listens to no font bus for a mesh that reads no font', () => {
    const fake = createFakeResourceLoader();
    const onChange = vi.spyOn(fake.eventBus, 'onChange');

    renderCounting(BOX, fake);

    expect(onChange.mock.calls.map(([busTypes]) => busTypes)).not.toContainEqual(['font']);
  });
});
