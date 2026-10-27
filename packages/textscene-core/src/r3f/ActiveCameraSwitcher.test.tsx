/**
 * `<ActiveCameraSwitcher>` makes a used or deep-linked (`?camera=`) Camera3D the render
 * camera and fits its projection to the live canvas. The node camera mounts at a 16/9
 * placeholder. The test canvas is 1280x800, so a fitted camera reads 1.6.
 */
import { describe, expect, it } from 'vitest';
import type * as THREE from 'three';
import { instanceAs } from '../nodes/3d/testing/reactThreeTestInstance';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { ActiveCameraSwitcher } from './ActiveCameraSwitcher';
import { HierarchyProvider } from './contexts/HierarchyContext';
import { ViewportActionsProvider } from './contexts/ViewportActionsContext';
import { createSceneGraphFromTscnScene } from '../core/SceneGraph.testkit';
import { TscnParser } from '../parser/TscnParser';
import { Camera3DInWorld } from '../nodes/3d/camera3d/Camera3DInWorld.testkit';
import type { TscnNode } from '../parser/types';

function graph() {
  return createSceneGraphFromTscnScene(
    new TscnParser().parse('[gd_scene format=3]\n\n[node name="Root" type="Node3D"]\n')
  );
}

/** A Camera3D as the parser reads it, so its properties keep Godot's defaults. */
function cameraNode(projection: '0' | '1'): TscnNode {
  const scene = new TscnParser().parse(
    `[gd_scene format=3]\n\n[node name="Camera3D" type="Camera3D"]\nprojection = ${projection}\nsize = 8.0\n`
  );
  return scene.nodes[0]!;
}

async function mount(initialActiveCameraPath?: string, projection: '0' | '1' = '0') {
  return ReactThreeTestRenderer.create(
    <HierarchyProvider value={{ sceneGraph: graph(), panelId: 'p' }}>
      <ViewportActionsProvider initialActiveCameraPath={initialActiveCameraPath}>
        <Camera3DInWorld node={cameraNode(projection)} />
        <ActiveCameraSwitcher />
      </ViewportActionsProvider>
    </HierarchyProvider>
  );
}

describe('ActiveCameraSwitcher', () => {
  it('syncs a deep-linked scene camera aspect to the canvas so it renders undistorted', async () => {
    const r = await mount('Camera3D');
    const cam = instanceAs<THREE.PerspectiveCamera>(r.scene.findByType('PerspectiveCamera'));
    expect(cam.aspect).toBeCloseTo(1280 / 800, 5);
  });

  it('leaves the authored aspect untouched when no camera is activated (free orbit)', async () => {
    const r = await mount(undefined);
    const cam = instanceAs<THREE.PerspectiveCamera>(r.scene.findByType('PerspectiveCamera'));
    expect(cam.aspect).toBeCloseTo(16 / 9, 5);
  });

  it('ignores a deep-linked path that matches no camera in the scene', async () => {
    const r = await mount('Root/Missing');
    const cam = instanceAs<THREE.PerspectiveCamera>(r.scene.findByType('PerspectiveCamera'));
    expect(cam.aspect).toBeCloseTo(16 / 9, 5);
  });

  it('widens an orthographic camera to the canvas, keeping `size` as its height', async () => {
    const r = await mount('Camera3D', '1');
    const cam = instanceAs<THREE.OrthographicCamera>(r.scene.findByType('OrthographicCamera'));
    expect([cam.top, cam.right]).toEqual([4, 4 * (1280 / 800)]);
  });
});
