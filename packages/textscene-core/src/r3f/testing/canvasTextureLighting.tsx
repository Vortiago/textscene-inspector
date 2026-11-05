/**
 * A lit canvas whose items draw a CanvasTexture of flat grey maps. A test reads which light list
 * each item registers for: `apart` for a normal-mapped item, `plain` for one without a normal map.
 */
import type { ReactElement } from 'react';
import { vi } from 'vitest';
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

/** `SubResource("CanvasTexture_1")`, the CanvasTexture `canvasTexture` builds. */
export const CANVAS_TEXTURE_REF = 'SubResource("CanvasTexture_1")';

/** The flat grey 8x8 GradientTexture2D every map of the CanvasTexture names. */
export const FLAT_GREY_REF = 'SubResource("GradientTexture2D_grey")';

const FLAT_GREY: readonly TscnInternalResource[] = [
  { id: 'Gradient_grey', type: 'Gradient', data: { colors: 'PackedColorArray(0.5, 0.5, 0.5, 1)' } },
  {
    id: 'GradientTexture2D_grey',
    type: 'GradientTexture2D',
    data: { gradient: 'SubResource("Gradient_grey")', width: '8', height: '8' },
  },
];

/** A CanvasTexture whose diffuse is the flat grey texture, with `data` laid over it. */
export function canvasTexture(data: Record<string, string>): TscnInternalResource {
  return {
    id: 'CanvasTexture_1',
    type: 'CanvasTexture',
    data: { diffuse_texture: FLAT_GREY_REF, ...data },
  };
}

/** Renders `item` on a lit canvas with the flat grey texture and `resources` in the scene. */
export async function renderLitItem(item: ReactElement, resources: readonly TscnInternalResource[]) {
  const registerItem = vi.fn((_placement: ItemPlacement, _read: LitItemRead) => () => {});
  const lighting: CanvasLighting2D = { ...INERT_CANVAS_LIGHTING, registerItem };
  const renderer = await ReactThreeTestRenderer.create(
    <ResourceLoaderProvider loader={createFakeResourceLoader().loader}>
      <SceneResourcesProvider internalResources={[...FLAT_GREY, ...resources]} externalResources={[]}>
        <CanvasLighting2DContext.Provider value={lighting}>{item}</CanvasLighting2DContext.Provider>
      </SceneResourcesProvider>
    </ResourceLoaderProvider>
  );
  return { renderer, registerItem };
}
