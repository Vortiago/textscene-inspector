/**
 * Tests the Parallax2D wiring: where the scroll position lands, which screen offset feeds it, and
 * the repeat copies. The arithmetic is in `parallax2dScroll.test.ts`.
 */

import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type { TscnNode } from '../../../parser/types';
import type { Camera2DTag } from '../camera2d/cameraView';
import { Camera2DAnchorMode } from '../../../godot/scene/camera2d';
import { fireSceneRender } from '../../../r3f/testing/fireSceneRender';
import { createViewportCanvasCamera } from '../../../r3f/sceneRenderCamera';
import { heading } from '../../../parser/testing/parserKit';
import { Parallax2D } from './Component';
import { parseParallax2D } from './parser';

function parallaxNode(properties: Record<string, string> = {}, children: TscnNode[] = []): TscnNode {
  return {
    rawProperties: {},
    name: 'P',
    type: 'Parallax2D',
    children,
    properties: parseParallax2D(heading('Parallax2D', { name: 'P' }), properties),
  };
}

const CAMERA_TAG: Camera2DTag = {
  enabled: true,
  zoom: { x: 1, y: 1 },
  offset: { x: 0, y: 0 },
  anchor_mode: Camera2DAnchorMode.DRAG_CENTER,
  limitLeft: -10000000,
  limitTop: -10000000,
  limitRight: 10000000,
  limitBottom: 10000000,
  limitEnabled: true,
};

/** The 1152x648 view a Camera2D at (600, 400) frames: top-left (24, 76) in canvas pixels. */
function viewportPassCamera(): THREE.OrthographicCamera {
  const camera = createViewportCanvasCamera();
  Object.assign(camera, { left: -576, right: 576, top: 324, bottom: -324, near: 0.1, far: 4000 });
  camera.position.set(600, -400, 1000);
  camera.updateProjectionMatrix();
  return camera;
}

function StoreCamera({ into }: { into: { current: THREE.Camera | null } }) {
  into.current = useThree((state) => state.camera);
  return null;
}

const SCROLLED = { scroll_scale: 'Vector2(0.5, 0.5)', screen_offset: 'Vector2(50, 0)' };

/** The delta group `Parallax2D` writes: the scroll position less the authored one. */
function deltaGroup(scene: THREE.Object3D): THREE.Object3D {
  return scene.getObjectByName('P')!.parent!;
}

describe('<Parallax2D>', () => {
  /** Renders a Parallax2D beside a Camera2D at (600, 400) and fires one pass, on the stage or in a viewport. */
  async function scrolledGroup(properties: Record<string, string>, pass: 'stage' | 'viewport') {
    const storeCamera = { current: null as THREE.Camera | null };
    const renderer = await ReactThreeTestRenderer.create(
      <>
        <StoreCamera into={storeCamera} />
        <group userData={{ camera2d: CAMERA_TAG }} position={[600, -400, 0]} />
        <Parallax2D node={parallaxNode(properties)} />
      </>
    );
    const scene = renderer.scene.instance;
    if (pass === 'stage') fireSceneRender(scene, storeCamera.current!);
    else fireSceneRender(scene, viewportPassCamera(), new THREE.WebGLRenderTarget(1152, 648));
    return deltaGroup(scene);
  }

  it('uses the authored screen_offset on the main 2D stage, which frames no camera', async () => {
    const group = await scrolledGroup(SCROLLED, 'stage');
    // Godot: screen_offset (50, 0) at scroll_scale 0.5 puts the node at 50 - 25.
    expect(group.position.x).toBe(25);
    expect(group.position.y).toBe(0);
  });

  it('takes the screen_offset from the current Camera2D in a sub-viewport pass', async () => {
    const group = await scrolledGroup(SCROLLED, 'viewport');
    // camera_screen_center (600, 400) - 0.5 * (1152, 648) = (24, 76); half of it is the scroll.
    expect(group.position.x).toBe(12);
    expect(group.position.y).toBe(-38);
  });

  it('keeps the authored screen_offset under ignore_camera_scroll', async () => {
    const group = await scrolledGroup({ ...SCROLLED, ignore_camera_scroll: 'true' }, 'viewport');
    expect(group.position.x).toBe(25);
  });

  it('replaces the authored position, so the delta cancels it', async () => {
    const storeCamera = { current: null as THREE.Camera | null };
    const renderer = await ReactThreeTestRenderer.create(
      <>
        <StoreCamera into={storeCamera} />
        <Parallax2D node={parallaxNode({ ...SCROLLED, position: 'Vector2(40, 10)' })} />
      </>
    );
    const scene = renderer.scene.instance;
    fireSceneRender(scene, storeCamera.current!);
    scene.updateMatrixWorld();

    const world = new THREE.Vector3().setFromMatrixPosition(scene.getObjectByName('P')!.matrixWorld);
    expect(world.x).toBe(25);
    expect(world.y).toBe(0);
  });

  it('draws repeat_times + 1 copies, the unrepeated one last', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <Parallax2D node={parallaxNode({ repeat_size: 'Vector2(200, 0)', repeat_times: '3' })}>
        <group name="Child" />
      </Parallax2D>
    );
    const copies = renderer.scene.instance.getObjectByName('P')!.children.map((copy) => copy.position.x);
    expect(copies).toEqual([-200, 200, 400, 0]);
  });

  it('draws a nested repeat source once, by its own settings', async () => {
    const inner = parallaxNode({ repeat_size: 'Vector2(0, 50)' });
    inner.name = 'Inner';
    const renderer = await ReactThreeTestRenderer.create(
      <Parallax2D node={parallaxNode({ repeat_size: 'Vector2(200, 0)', repeat_times: '2' })}>
        <Parallax2D node={inner} />
      </Parallax2D>
    );
    expect(renderer.scene.instance.getObjectsByProperty('name', 'Inner')).toHaveLength(1);
  });
});
