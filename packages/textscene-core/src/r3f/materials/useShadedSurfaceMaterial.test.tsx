import type { ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { TscnExternalResource } from '../../parser/types';
import type { ScopedReference } from '../../resources/reading';
import { ResourceLoaderProvider } from '../../resources/ResourceLoaderContext';
import { createFakeResourceLoader } from '../../resources/testing/createFakeResourceLoader';
import { fileMaterial } from './materialReference';
import { inlineMaterial } from './surfaceMaterial.testkit';
import { useShadedSurfaceMaterial } from './useSurfaceMaterial';

vi.mock('../litSurface/litSurfaceForm', () => ({ litSurfaceForm: () => 'nodes' }));

const ALBEDO_PATH = 'res://albedo.png';
const EXTERNAL: TscnExternalResource[] = [{ id: '1_albedo', type: 'Texture2D', path: ALBEDO_PATH }];
const SOURCE = inlineMaterial({ albedo_texture: 'ExtResource("1_albedo")' }, [], EXTERNAL);

function renderShaded(source: ScopedReference = SOURCE) {
  const fake = createFakeResourceLoader();
  const hook = renderHook(() => useShadedSurfaceMaterial(source), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <ResourceLoaderProvider loader={fake.loader}>{children}</ResourceLoaderProvider>
    ),
  });
  return { ...hook, textures: fake.textures, resources: fake.resources };
}

describe('a StandardMaterial3D on the node lit surface', () => {
  it('draws through its shader while its texture loads', () => {
    const { result } = renderShaded();

    expect(result.current.shaded).toMatchObject({ baseMaterial: { materialClass: 'StandardMaterial3D' } });
  });

  it('keeps the missing-texture placeholder once its texture fails', () => {
    const { result, textures } = renderShaded();
    act(() => textures._fail(ALBEDO_PATH, 'not found'));

    expect(result.current.shaded).toBeNull();
  });
});

describe('a material file on the node lit surface', () => {
  const MATERIAL_PATH = 'res://paint.tres';

  it('draws nothing in place of the surface while the file loads', () => {
    const { result } = renderShaded(fileMaterial(MATERIAL_PATH));

    expect(result.current.shaded).toBeNull();
  });

  it("draws Godot's default material once the file fails", () => {
    const { result, resources } = renderShaded(fileMaterial(MATERIAL_PATH));
    act(() => resources._fail(MATERIAL_PATH, 'not found'));

    expect(result.current.shaded).toMatchObject({ shader: { file: 'the default 3D material' } });
  });
});
