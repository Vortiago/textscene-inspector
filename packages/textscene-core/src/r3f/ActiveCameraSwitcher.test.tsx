/**
 * `<ActiveCameraSwitcher>` makes a scene Camera3D the render camera when one is
 * "used" (the Cameras panel) or deep-linked (`?camera=`, seeded as the
 * provider's initial active path).
 *
 * A node camera is authored with a fixed 16/9 placeholder aspect because at
 * mount it cannot know the canvas size, and R3F only re-syncs a camera's aspect
 * on a resize event — which never fires for a fixed-size (headless) canvas. So
 * the switcher matches the activated camera's aspect to the live canvas, or an
 * activated scene camera renders horizontally stretched. The test-renderer
 * canvas is 1280x800, so a synced camera reads 1.6, not the authored 16/9.
 */
import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { ActiveCameraSwitcher } from './TscnCanvas';
import { HierarchyProvider } from './contexts/HierarchyContext';
import { CameraControlProvider } from './contexts/CameraControlContext';
import { createSceneGraphFromTscnScene } from '../core/SceneGraph';
import { TscnParser } from '../parser/TscnParser';

function graph() {
  return createSceneGraphFromTscnScene(
    new TscnParser().parse('[gd_scene format=3]\n\n[node name="Root" type="Node3D"]\n')
  );
}

async function mount(initialActiveCameraPath?: string) {
  return ReactThreeTestRenderer.create(
    <HierarchyProvider value={{ sceneGraph: graph(), panelId: 'p' }}>
      <CameraControlProvider initialActiveCameraPath={initialActiveCameraPath}>
        <perspectiveCamera userData={{ tscnPath: 'Root/Camera3D' }} aspect={16 / 9} />
        <ActiveCameraSwitcher />
      </CameraControlProvider>
    </HierarchyProvider>
  );
}

describe('ActiveCameraSwitcher', () => {
  it('syncs a deep-linked scene camera aspect to the canvas so it renders undistorted', async () => {
    const r = await mount('Root/Camera3D');
    const cam = r.scene.findByType('PerspectiveCamera').instance as { aspect: number };
    expect(cam.aspect).toBeCloseTo(1280 / 800, 5);
  });

  it('leaves the authored aspect untouched when no camera is activated (free orbit)', async () => {
    const r = await mount(undefined);
    const cam = r.scene.findByType('PerspectiveCamera').instance as { aspect: number };
    expect(cam.aspect).toBeCloseTo(16 / 9, 5);
  });

  it('ignores a deep-linked path that matches no camera in the scene', async () => {
    const r = await ReactThreeTestRenderer.create(
      <HierarchyProvider value={{ sceneGraph: graph(), panelId: 'p' }}>
        <CameraControlProvider initialActiveCameraPath="Root/Missing">
          <perspectiveCamera userData={{ tscnPath: 'Root/Camera3D' }} aspect={16 / 9} />
          <ActiveCameraSwitcher />
        </CameraControlProvider>
      </HierarchyProvider>
    );
    const cam = r.scene.findByType('PerspectiveCamera').instance as { aspect: number };
    expect(cam.aspect).toBeCloseTo(16 / 9, 5);
  });
});
