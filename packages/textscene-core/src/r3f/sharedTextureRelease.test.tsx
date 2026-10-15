import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { SharedTextureRelease, releasedOnUnmount } from './sharedTexture';
import { RendererProbe, recordTextures, withRenderTargets } from '../testing/recordingWebGL';
import { defaultWhiteTexture } from './materials/defaultWhiteTexture';
import { pendingMapStandIn } from './materials/pendingMapStandIn';
import { getAtlasTexture } from './controls/native/text/atlasTexture';
import { installLtcTextures } from './areaLight/ltcTextures';

/** A canvas with the release mounted, its renderer, and the unmount that ends it. */
async function canvas() {
  let renderer: THREE.WebGLRenderer | undefined;
  const root = await ReactThreeTestRenderer.create(
    <>
      <SharedTextureRelease />
      <RendererProbe onRenderer={(found) => (renderer = found)} />
    </>,
    { gl: withRenderTargets }
  );
  return { renderer: renderer!, unmount: () => root.unmount() };
}

/** The dispose listeners three left on `texture`, one per renderer that uploaded it. */
function disposeListeners(texture: THREE.Texture): number {
  const listeners = (texture as unknown as { _listeners?: Record<string, unknown[]> })._listeners;
  return listeners?.dispose?.length ?? 0;
}

const uniformsLib = THREE.UniformsLib as unknown as Record<string, THREE.Texture>;

describe('SharedTextureRelease', () => {
  it('leaves no listener of an unmounted canvas on each shared texture', async () => {
    installLtcTextures();
    const textures = [
      defaultWhiteTexture(),
      pendingMapStandIn('heightmap_texture'),
      getAtlasTexture(),
      uniformsLib.LTC_FLOAT_1!,
    ];
    const { renderer, unmount } = await canvas();
    for (const texture of textures) renderer.initTexture(texture);

    await unmount();

    expect(textures.map(disposeListeners)).toEqual([0, 0, 0, 0]);
  });

  it('lets a live canvas upload a shared texture again at its next draw (edge case)', async () => {
    const texture = releasedOnUnmount(new THREE.DataTexture(new Uint8Array(4), 1, 1));
    texture.needsUpdate = true;
    const closing = await canvas();
    const live = await canvas();
    const recording = recordTextures(live.renderer);
    live.renderer.initTexture(texture);
    closing.renderer.initTexture(texture);
    const firstUpload = recording.uploads();

    await closing.unmount();
    live.renderer.initTexture(texture);

    expect(recording.uploads()).toBe(2 * firstUpload);
    await live.unmount();
  });

  it('releases a shared texture no renderer uploaded (edge case)', async () => {
    const texture = releasedOnUnmount(new THREE.DataTexture(new Uint8Array(4), 1, 1));
    const { unmount } = await canvas();

    await expect(unmount()).resolves.toBeUndefined();
    expect(disposeListeners(texture)).toBe(0);
  });
});
