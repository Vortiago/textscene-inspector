/**
 * The rendered half of the parallax model. The pure arithmetic is pinned in
 * `parallaxScroll.test.ts`; what is asserted here is the wiring the arithmetic
 * hangs off — the cut transform chain, the view anchor, and the two surfaces
 * telling themselves apart by which camera the render uses.
 */

import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type { TscnNode } from '../../../parser/types';
import { Camera2DAnchorMode } from '../camera2d/types';
import type { Camera2DTag } from '../camera2d/cameraView';
import { parseParallaxLayer } from '../parallaxlayer/parser';
import { ParallaxLayer } from '../parallaxlayer/Component';
import { NodePathProvider } from '../../../r3f/contexts/NodePathContext';
import { parseParallaxBackground } from './parser';
import { ParallaxBackground } from './Component';

function backgroundNode(properties: Record<string, string> = {}): TscnNode {
  return {
    name: 'BG',
    type: 'ParallaxBackground',
    children: [],
    properties: parseParallaxBackground(
      { type: 'node', attributes: { type: 'ParallaxBackground', name: 'BG' } },
      properties
    ),
  };
}

function layerNode(name: string, properties: Record<string, string> = {}): TscnNode {
  return {
    name,
    type: 'ParallaxLayer',
    children: [],
    properties: parseParallaxLayer({ type: 'node', attributes: { name } }, properties),
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

/**
 * The 1152x648 view a Camera2D at (600, 400) frames — the exact rect
 * `orthoFrameForCamera2D` produces, and the one the Godot probe measured, so
 * its top-left is (24, 76) in Godot canvas pixels.
 */
function viewportPassCamera(): THREE.OrthographicCamera {
  const camera = new THREE.OrthographicCamera(-576, 576, 324, -324, 0.1, 4000);
  camera.position.set(600, -400, 1000);
  return camera;
}

/**
 * The store's camera, which the test renderer does not expose. Rendering
 * through it is what tells the component it is on the free 2D stage rather than
 * in a sub-viewport's pass.
 */
function StoreCamera({ into }: { into: { current: THREE.Camera | null } }) {
  into.current = useThree((state) => state.camera);
  return null;
}

/** What `WebGLRenderer.render` calls before it builds its render list. */
function fireRender(scene: THREE.Object3D, camera: THREE.Camera) {
  scene.onBeforeRender(
    null as unknown as THREE.WebGLRenderer,
    scene as THREE.Scene,
    camera,
    null as unknown as THREE.BufferGeometry,
    null as unknown as THREE.Material,
    null as unknown as THREE.Group
  );
}

describe('<ParallaxBackground>', () => {
  it('renders children inside its group', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <ParallaxBackground node={backgroundNode()}>
        <mesh name="child">
          <boxGeometry />
          <meshBasicMaterial />
        </mesh>
      </ParallaxBackground>
    );
    expect(renderer.scene.findByProps({ name: 'child' })).toBeDefined();
  });

  it('ignores the ancestor transform chain, like a CanvasLayer attached to the viewport', async () => {
    const storeCamera = { current: null as THREE.Camera | null };
    const renderer = await ReactThreeTestRenderer.create(
      <>
        <StoreCamera into={storeCamera} />
        <group position={[300, -200, 0]}>
          <ParallaxBackground node={backgroundNode({ offset: 'Vector2(0, 40)' })} />
        </group>
      </>
    );
    const scene = renderer.scene.instance;
    fireRender(scene, storeCamera.current!);

    const group = scene.getObjectByName('BG')!;
    const world = new THREE.Vector3().setFromMatrixPosition(group.matrixWorld);
    // Its own `offset` applies (Godot y-down → three -40); the parent's
    // (300, -200) does not.
    expect(world.x).toBe(0);
    expect(world.y).toBe(-40);
  });

  it('anchors to the view corner when a sub-viewport pass renders through a Camera2D', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <>
        <group userData={{ camera2d: CAMERA_TAG }} position={[600, -400, 0]} />
        <ParallaxBackground node={backgroundNode()} />
      </>
    );
    const scene = renderer.scene.instance;
    fireRender(scene, viewportPassCamera());

    const world = new THREE.Vector3().setFromMatrixPosition(scene.getObjectByName('BG')!.matrixWorld);
    expect(world.x).toBe(24);
    expect(world.y).toBe(-76);
  });

  it('keeps the world origin when the canvas renders through its own free camera', async () => {
    // The 2D stage: same scene, same Camera2D, but the render uses the store's
    // camera, which carries no Godot canvas transform.
    const storeCamera = { current: null as THREE.Camera | null };
    const renderer = await ReactThreeTestRenderer.create(
      <>
        <StoreCamera into={storeCamera} />
        <group userData={{ camera2d: CAMERA_TAG }} position={[600, -400, 0]} />
        <ParallaxBackground node={backgroundNode()} />
      </>
    );
    const scene = renderer.scene.instance;
    fireRender(scene, storeCamera.current!);

    const world = new THREE.Vector3().setFromMatrixPosition(scene.getObjectByName('BG')!.matrixWorld);
    expect(world.x).toBe(0);
    expect(world.y).toBe(0);
  });

  it('poses its direct ParallaxLayer children and leaves nested ones alone', async () => {
    // motion_scale 1 = "stays put in the world", so its delta has to undo the
    // whole view anchor: (-24, -76) in Godot space, +76 once Y is negated.
    const worldFixed = layerNode('WorldFixed', { motion_scale: 'Vector2(1, 1)' });
    const nested = layerNode('Nested', { motion_scale: 'Vector2(1, 1)' });
    const renderer = await ReactThreeTestRenderer.create(
      <>
        <group userData={{ camera2d: CAMERA_TAG }} position={[600, -400, 0]} />
        <NodePathProvider path="BG">
          <ParallaxBackground node={backgroundNode()}>
            <NodePathProvider path="BG/WorldFixed">
              <ParallaxLayer node={worldFixed} />
            </NodePathProvider>
            <NodePathProvider path="BG/Holder/Nested">
              <ParallaxLayer node={nested} />
            </NodePathProvider>
          </ParallaxBackground>
        </NodePathProvider>
      </>
    );
    const scene = renderer.scene.instance;
    fireRender(scene, viewportPassCamera());

    const wrappers = scene
      .getObjectByName('BG')!
      .children.filter((child) => child.type === 'Group');
    expect(wrappers[0]!.position.x).toBe(-24);
    expect(wrappers[0]!.position.y).toBe(76);
    // `_update_scroll` only walks direct children, so the nested one keeps the
    // background's own anchor and scrolls WITH the view.
    expect(wrappers[1]!.position.x).toBe(0);
    expect(wrappers[1]!.position.y).toBe(0);
  });

  it('does not scroll on the free 2D stage even when the scene holds a Camera2D', async () => {
    // The corpus shape this guards is `game_singleplayer.tscn`: a
    // ParallaxBackground and an enabled Camera2D in the SAME root scene, drawn
    // on the stage. Godot's editor never applies the canvas transform there and
    // `ref:godot` disables the camera to match, so the layers must stay put —
    // losing the "is this a viewport pass" branch would slide the platformer's
    // clouds 550 px left on its `motion_offset` alone.
    const storeCamera = { current: null as THREE.Camera | null };
    const layer = layerNode('Clouds', {
      motion_scale: 'Vector2(0.1, 1)',
      motion_offset: 'Vector2(-550, 0)',
    });
    const renderer = await ReactThreeTestRenderer.create(
      <>
        <StoreCamera into={storeCamera} />
        <group userData={{ camera2d: CAMERA_TAG }} position={[600, -400, 0]} />
        <NodePathProvider path="BG">
          <ParallaxBackground node={backgroundNode({ scroll_base_scale: 'Vector2(0.1, 0)' })}>
            <NodePathProvider path="BG/Clouds">
              <ParallaxLayer node={layer} />
            </NodePathProvider>
          </ParallaxBackground>
        </NodePathProvider>
      </>
    );
    const scene = renderer.scene.instance;
    fireRender(scene, storeCamera.current!);

    const wrapper = scene.getObjectByName('BG')!.children.find((c) => c.type === 'Group')!;
    expect(wrapper.position.x).toBe(0);
    expect(wrapper.position.y).toBe(0);
    expect(wrapper.scale.x).toBe(1);
  });

  it('leaves every layer at its authored pose when no Camera2D is current', async () => {
    // Godot never calls `set_base_offset_and_scale` without one, so
    // motion_scale is inert — measured, not assumed.
    const layer = layerNode('Sky', { motion_scale: 'Vector2(0, 0)' });
    const renderer = await ReactThreeTestRenderer.create(
      <NodePathProvider path="BG">
        <ParallaxBackground node={backgroundNode({ scroll_base_offset: 'Vector2(0, 200)' })}>
          <NodePathProvider path="BG/Sky">
            <ParallaxLayer node={layer} />
          </NodePathProvider>
        </ParallaxBackground>
      </NodePathProvider>
    );
    const scene = renderer.scene.instance;
    fireRender(scene, viewportPassCamera());

    const wrapper = scene.getObjectByName('BG')!.children.find((c) => c.type === 'Group')!;
    expect(wrapper.position.x).toBe(0);
    expect(wrapper.position.y).toBe(0);
    expect(wrapper.scale.x).toBe(1);
  });

  it('pushes its CanvasLayer `layer` onto the subtree as renderOrder', async () => {
    const storeCamera = { current: null as THREE.Camera | null };
    const renderer = await ReactThreeTestRenderer.create(
      <>
        <StoreCamera into={storeCamera} />
        <ParallaxBackground node={backgroundNode()}>
          <mesh name="art">
            <boxGeometry />
            <meshBasicMaterial />
          </mesh>
        </ParallaxBackground>
      </>
    );
    const scene = renderer.scene.instance;
    fireRender(scene, storeCamera.current!);

    expect(scene.getObjectByName('art')!.renderOrder).toBe(-100);
  });
});
