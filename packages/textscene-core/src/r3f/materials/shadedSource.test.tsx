import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as logger from '../../logger';
import type { TscnInternalResource } from '../../parser/types';
import type { ScopedReference } from '../../resources/reading';
import { ResourceLoaderProvider } from '../../resources/ResourceLoaderContext';
import { createFakeResourceLoader } from '../../resources/testing/createFakeResourceLoader';
import { SceneResourcesProvider } from '../SceneResourcesContext';
import * as spatialSurface from '../spatialShader/spatialSurface';
import { inlineSource } from './surfaceMaterial.testkit';
import { SurfaceMaterialSlot } from './SurfaceMaterialSlot';

const page = vi.hoisted(() => ({ form: 'patched' as 'patched' | 'nodes' }));

vi.mock('../litSurface/litSurfaceForm', () => ({ litSurfaceForm: () => page.form }));

vi.mock('../spatialShader/spatialSurface', () => ({
  surfaceShaderOf: vi.fn(() => ({ code: '', file: '', textures: {}, parametersWith: () => ({}) })),
  spatialSurfaceOf: () => ({ refusal: { message: 'stub' } }),
  disposeSpatial: () => {},
  setParameterValues: () => {},
  withGodotSurface: () => {},
}));

vi.mock('../../shaders/nodesHandler.js', () => ({ installNodesHandler: () => {} }));

const RESOURCES: TscnInternalResource[] = [
  { id: 'Paint', type: 'StandardMaterial3D', data: { albedo_color: 'Color(1, 0, 0, 1)' } },
  { id: 'Orm', type: 'ORMMaterial3D', data: { roughness: '0.5' } },
];

async function renderSlot(source: ScopedReference | undefined) {
  const fake = createFakeResourceLoader();
  await ReactThreeTestRenderer.create(
    <ResourceLoaderProvider loader={fake.loader}>
      <SceneResourcesProvider internalResources={RESOURCES} externalResources={[]}>
        <mesh>
          <boxGeometry />
          <SurfaceMaterialSlot source={source} drawnOn="mesh" />
        </mesh>
      </SceneResourcesProvider>
    </ResourceLoaderProvider>
  );
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

const surfaceShaderOf = vi.mocked(spatialSurface.surfaceShaderOf);

describe('the shader a mesh surface draws', () => {
  afterEach(() => {
    page.form = 'patched';
    surfaceShaderOf.mockClear();
  });

  it('draws a StandardMaterial3D through its shader on the node lit surface', async () => {
    vi.spyOn(logger, 'warn').mockImplementation(() => {});
    page.form = 'nodes';

    await renderSlot(inlineSource(RESOURCES[0]!, RESOURCES));

    expect(surfaceShaderOf).toHaveBeenCalledWith({
      baseMaterial: expect.objectContaining({ properties: { albedo_color: 'Color(1, 0, 0, 1)' } }),
    });
  });

  it('draws no ORMMaterial3D through a shader on the patched lit surface', async () => {
    vi.spyOn(logger, 'warn').mockImplementation(() => {});

    await renderSlot(inlineSource(RESOURCES[1]!, RESOURCES));

    expect(surfaceShaderOf).not.toHaveBeenCalled();
  });

  it('draws an ORMMaterial3D through its shader on the node lit surface', async () => {
    vi.spyOn(logger, 'warn').mockImplementation(() => {});
    page.form = 'nodes';

    await renderSlot(inlineSource(RESOURCES[1]!, RESOURCES));

    expect(surfaceShaderOf).toHaveBeenCalledWith({
      baseMaterial: { materialClass: 'ORMMaterial3D', properties: { roughness: '0.5' }, resources: {} },
    });
  });

  it("draws Godot's default material through its default shader on the node lit surface", async () => {
    vi.spyOn(logger, 'warn').mockImplementation(() => {});
    page.form = 'nodes';

    await renderSlot(undefined);

    expect(surfaceShaderOf).toHaveBeenCalledWith({
      shader: expect.objectContaining({ code: expect.stringContaining('ALBEDO = vec3(0.6);') }),
    });
  });
});
