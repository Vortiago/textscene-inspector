/** The background and the fog one Environment draws into its world's scene. */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { EnvironmentLayer } from './EnvironmentLayer';
import { environmentSettingsOf } from '../../resources/environment/testing/environmentSettings';
import { NO_RESOURCES } from '../SceneResourcesContext';
import { ViewportModeProvider } from '../contexts/ViewportModeContext';

/** `showFog` is the viewport's Fog toggle. */
interface MountOptions {
  showFog?: boolean;
}

function layer(properties: Record<string, string>, { showFog = true }: MountOptions) {
  return (
    <ViewportModeProvider initialShowFog={showFog}>
      <EnvironmentLayer settings={environmentSettingsOf(properties)} sky={null} skyResources={NO_RESOURCES} />
    </ViewportModeProvider>
  );
}

async function mountLayer(properties: Record<string, string>, options: MountOptions = {}) {
  const renderer = await ReactThreeTestRenderer.create(layer(properties, options));
  const scene = renderer.scene.instance as THREE.Scene;
  return { scene, unmount: () => renderer.unmount() };
}

describe('<EnvironmentLayer> background', () => {
  it('draws a colour background as a texture, which the fog can reach', async () => {
    const { scene } = await mountLayer({
      background_mode: '1',
      background_color: 'Color(0.2, 0.3, 0.4, 1)',
    });
    expect((scene.background as THREE.DataTexture | null)?.isDataTexture).toBe(true);
  });

  it('restores the background it found on unmount', async () => {
    const { scene, unmount } = await mountLayer({ background_mode: '1' });
    await unmount();
    expect(scene.background).toBeNull();
  });
});

describe('<EnvironmentLayer> fog', () => {
  it('draws the fog of an Environment that enables it', async () => {
    const { scene } = await mountLayer({ volumetric_fog_enabled: 'true' });
    expect(scene.fog).not.toBeNull();
  });

  it('draws no fog while the viewport hides it', async () => {
    const { scene } = await mountLayer(
      { fog_enabled: 'true', volumetric_fog_enabled: 'true' },
      { showFog: false }
    );
    expect(scene.fog).toBeNull();
  });

  it('draws no fog for an Environment without one (edge case)', async () => {
    const { scene } = await mountLayer({});
    expect(scene.fog).toBeNull();
  });
});
