/**
 * `<ActiveCameraSwitcher>` makes a used or deep-linked (`?camera=`) Camera3D the render
 * camera and fits its projection to the live canvas. The node camera mounts at a 16/9
 * placeholder. The test canvas is 1280x800, so a fitted camera reads 1.6.
 */
import { describe, expect, it } from 'vitest';
import type * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { ActiveCameraSwitcher } from './ActiveCameraSwitcher';
import { HierarchyProvider } from './contexts/HierarchyContext';
import { ViewportActionsProvider } from './contexts/ViewportActionsContext';
import { createSceneGraphFromTscnScene } from '../core/SceneGraph.testkit';
import { TscnParser } from '../parser/TscnParser';
import { Camera3D } from '../nodes/3d/camera3d/Component';
import { KeepAspectMode, ProjectionMode, type Camera3DProperties } from '../nodes/3d/camera3d/types';
import type { TscnNode } from '../parser/types';

function graph() {
  return createSceneGraphFromTscnScene(
    new TscnParser().parse('[gd_scene format=3]\n\n[node name="Root" type="Node3D"]\n')
  );
}

function cameraNode(projection: ProjectionMode): TscnNode {
  const properties: Camera3DProperties = {
    name: 'Camera3D',
    projection,
    fov: 75,
    size: 8,
    near: 0.05,
    far: 4000,
    keep_aspect: KeepAspectMode.KEEP_HEIGHT,
    h_offset: 0,
    v_offset: 0,
    frustum_offset: { x: 0, y: 0 },
    current: false,
    cull_mask: 0xfffff,
    doppler_tracking: 0,
  };
  return { rawProperties: {}, name: 'Camera3D', type: 'Camera3D', children: [], properties };
}

async function mount(initialActiveCameraPath?: string, projection = ProjectionMode.PROJECTION_PERSPECTIVE) {
  return ReactThreeTestRenderer.create(
    <HierarchyProvider value={{ sceneGraph: graph(), panelId: 'p' }}>
      <ViewportActionsProvider initialActiveCameraPath={initialActiveCameraPath}>
        <Camera3D node={cameraNode(projection)} />
        <ActiveCameraSwitcher />
      </ViewportActionsProvider>
    </HierarchyProvider>
  );
}

describe('ActiveCameraSwitcher', () => {
  it('syncs a deep-linked scene camera aspect to the canvas so it renders undistorted', async () => {
    const r = await mount('Camera3D');
    const cam = r.scene.findByType('PerspectiveCamera').instance as THREE.PerspectiveCamera;
    expect(cam.aspect).toBeCloseTo(1280 / 800, 5);
  });

  it('leaves the authored aspect untouched when no camera is activated (free orbit)', async () => {
    const r = await mount(undefined);
    const cam = r.scene.findByType('PerspectiveCamera').instance as THREE.PerspectiveCamera;
    expect(cam.aspect).toBeCloseTo(16 / 9, 5);
  });

  it('ignores a deep-linked path that matches no camera in the scene', async () => {
    const r = await mount('Root/Missing');
    const cam = r.scene.findByType('PerspectiveCamera').instance as THREE.PerspectiveCamera;
    expect(cam.aspect).toBeCloseTo(16 / 9, 5);
  });

  it('widens an orthographic camera to the canvas, keeping `size` as its height', async () => {
    const r = await mount('Camera3D', ProjectionMode.PROJECTION_ORTHOGONAL);
    const cam = r.scene.findByType('OrthographicCamera').instance as THREE.OrthographicCamera;
    expect([cam.top, cam.right]).toEqual([4, 4 * (1280 / 800)]);
  });
});
