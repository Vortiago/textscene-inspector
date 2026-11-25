import { act } from 'react';
import * as THREE from 'three';
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
import { FadedSurfacesContext, type FadedSurface, type FadedSurfaces } from './swappedMaterials';
import type { ListedSurface } from './godotPoint';

const page = vi.hoisted(() => ({ form: 'patched' as 'patched' | 'nodes' }));
const translated = vi.hoisted(() => ({ surface: null as unknown }));

vi.mock('../litSurface/litSurfaceForm', () => ({ litSurfaceForm: () => page.form }));

vi.mock('../spatialShader/spatialSurface', () => ({
  surfaceShaderOf: vi.fn(() => ({
    code: '',
    file: '',
    textures: {},
    albedoTexture: null,
    parametersWith: () => ({}),
  })),
  spatialSurfaceOf: () => translated.surface ?? { refusal: { message: 'stub' } },
  disposeSpatial: () => {},
  setParameterValues: () => {},
  withGodotSurface: () => {},
}));

vi.mock('../../shaders/nodesHandler.js', () => ({ installNodesHandler: () => {} }));

const RESOURCES: TscnInternalResource[] = [
  { id: 'Paint', type: 'StandardMaterial3D', data: { albedo_color: 'Color(1, 0, 0, 1)' } },
  { id: 'Orm', type: 'ORMMaterial3D', data: { roughness: '0.5' } },
];

async function renderSlot(
  source: ScopedReference | undefined,
  listed?: ListedSurface,
  surfaces?: FadedSurfaces
) {
  const fake = createFakeResourceLoader();
  const renderer = await ReactThreeTestRenderer.create(
    <ResourceLoaderProvider loader={fake.loader}>
      <SceneResourcesProvider internalResources={RESOURCES} externalResources={[]}>
        <FadedSurfacesContext.Provider value={surfaces ?? null}>
          <mesh>
            <boxGeometry />
            <SurfaceMaterialSlot source={source} listed={listed} drawnOn="mesh" />
          </mesh>
        </FadedSurfacesContext.Provider>
      </SceneResourcesProvider>
    </ResourceLoaderProvider>
  );
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  return renderer.scene.children[0]!.instance as THREE.Mesh;
}

const surfaceShaderOf = vi.mocked(spatialSurface.surfaceShaderOf);

describe('the shader a mesh surface draws', () => {
  afterEach(() => {
    page.form = 'patched';
    translated.surface = null;
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
      baseMaterial: {
        materialClass: 'ORMMaterial3D',
        address: null,
        properties: { roughness: '0.5' },
        resources: {},
      },
    });
  });

  it("draws Godot's default material through its default shader on the node lit surface", async () => {
    vi.spyOn(logger, 'warn').mockImplementation(() => {});
    page.form = 'nodes';

    await renderSlot(undefined);

    expect(surfaceShaderOf).toHaveBeenCalledWith({
      defaultMaterial: expect.objectContaining({ code: expect.stringContaining('ALBEDO = vec3(0.6);') }),
    });
  });

  it('draws a StandardMaterial3D on points or lines as the classic material on the node lit surface', async () => {
    page.form = 'nodes';

    await renderSlot(inlineSource(RESOURCES[0]!, RESOURCES), { primitive: 'points', placement: 'mesh' });

    expect(surfaceShaderOf).not.toHaveBeenCalled();
  });

  it("swaps a StandardMaterial3D's classic alpha-pass variant in under a geometry instance's fade", async () => {
    page.form = 'nodes';
    const material = new THREE.MeshBasicMaterial();
    translated.surface = { spatial: { material, parameters: {}, pointDraw: null }, samplers: {} };
    const added: FadedSurface[] = [];
    const surfaces = { add: (surface: FadedSurface) => (added.push(surface), () => {}) };

    const mesh = await renderSlot(inlineSource(RESOURCES[0]!, RESOURCES), undefined, surfaces);
    added[0]!.applyFade(0.5);

    expect(mesh.material).not.toBe(material);
    expect((mesh.material as THREE.Material).transparent).toBe(true);
  });

  it('keeps an ORMMaterial3D translated under a fade, as the classic path declines it', async () => {
    page.form = 'nodes';
    const material = new THREE.MeshBasicMaterial();
    translated.surface = { spatial: { material, parameters: {}, pointDraw: null }, samplers: {} };
    const surfaces = { add: () => () => {} };

    const mesh = await renderSlot(inlineSource(RESOURCES[1]!, RESOURCES), undefined, surfaces);

    expect(mesh.material).toBe(material);
  });

  it("keeps the classic material until a generated shader's textures load", async () => {
    page.form = 'nodes';
    const material = new THREE.MeshBasicMaterial();
    translated.surface = {
      spatial: { material, parameters: {}, pointDraw: null },
      samplers: { texture_albedo: { kind: 'flat', isColor: true } },
    };
    const pending = inlineSource(RESOURCES[0]!, RESOURCES);
    surfaceShaderOf.mockReturnValueOnce({
      code: '',
      file: '',
      textures: { texture_albedo: pending },
      albedoTexture: null,
      parametersWith: () => ({}),
    } as never);

    const mesh = await renderSlot(inlineSource(RESOURCES[0]!, RESOURCES));

    expect(mesh.material).not.toBe(material);
  });
});
