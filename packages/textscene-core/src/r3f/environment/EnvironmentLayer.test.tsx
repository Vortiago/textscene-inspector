/**
 * The canvas's renderer draws the root viewport, so only the root world's Environment mounts the
 * compositor. A marker stands in for the compositor, whose own tests draw it.
 */
import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { EnvironmentLayer } from './EnvironmentLayer';
import { WorldKindProvider, type WorldKind } from './WorldKindContext';
import { environmentSettingsOf } from '../../resources/environment/testing/environmentSettings';
import { NO_RESOURCES } from '../SceneResourcesContext';
import { ViewportModeProvider } from '../contexts/ViewportModeContext';
import { CanvasWorkspaceProvider, type CanvasWorkspace } from '../contexts/CanvasWorkspaceContext';

vi.mock('./Compositor', () => ({
  Compositor: () => <group name="Compositor" />,
}));

/** `showFog` is the viewport's Fog toggle. */
interface MountOptions {
  showFog?: boolean;
  workspace?: CanvasWorkspace;
}

function layer(
  world: WorldKind,
  properties: Record<string, string>,
  { showFog = true, workspace = '3d' }: MountOptions
) {
  return (
    <CanvasWorkspaceProvider workspace={workspace}>
      <ViewportModeProvider initialShowFog={showFog}>
        <WorldKindProvider world={world}>
          <EnvironmentLayer
            settings={environmentSettingsOf(properties)}
            sky={null}
            skyResources={NO_RESOURCES}
          />
        </WorldKindProvider>
      </ViewportModeProvider>
    </CanvasWorkspaceProvider>
  );
}

async function mountLayer(world: WorldKind, properties: Record<string, string>, options: MountOptions = {}) {
  const renderer = await ReactThreeTestRenderer.create(layer(world, properties, options));
  const compositors = renderer.scene.findAll((node) => node.props.name === 'Compositor').length;
  const scene = renderer.scene.instance as THREE.Scene;
  return { scene, compositors, unmount: () => renderer.unmount() };
}

describe('<EnvironmentLayer> in the root world', () => {
  it('mounts the compositor', async () => {
    const { compositors } = await mountLayer('root', {});
    expect(compositors).toBe(1);
  });

  it('mounts no compositor on a 2D canvas, whose canvas items Godot draws after its tonemap pass', async () => {
    const { compositors } = await mountLayer('root', {}, { workspace: '2d' });
    expect(compositors).toBe(0);
  });
});

describe('<EnvironmentLayer> background', () => {
  it('draws a colour background as a texture, which the fog can reach', async () => {
    const { scene } = await mountLayer('root', {
      background_mode: '1',
      background_color: 'Color(0.2, 0.3, 0.4, 1)',
    });
    expect((scene.background as THREE.DataTexture | null)?.isDataTexture).toBe(true);
  });

  it('restores the background it found on unmount', async () => {
    const { scene, unmount } = await mountLayer('root', { background_mode: '1' });
    await unmount();
    expect(scene.background).toBeNull();
  });
});

describe('<EnvironmentLayer> fog', () => {
  it('draws the fog of an Environment that enables it', async () => {
    const { scene } = await mountLayer('root', { volumetric_fog_enabled: 'true' });
    expect(scene.fog).not.toBeNull();
  });

  it('draws no fog while the viewport hides it', async () => {
    const { scene } = await mountLayer(
      'root',
      { fog_enabled: 'true', volumetric_fog_enabled: 'true' },
      { showFog: false }
    );
    expect(scene.fog).toBeNull();
  });

  it('draws no fog for an Environment without one (edge case)', async () => {
    const { scene } = await mountLayer('root', {});
    expect(scene.fog).toBeNull();
  });
});

describe('<EnvironmentLayer> in a sub-viewport world', () => {
  it('mounts no compositor, which would draw to the canvas, not the sub-viewport target', async () => {
    const { compositors } = await mountLayer('subViewport', { glow_enabled: 'true' });
    expect(compositors).toBe(0);
  });
});
