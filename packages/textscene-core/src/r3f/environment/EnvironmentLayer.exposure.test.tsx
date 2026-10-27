/**
 * Godot scales a colour background by the exposure in sRGB, before it converts the colour to linear
 * (`render_forward_clustered.cpp:1988-2011`). It scales no flat ambient (`render_scene_data_rd.cpp:174-190`).
 * Markers stand in for the layers that need a real GL context.
 */
import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { EnvironmentLayer } from './EnvironmentLayer';
import { WorldKindProvider } from './WorldKindContext';
import { WorldExposureScope, usePublishCameraAttributes } from './worldExposure';
import { drawAtExposure } from '../exposure/sceneExposure';
import { environmentSettingsOf } from '../../resources/environment/testing/environmentSettings';
import { NO_RESOURCES } from '../SceneResourcesContext';
import { fakeWebGL2Context, rendererOver } from '../testing/fakeWebGL2Context';
import { ViewportModeProvider } from '../contexts/ViewportModeContext';
import { textureTexel } from '../testing/backgroundTexel';
import { LIGHT_INTENSITY_SCALE } from '../lightConstants';
import { sRGBToLinearRGB } from '../../utils/colorSpace';

vi.mock('./Compositor', () => ({ Compositor: () => <group name="Compositor" /> }));
vi.mock('../fog/FogLayer', () => ({ FogLayer: () => <group name="FogLayer" /> }));

function Exposure({ multiplier }: { multiplier: number }) {
  usePublishCameraAttributes({ status: 'resolved', attributes: { exposureMultiplier: multiplier } });
  return null;
}

function layer(properties: Record<string, string>, multiplier: number | null) {
  return (
    <ViewportModeProvider>
      <WorldKindProvider world="subViewport">
        <WorldExposureScope>
          {multiplier !== null && <Exposure multiplier={multiplier} />}
          <EnvironmentLayer
            settings={environmentSettingsOf(properties)}
            sky={null}
            resources={NO_RESOURCES}
            skyResources={NO_RESOURCES}
          />
        </WorldExposureScope>
      </WorldKindProvider>
    </ViewportModeProvider>
  );
}

async function mount(properties: Record<string, string>, multiplier: number | null, hasGlContext = false) {
  const renderer = await ReactThreeTestRenderer.create(
    layer(properties, multiplier),
    hasGlContext ? { gl: rendererOver(fakeWebGL2Context()) } : undefined
  );
  return { renderer, scene: renderer.scene.instance as THREE.Scene };
}

/** The background's 8-bit sRGB hex, as the frame shows the colour before the tone curve. */
function backgroundHex(scene: THREE.Scene): string {
  return new THREE.Color().fromArray(textureTexel(scene.background as THREE.DataTexture)).getHexString();
}

const BACKGROUND_COLOR = { background_mode: '1', background_color: 'Color(0.2, 0.2, 0.2, 1)' };

describe('<EnvironmentLayer> colour background under an exposure', () => {
  it('scales the colour in sRGB, so 0.2 becomes 0.4 at an exposure of 2', async () => {
    const { scene } = await mount(BACKGROUND_COLOR, 2);
    expect(backgroundHex(scene)).toBe('666666');
  });

  it('scales the project clear colour of a BG_CLEAR_COLOR background, 0.3 becoming 0.6', async () => {
    const { scene } = await mount({ background_mode: '0' }, 2);
    expect(backgroundHex(scene)).toBe('999999');
  });

  it('scales the colour once more by background_energy_multiplier', async () => {
    const { scene } = await mount({ ...BACKGROUND_COLOR, background_energy_multiplier: '2' }, 2);
    expect(backgroundHex(scene)).toBe('cccccc');
  });

  describe('drawn at another exposure', () => {
    /** The background's hex while `scene` draws at `exposure`. */
    function backgroundHexAt(scene: THREE.Scene, exposure: number | null): string {
      return drawAtExposure(scene, exposure, () => backgroundHex(scene));
    }

    it('scales the colour in sRGB by that exposure, so 0.2 becomes 0.6 at 3', async () => {
      const { scene } = await mount(BACKGROUND_COLOR, 2);
      expect(backgroundHexAt(scene, 3)).toBe('999999');
    });

    it('draws the colour as it is at no exposure', async () => {
      const { scene } = await mount(BACKGROUND_COLOR, 2);
      expect(backgroundHexAt(scene, null)).toBe('333333');
    });

    it('puts the background it drew with back', async () => {
      const { scene } = await mount(BACKGROUND_COLOR, 2);
      const drawn = scene.background;
      backgroundHexAt(scene, 3);
      expect(scene.background).toBe(drawn);
      expect(backgroundHex(scene)).toBe('666666');
    });

    it('draws with the one texture again at the same exposure', async () => {
      const { scene } = await mount(BACKGROUND_COLOR, 2);
      const drawnTexture = () => drawAtExposure(scene, 3, () => scene.background);
      expect(drawnTexture()).toBe(drawnTexture());
    });
  });

  it('leaves the colour alone in a world with no CameraAttributes', async () => {
    const { scene } = await mount(BACKGROUND_COLOR, null);
    expect(backgroundHex(scene)).toBe('333333');
  });

  it('draws black under an exposure of 0 (edge case)', async () => {
    const { scene } = await mount(BACKGROUND_COLOR, 0);
    expect(backgroundHex(scene)).toBe('000000');
  });

  it('converts a colour scaled past 1 as the sRGB curve does, without a clamp (edge case)', async () => {
    const { scene } = await mount(BACKGROUND_COLOR, 8);
    const [red] = textureTexel(scene.background as THREE.DataTexture);
    expect(red).toBeCloseTo(sRGBToLinearRGB(1.6, 1.6, 1.6)[0], 5);
  });

  it('scales the colour of a fogged background and its brightness, as Godot scales both', async () => {
    const { scene } = await mount(
      { ...BACKGROUND_COLOR, background_energy_multiplier: '2', fog_enabled: 'true' },
      2,
      true
    );
    const linearTwice = sRGBToLinearRGB(...sRGBToLinearRGB(0.2 * 2 * 2, 0.2 * 2 * 2, 0.2 * 2 * 2));
    const [red] = textureTexel(scene.background as THREE.DataTexture);
    expect([red, scene.backgroundIntensity]).toEqual([expect.closeTo(linearTwice[0], 5), 4]);
  });
});

describe('<EnvironmentLayer> flat ambient under an exposure', () => {
  const ambientIntensity = async (properties: Record<string, string>, multiplier: number) => {
    const { renderer } = await mount(properties, multiplier);
    return (renderer.scene.findByType('AmbientLight').instance as THREE.AmbientLight).intensity;
  };

  it('leaves a COLOR ambient unscaled', async () => {
    const intensity = await ambientIntensity(
      { ...BACKGROUND_COLOR, ambient_light_source: '2', ambient_light_color: 'Color(0.3, 0.3, 0.3, 1)' },
      2
    );
    expect(intensity).toBeCloseTo(LIGHT_INTENSITY_SCALE, 10);
  });

  it('leaves a BG ambient over a colour background unscaled', async () => {
    expect(await ambientIntensity(BACKGROUND_COLOR, 2)).toBeCloseTo(LIGHT_INTENSITY_SCALE, 10);
  });
});
