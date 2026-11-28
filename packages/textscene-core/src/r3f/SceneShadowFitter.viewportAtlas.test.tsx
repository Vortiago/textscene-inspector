import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { r3fStateProbe } from './testing/R3FStateProbe';
import { reportsMaxTextureSize } from './testing/reportsMaxTextureSize';
import * as areaAtlas from './areaLight/areaLightAtlas';
import { useSceneShadowFit } from './SceneShadowFitter';
import { ViewportShadowAtlas } from './positionalShadow/viewportShadowAtlas';
import { ROOT_POSITIONAL_SHADOW_ATLAS, VIEWPORT_POSITIONAL_SHADOW_ATLAS } from '../godot/scene/viewport';
import type { PositionalShadowAtlasSettings } from '../godot/rendering/lights/positionalShadowAtlas';
import { rootViewportDescription } from './viewportRender/viewportDescription';
import { useRootViewportDescription } from './viewportRender/useRootViewportDescription';

vi.mock('./viewportRender/useRootViewportDescription', () => ({ useRootViewportDescription: vi.fn() }));

/** The root's description with its atlas `size` texels square, as a project setting gives it. */
function rootWithAtlas(size: number) {
  return {
    ...rootViewportDescription(null),
    positionalShadowAtlas: { ...ROOT_POSITIONAL_SHADOW_ATLAS, size },
  };
}

function FitScene({ scene, atlas }: { scene: THREE.Scene; atlas: PositionalShadowAtlasSettings }) {
  useSceneShadowFit(scene, atlas);
  return null;
}

describe('useSceneShadowFit and its viewport’s atlas', () => {
  it('keeps a SubViewport’s light pass when the project’s atlas settings change', async () => {
    const scene = new THREE.Scene();
    vi.mocked(useRootViewportDescription).mockReturnValue(rootWithAtlas(4096));
    const dispose = vi.spyOn(ViewportShadowAtlas.prototype, 'dispose');
    const renderer = await ReactThreeTestRenderer.create(
      <FitScene scene={scene} atlas={VIEWPORT_POSITIONAL_SHADOW_ATLAS} />
    );
    vi.mocked(useRootViewportDescription).mockReturnValue(rootWithAtlas(512));
    await renderer.update(<FitScene scene={scene} atlas={{ ...VIEWPORT_POSITIONAL_SHADOW_ATLAS }} />);
    expect(dispose).not.toHaveBeenCalled();
    dispose.mockRestore();
  });

  it('reads the replacement renderer limit without releasing the scene light pass', async () => {
    const scene = new THREE.Scene();
    const root = r3fStateProbe();
    const replacement = r3fStateProbe();
    const firstCanvas = await ReactThreeTestRenderer.create(
      <>
        <FitScene scene={scene} atlas={ROOT_POSITIONAL_SHADOW_ATLAS} />
        <root.Probe />
      </>,
      { beforeReturn: reportsMaxTextureSize(256) }
    );
    const secondCanvas = await ReactThreeTestRenderer.create(<replacement.Probe />, {
      beforeReturn: reportsMaxTextureSize(512),
    });
    const original = root.state().gl;
    const update = vi.spyOn(areaAtlas, 'updateAreaLightAtlas');
    const dispose = vi.spyOn(ViewportShadowAtlas.prototype, 'dispose');
    try {
      root.state().gl.render(scene, new THREE.PerspectiveCamera());
      await ReactThreeTestRenderer.act(async () => root.state().set({ gl: replacement.state().gl }));
      root.state().gl.render(scene, new THREE.PerspectiveCamera());

      expect(update.mock.calls).toEqual([[256], [512]]);
      expect(dispose).not.toHaveBeenCalled();
    } finally {
      dispose.mockRestore();
      update.mockRestore();
      await ReactThreeTestRenderer.act(async () => root.state().set({ gl: original }));
      await firstCanvas.unmount();
      await secondCanvas.unmount();
    }
  });

  it('builds the light pass again for new atlas settings (edge case)', async () => {
    const scene = new THREE.Scene();
    const dispose = vi.spyOn(ViewportShadowAtlas.prototype, 'dispose');
    const renderer = await ReactThreeTestRenderer.create(
      <FitScene scene={scene} atlas={VIEWPORT_POSITIONAL_SHADOW_ATLAS} />
    );
    await renderer.update(
      <FitScene scene={scene} atlas={{ ...VIEWPORT_POSITIONAL_SHADOW_ATLAS, size: 512 }} />
    );
    expect(dispose).toHaveBeenCalledTimes(1);
    dispose.mockRestore();
  });
});
