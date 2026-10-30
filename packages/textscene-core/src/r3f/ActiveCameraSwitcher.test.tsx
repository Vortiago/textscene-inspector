/**
 * `<ActiveCameraSwitcher>` makes a used or deep-linked (`?camera=`) Camera3D the render
 * camera and fits its projection to the live canvas. The node camera mounts at a 16/9
 * placeholder. The test canvas is 1280x800, so a fitted camera reads 1.6.
 */
import { describe, expect, it } from 'vitest';
import type * as THREE from 'three';
import { instanceAs } from '../nodes/3d/testing/reactThreeTestInstance';
import ReactThreeTestRenderer, { act } from '@react-three/test-renderer';
import { useThree, type RootState } from '@react-three/fiber';
import { ActiveCameraSwitcher } from './ActiveCameraSwitcher';
import { HierarchyProvider } from './contexts/HierarchyContext';
import { ViewportActionsProvider } from './contexts/ViewportActionsContext';
import { createSceneGraphFromTscnScene } from '../core/SceneGraph.testkit';
import { TscnParser } from '../parser/TscnParser';
import { Camera3DInWorld } from '../nodes/3d/camera3d/Camera3DInWorld.testkit';
import type { CameraLike } from '../nodes/3d/camera3d/projectionFit';
import type { TscnNode } from '../parser/types';
import { GodotEditorControls } from './GodotEditorControls';
import { viewportActionsProbe } from './testing/ViewportActionsProbe';

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

/** Mounts the switcher beside the editor's own navigation, as `<TscnCanvas>` does. */
async function mountWithEditorCamera() {
  let get: (() => RootState) | null = null;
  function StateProbe() {
    get = useThree((s) => s.get);
    return null;
  }
  const { Probe, actions } = viewportActionsProbe();
  const tree = (camera: TscnNode | null) => (
    <HierarchyProvider value={{ sceneGraph: graph(), panelId: 'p' }}>
      <ViewportActionsProvider>
        <Probe />
        <StateProbe />
        {camera && <Camera3DInWorld node={camera} />}
        <ActiveCameraSwitcher />
        <GodotEditorControls />
      </ViewportActionsProvider>
    </HierarchyProvider>
  );
  const renderer = await ReactThreeTestRenderer.create(tree(cameraNode('0')));
  if (!get) throw new Error('expected the state probe to render, got no store');
  const state: () => RootState = get;
  /** Re-renders the scene with `camera` in place of the Camera3D, or with none. */
  const rerender = async (camera: TscnNode | null) => {
    await renderer.update(tree(camera));
    await act(async () => renderer.advanceFrames(1, 16));
  };
  return { state, actions, rerender };
}

describe('ActiveCameraSwitcher camera preview', () => {
  it('draws through the Camera3D while it is previewed', async () => {
    const { state, actions } = await mountWithEditorCamera();
    const editor = state().camera;

    await act(async () => actions().switchToCamera('Camera3D'));

    expect(state().camera).not.toBe(editor);
    expect(state().camera.userData).toMatchObject({ tscnPath: 'Camera3D' });
  });

  it('puts the editor camera back, at its own pose, when the preview ends', async () => {
    const { state, actions } = await mountWithEditorCamera();
    const editor = state().camera;
    const editorPose = editor.position.clone();
    await act(async () => actions().switchToCamera('Camera3D'));

    await act(async () => actions().returnToFreeView());

    expect(state().camera).toBe(editor);
    expect(editor.position.equals(editorPose)).toBe(true);
  });

  it('follows the previewed Camera3D when a projection change remounts it', async () => {
    const { state, actions, rerender } = await mountWithEditorCamera();
    await act(async () => actions().switchToCamera('Camera3D'));

    await rerender(cameraNode('1'));

    const camera = state().camera as CameraLike;
    expect(camera.isOrthographicCamera).toBe(true);
    expect(camera.parent).not.toBeNull();
  });

  it('ends the preview when the previewed Camera3D leaves the scene, as Godot does', async () => {
    const { state, actions, rerender } = await mountWithEditorCamera();
    const editor = state().camera;
    await act(async () => actions().switchToCamera('Camera3D'));

    await rerender(null);

    expect(state().camera).toBe(editor);
    expect(actions().activeCameraPath).toBeNull();
  });
});
