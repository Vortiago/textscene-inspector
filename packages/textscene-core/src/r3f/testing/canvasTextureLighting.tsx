/**
 * A lit canvas whose items draw a CanvasTexture of flat grey maps. A test reads which light list
 * each item registers for: `apart` for a normal-mapped item, `plain` for one without a normal map.
 */
import type { ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { SceneResourcesProvider } from '../SceneResourcesContext';
import { ResourceLoaderProvider } from '../../resources/ResourceLoaderContext';
import { createFakeResourceLoader } from '../../resources/testing/createFakeResourceLoader';
import {
  CanvasLighting2DContext,
  INERT_CANVAS_LIGHTING,
  type CanvasLighting2D,
} from '../lighting2d/lightPassContext';
import type { ItemPlacement, LitItemRead } from '../lighting2d/itemLightList';
import type { TscnInternalResource } from '../../parser/types';
import { subResource } from '../../testing/subResource';

/** `SubResource("CanvasTexture_1")`, the CanvasTexture `canvasTexture` builds. */
export const CANVAS_TEXTURE_REF = 'SubResource("CanvasTexture_1")';

/** The flat grey 8x8 GradientTexture2D every map of the CanvasTexture names. */
export const FLAT_GREY_REF = 'SubResource("GradientTexture2D_grey")';

const FLAT_GREY: readonly TscnInternalResource[] = [
  subResource('Gradient', 'Gradient_grey', { colors: 'PackedColorArray(0.5, 0.5, 0.5, 1)' }),
  subResource('GradientTexture2D', 'GradientTexture2D_grey', {
    gradient: 'SubResource("Gradient_grey")',
    width: '8',
    height: '8',
  }),
];

/** A CanvasTexture whose diffuse is the flat grey texture, with `data` laid over it. */
export function canvasTexture(data: Record<string, string>): TscnInternalResource {
  return subResource('CanvasTexture', 'CanvasTexture_1', { diffuse_texture: FLAT_GREY_REF, ...data });
}

/**
 * Renders `item` on a lit canvas with the flat grey texture and `resources` in the scene, and
 * returns the first mesh it draws, that mesh's map and an `update` that swaps the item.
 */
export async function renderLitItem(item: ReactElement, resources: readonly TscnInternalResource[]) {
  const registerItem = vi.fn((_placement: ItemPlacement, _read: LitItemRead) => () => {});
  const lighting: CanvasLighting2D = { ...INERT_CANVAS_LIGHTING, registerItem };
  const loader = createFakeResourceLoader().loader;
  const onLitCanvas = (drawn: ReactElement) => (
    <ResourceLoaderProvider loader={loader}>
      <SceneResourcesProvider internalResources={[...FLAT_GREY, ...resources]} externalResources={[]}>
        <CanvasLighting2DContext.Provider value={lighting}>{drawn}</CanvasLighting2DContext.Provider>
      </SceneResourcesProvider>
    </ResourceLoaderProvider>
  );
  const renderer = await ReactThreeTestRenderer.create(onLitCanvas(item));
  /** Renders `next` in place of the item, on the same canvas. */
  const update = (next: ReactElement) => renderer.update(onLitCanvas(next));
  const mesh = renderer.scene.findByType('Mesh').instance as THREE.Mesh;
  const map = (mesh.material as THREE.MeshBasicMaterial).map!;
  return { renderer, update, registerItem, mesh, map };
}

/**
 * The three things every item that draws a CanvasTexture does: declares itself normal-mapped while
 * the CanvasTexture names a normal map, declares none while it names none, and samples with the
 * CanvasTexture's own filter. `render` draws the node with the CanvasTexture `wrapper` in its scene.
 */
export function describeCanvasTextureItem(
  title: string,
  render: (wrapper: TscnInternalResource) => ReturnType<typeof renderLitItem>
): void {
  describe(`${title} with a CanvasTexture`, () => {
    it('declares itself normal-mapped while the CanvasTexture names a normal map', async () => {
      const { registerItem } = await render(canvasTexture({ normal_texture: FLAT_GREY_REF }));
      expect(registerItem).toHaveBeenLastCalledWith(expect.anything(), 'apart');
    });

    it('declares no normal map while the CanvasTexture names none', async () => {
      const { registerItem } = await render(canvasTexture({}));
      expect(registerItem).toHaveBeenLastCalledWith(expect.anything(), 'plain');
    });

    it("samples the diffuse with the CanvasTexture's own filter", async () => {
      const { map } = await render(canvasTexture({ texture_filter: '1' }));
      expect([map.magFilter, map.minFilter]).toEqual([THREE.NearestFilter, THREE.NearestFilter]);
    });
  });
}
