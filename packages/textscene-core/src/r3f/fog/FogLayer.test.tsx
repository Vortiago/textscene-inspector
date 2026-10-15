/** When the fog readies its volume within a render of its scene. */
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { useThree, type RootState } from '@react-three/fiber';
import { DEFAULT_CLEAR_COLOR } from '../../godot/rendering/rendering';
import { createEnvironmentSettings } from '../../resources/environment/build';
import { decodeEnvironment } from '../../resources/environment/decode';
import { fireSceneRender } from '../testing/fireSceneRender';
import { FogLayer } from './FogLayer';
import { FogVolumeObject } from './fogVolumeObject';
import { VolumetricFogPass } from './volumetricFogPass';

const volumetric = createEnvironmentSettings(
  decodeEnvironment({ volumetric_fog_enabled: 'true' }),
  DEFAULT_CLEAR_COLOR
).volumetricFog;

afterEach(() => vi.restoreAllMocks());

/** The fog on a canvas, its volume pass watched, and the canvas's renderer, scene and camera. */
async function mountedFog() {
  const prepare = vi.spyOn(VolumetricFogPass.prototype, 'prepare').mockReturnValue(false);
  let state: RootState | null = null;
  function Capture() {
    state = useThree();
    return null;
  }
  await ReactThreeTestRenderer.create(
    <>
      <Capture />
      <FogLayer depth={null} volumetric={volumetric} skyEnergy={1} />
    </>
  );
  const { gl, scene, camera } = state!;
  return { prepare, gl, scene, camera };
}

describe('FogLayer', () => {
  it("readies the volume after its scene's shadow pass, so the fog reads this render's shadows", async () => {
    const { prepare, gl, scene, camera } = await mountedFog();

    gl.shadowMap.render([], scene, camera);

    expect(prepare).toHaveBeenCalledOnce();
    expect(prepare.mock.calls[0]![1]).toBe(scene);
  });

  it('readies nothing before the shadow pass has drawn the maps', async () => {
    const { prepare, scene, camera } = await mountedFog();

    fireSceneRender(scene, camera);

    expect(prepare).not.toHaveBeenCalled();
  });

  it("hands the volume pass the scene's FogVolumes", async () => {
    const { prepare, gl, scene, camera } = await mountedFog();
    const volume = new FogVolumeObject();
    scene.add(volume);

    gl.shadowMap.render([], scene, camera);

    expect(prepare.mock.calls[0]![3].volumes).toEqual([volume]);
  });

  it("readies nothing for another scene's shadow pass (edge case)", async () => {
    const { prepare, gl, camera } = await mountedFog();

    gl.shadowMap.render([], new THREE.Scene(), camera);

    expect(prepare).not.toHaveBeenCalled();
  });
});
