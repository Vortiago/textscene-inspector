/**
 * `<ActiveCameraSwitcher>` makes a used or deep-linked (`?camera=`) Camera3D the render
 * camera and matches its aspect to the live canvas. The node camera mounts with a 16/9
 * placeholder, and R3F re-syncs aspect only on a resize a fixed-size canvas never fires.
 * The test canvas is 1280x800, so a synced camera reads 1.6.
 */
import { describe, expect, it } from 'vitest';
import type * as THREE from 'three';
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
    const cam = r.scene.findByType('PerspectiveCamera').instance as THREE.PerspectiveCamera;
    expect(cam.aspect).toBeCloseTo(1280 / 800, 5);
  });

  it('leaves the authored aspect untouched when no camera is activated (free orbit)', async () => {
    const r = await mount(undefined);
    const cam = r.scene.findByType('PerspectiveCamera').instance as THREE.PerspectiveCamera;
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
    const cam = r.scene.findByType('PerspectiveCamera').instance as THREE.PerspectiveCamera;
    expect(cam.aspect).toBeCloseTo(16 / 9, 5);
  });
});
