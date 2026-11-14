/**
 * Renders a canvas mesh drawer on a lit canvas whose texture slot is in one load state: the file
 * `TEXTURE_REFERENCE` names fails or stays arriving, and `READY_REFERENCE` names an inline texture
 * that is here. A test reads what the item draws and whether it asks the light pass for a read.
 */
import * as THREE from 'three';
import type { ReactElement } from 'react';
import { vi } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { ResourceLoaderProvider } from '../../resources/ResourceLoaderContext';
import { SceneResourcesProvider } from '../SceneResourcesContext';
import { createFakeResourceLoader } from '../../resources/testing/createFakeResourceLoader';
import { CanvasLighting2DContext, INERT_CANVAS_LIGHTING } from '../lighting2d/lightPassContext';
import type { ItemPlacement, LitItemRead } from '../lighting2d/itemLightList';
import { subResource } from '../../testing/subResource';

const TEXTURE_PATH = 'res://texture.png';

/** The file texture whose load state `renderWithTexture` sets. */
export const TEXTURE_REFERENCE = 'ExtResource("1")';

/** An 8 by 8 GradientTexture2D in the scene, which is here at once. */
export const READY_REFERENCE = 'SubResource("Gradient_ready")';

const READY_TEXTURE = [
  subResource('Gradient', 'Gradient_grey', { colors: 'PackedColorArray(0.5, 0.5, 0.5, 1)' }),
  subResource('GradientTexture2D', 'Gradient_ready', {
    gradient: 'SubResource("Gradient_grey")',
    width: '8',
    height: '8',
  }),
];

/** What the loader does with the file `TEXTURE_REFERENCE` names. */
export type FileLoadState = 'failed' | 'arriving';

export async function renderWithTexture(drawer: ReactElement, file: FileLoadState = 'failed') {
  const fake = createFakeResourceLoader();
  if (file === 'failed') fake.textures.seed(TEXTURE_PATH, null);
  // A request that never answers keeps the texture arriving.
  else fake.textures.setRequestImpl(() => {});
  const registerItem = vi.fn((_placement: ItemPlacement, _read: LitItemRead) => () => {});
  const renderer = await ReactThreeTestRenderer.create(
    <ResourceLoaderProvider loader={fake.loader}>
      <SceneResourcesProvider
        internalResources={READY_TEXTURE}
        externalResources={[{ id: '1', type: 'Texture2D', path: TEXTURE_PATH }]}
      >
        <CanvasLighting2DContext.Provider value={{ ...INERT_CANVAS_LIGHTING, registerItem }}>
          {drawer}
        </CanvasLighting2DContext.Provider>
      </SceneResourcesProvider>
    </ResourceLoaderProvider>
  );
  await ReactThreeTestRenderer.act(async () => {});
  return { renderer, registerItem };
}

type Rendered = Awaited<ReturnType<typeof renderWithTexture>>['renderer'];

/** The meshes drawn with the missing-resource placeholder's magenta. */
export function placeholderMeshes(renderer: Rendered) {
  const magenta = new THREE.Color('magenta').getHex();
  return renderer.scene.findAllByType('Mesh').filter((mesh) => {
    const material = (mesh.instance as THREE.Mesh).material as THREE.MeshBasicMaterial;
    return material.color.getHex() === magenta;
  });
}
