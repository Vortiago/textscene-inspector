/**
 * A sprite over a sheet large enough to upload in bands, mounted under a real
 * `TiledUploadQueue` whose renderer keeps three's texture cache. The test drives
 * the frames: each `tick` is one frame of `TiledUploadDriver`, one band long.
 */
import { act, type ReactElement } from 'react';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { SceneResourcesProvider } from '../SceneResourcesContext';
import { ResourceLoaderProvider } from '../../resources/ResourceLoaderContext';
import { createFakeResourceLoader } from '../../resources/testing/createFakeResourceLoader';
import { TiledUploadContext } from './TiledUploadContext';
import { bandRows, TiledUploadQueue } from './TiledUploadQueue';
import { fakeWebGLTextures } from './fakeWebGLTextures.testkit';

const SHEET_PATH = 'res://sheet.png';
const SHEET_WIDTH = 4096;
export const SHEET_BANDS = 4;
export const SHEET_HEIGHT = bandRows(SHEET_WIDTH) * SHEET_BANDS;
/** The `texture` a sprite sets to draw the sheet. */
export const SHEET_REF = 'ExtResource("sheet")';

function sheet(): THREE.DataTexture {
  const texture = new THREE.DataTexture(new Uint8Array(SHEET_WIDTH * SHEET_HEIGHT * 4), SHEET_WIDTH, SHEET_HEIGHT);
  texture.needsUpdate = true;
  return texture;
}

/** Mounts `spriteAt(0)`, and shows `spriteAt(frame)` on each `showFrame`. */
export async function mountSheetSprite(spriteAt: (frame: number) => ReactElement) {
  const gpu = fakeWebGLTextures();
  const queue = new TiledUploadQueue(gpu.renderer, () => 0);
  const fake = createFakeResourceLoader();
  fake.textures.seed(SHEET_PATH, sheet());
  const tree = (frame: number): ReactElement => (
    <TiledUploadContext.Provider value={queue}>
      <ResourceLoaderProvider loader={fake.loader}>
        <SceneResourcesProvider
          internalResources={[]}
          externalResources={[{ id: 'sheet', type: 'Texture2D', path: SHEET_PATH }]}
        >
          {spriteAt(frame)}
        </SceneResourcesProvider>
      </ResourceLoaderProvider>
    </TiledUploadContext.Provider>
  );
  const renderer = await ReactThreeTestRenderer.create(tree(0));
  return {
    gpu,
    drawnMap: (): THREE.Texture | null => {
      const [mesh] = renderer.scene.findAllByType('Mesh');
      const material = (mesh?.instance as THREE.Mesh | undefined)?.material as THREE.MeshBasicMaterial | undefined;
      return material?.map ?? null;
    },
    showFrame: (frame: number) => renderer.update(tree(frame)),
    tick: async () => {
      await act(async () => {
        queue.tick(0);
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
    },
  };
}
