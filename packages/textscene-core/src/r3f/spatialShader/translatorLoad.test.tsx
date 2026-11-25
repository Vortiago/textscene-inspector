import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as logger from '../../logger';
import type { TscnInternalResource } from '../../parser/types';
import type { ScopedReference } from '../../resources/reading';
import { ResourceLoaderProvider } from '../../resources/ResourceLoaderContext';
import { createFakeResourceLoader } from '../../resources/testing/createFakeResourceLoader';
import { SceneResourcesProvider } from '../SceneResourcesContext';
import { inlineSource } from '../materials/surfaceMaterial.testkit';
import { SurfaceMaterialSlot } from '../materials/SurfaceMaterialSlot';

const loads = vi.hoisted(() => ({ translator: 0, nodesHandler: 0 }));
const page = vi.hoisted(() => ({ form: 'patched' as 'patched' | 'nodes' }));

vi.mock('../litSurface/litSurfaceForm', () => ({ litSurfaceForm: () => page.form }));

vi.mock('./spatialSurface', () => {
  loads.translator += 1;
  return {
    surfaceShaderOf: () => ({ code: '', file: '', textures: {}, parametersWith: () => ({}) }),
    spatialSurfaceOf: () => ({ refusal: { message: 'stub' } }),
    disposeSpatial: () => {},
    setParameterValues: () => {},
    withGodotSurface: () => {},
  };
});

vi.mock('../../shaders/nodesHandler.js', () => {
  loads.nodesHandler += 1;
  return { installNodesHandler: () => {} };
});

const RESOURCES: TscnInternalResource[] = [
  { id: 'Paint', type: 'StandardMaterial3D', data: { albedo_color: 'Color(1, 0, 0, 1)' } },
  {
    id: 'Code',
    type: 'Shader',
    data: { code: JSON.stringify('shader_type spatial;\nrender_mode unshaded;\n') },
  },
  { id: 'Shaded', type: 'ShaderMaterial', data: { shader: 'SubResource("Code")' } },
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

describe('the spatial shader translator', () => {
  afterEach(() => {
    page.form = 'patched';
  });

  it('loads for the first ShaderMaterial only, never for a surface with none', async () => {
    vi.spyOn(logger, 'warn').mockImplementation(() => {});

    await renderSlot(undefined);
    await renderSlot(inlineSource(RESOURCES[0]!, RESOURCES));
    expect(loads).toEqual({ translator: 0, nodesHandler: 0 });

    await renderSlot(inlineSource(RESOURCES[2]!, RESOURCES));
    expect(loads).toEqual({ translator: 1, nodesHandler: 1 });
  });

  it('draws a StandardMaterial3D through its shader on the node lit surface', async () => {
    vi.spyOn(logger, 'warn').mockImplementation(() => {});
    const surfaceShaderOf = vi.spyOn(await import('./spatialSurface'), 'surfaceShaderOf');
    page.form = 'nodes';

    await renderSlot(inlineSource(RESOURCES[0]!, RESOURCES));

    expect(surfaceShaderOf).toHaveBeenCalledWith({
      baseMaterial: expect.objectContaining({ properties: { albedo_color: 'Color(1, 0, 0, 1)' } }),
    });
  });

  it('draws an ORMMaterial3D through its shader on the node lit surface only', async () => {
    vi.spyOn(logger, 'warn').mockImplementation(() => {});
    const surfaceShaderOf = vi.spyOn(await import('./spatialSurface'), 'surfaceShaderOf');
    const orm = inlineSource(RESOURCES[3]!, RESOURCES);

    await renderSlot(orm);
    expect(surfaceShaderOf).not.toHaveBeenCalled();

    page.form = 'nodes';
    await renderSlot(orm);
    expect(surfaceShaderOf).toHaveBeenCalledWith({
      baseMaterial: { materialClass: 'ORMMaterial3D', properties: { roughness: '0.5' }, resources: {} },
    });
  });

  it("draws Godot's default material through its default shader on the node lit surface", async () => {
    vi.spyOn(logger, 'warn').mockImplementation(() => {});
    const surfaceShaderOf = vi.spyOn(await import('./spatialSurface'), 'surfaceShaderOf');
    page.form = 'nodes';

    await renderSlot(undefined);

    expect(surfaceShaderOf).toHaveBeenCalledWith({
      shader: expect.objectContaining({ code: expect.stringContaining('ALBEDO = vec3(0.6);') }),
    });
  });
});
