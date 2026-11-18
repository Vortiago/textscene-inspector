import { act } from 'react';
import { describe, expect, it, vi } from 'vitest';
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

vi.mock('./spatialSurface', () => {
  loads.translator += 1;
  return {
    spatialSurfaceOf: () => ({ refusal: { message: 'stub' } }),
    disposeSpatial: () => {},
    setMaterialParameters: () => {},
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
  it('loads for the first ShaderMaterial only, never for a surface with none', async () => {
    vi.spyOn(logger, 'warn').mockImplementation(() => {});

    await renderSlot(undefined);
    await renderSlot(inlineSource(RESOURCES[0]!, RESOURCES));
    expect(loads).toEqual({ translator: 0, nodesHandler: 0 });

    await renderSlot(inlineSource(RESOURCES[2]!, RESOURCES));
    expect(loads).toEqual({ translator: 1, nodesHandler: 1 });
  });
});
