/**
 * A Sprite2D whose texture is a CanvasTexture: it draws the diffuse texture, declares itself
 * normal-mapped while the CanvasTexture names a normal map, and samples every map with the
 * CanvasTexture's own filter where it names one (`texture_storage.cpp:737`).
 */
import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { parseSprite2D } from './parser';
import { Sprite2D } from './Component';
import { SceneResourcesProvider } from '../../../r3f/SceneResourcesContext';
import { ResourceLoaderProvider } from '../../../resources/ResourceLoaderContext';
import { createFakeResourceLoader } from '../../../resources/testing/createFakeResourceLoader';
import {
  CanvasLighting2DContext,
  INERT_CANVAS_LIGHTING,
  type CanvasLighting2D,
} from '../../../r3f/lighting2d/lightPassContext';
import type { ItemPlacement, LitItemNeeds } from '../../../r3f/lighting2d/itemLightList';
import type { TscnInternalResource, TscnNode } from '../../../parser/types';

const FLAT_GREY: TscnInternalResource[] = [
  { id: 'Gradient_grey', type: 'Gradient', data: { colors: 'PackedColorArray(0.5, 0.5, 0.5, 1)' } },
  {
    id: 'GradientTexture2D_grey',
    type: 'GradientTexture2D',
    data: { gradient: 'SubResource("Gradient_grey")', width: '8', height: '8' },
  },
];

function canvasTexture(data: Record<string, string>): TscnInternalResource {
  return {
    id: 'CanvasTexture_1',
    type: 'CanvasTexture',
    data: { diffuse_texture: 'SubResource("GradientTexture2D_grey")', ...data },
  };
}

function sprite(): TscnNode {
  const heading = { type: 'node', attributes: { type: 'Sprite2D', name: 'S' } };
  return {
    rawProperties: {},
    name: 'S',
    type: 'Sprite2D',
    children: [],
    properties: parseSprite2D(heading, { texture: 'SubResource("CanvasTexture_1")' }),
  };
}

async function render(wrapper: TscnInternalResource) {
  const registerItem = vi.fn((_placement: ItemPlacement, _needs: LitItemNeeds) => () => {});
  const lighting: CanvasLighting2D = { ...INERT_CANVAS_LIGHTING, registerItem };
  const renderer = await ReactThreeTestRenderer.create(
    <ResourceLoaderProvider loader={createFakeResourceLoader().loader}>
      <SceneResourcesProvider internalResources={[...FLAT_GREY, wrapper]} externalResources={[]}>
        <CanvasLighting2DContext.Provider value={lighting}>
          <Sprite2D node={sprite()} />
        </CanvasLighting2DContext.Provider>
      </SceneResourcesProvider>
    </ResourceLoaderProvider>
  );
  const mesh = renderer.scene.findByType('Mesh').instance as THREE.Mesh;
  return { registerItem, map: (mesh.material as THREE.MeshBasicMaterial).map! };
}

describe('Sprite2D with a CanvasTexture', () => {
  it('declares itself normal-mapped while the CanvasTexture names a normal map', async () => {
    const { registerItem } = await render(
      canvasTexture({ normal_texture: 'SubResource("GradientTexture2D_grey")' })
    );
    expect(registerItem).toHaveBeenLastCalledWith(expect.anything(), {
      lightOnly: false,
      normalMapped: true,
    });
  });

  it('declares no normal map while the CanvasTexture names none', async () => {
    const { registerItem } = await render(canvasTexture({}));
    expect(registerItem).toHaveBeenLastCalledWith(expect.anything(), {
      lightOnly: false,
      normalMapped: false,
    });
  });

  it("samples the diffuse with the CanvasTexture's own filter", async () => {
    const { map } = await render(canvasTexture({ texture_filter: '1' }));
    expect([map.magFilter, map.minFilter]).toEqual([THREE.NearestFilter, THREE.NearestFilter]);
  });
});
