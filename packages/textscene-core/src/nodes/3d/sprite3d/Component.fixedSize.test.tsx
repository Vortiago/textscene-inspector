/**
 * `fixed_size` — the vertex rescale `FLAG_FIXED_SIZE` emits
 * (`scene/resources/material.cpp:1357-1381`), which keeps the sprite quad the
 * same size on screen however far away it is. Parsed since the slice landed
 * and honoured by nothing, exactly as `billboard` once was; ported alongside
 * Label3D's, which sets the same flag on the same cached shader.
 *
 * Driven against an explicit camera per frame, the same shape
 * `Component.billboard.test.tsx` uses for this node's other per-frame effect.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { Sprite3D } from './Component';
import { parseSprite3D } from './parser';
import { SceneResourcesProvider } from '../../../r3f/SceneResourcesContext';
import { ResourceLoaderProvider } from '../../../resources/ResourceLoaderContext';
import { createFakeResourceLoader } from '../../../resources/testing/createFakeResourceLoader';
import type { TscnNode } from '../../../parser/types';

const heading = { type: 'node', attributes: { name: 'Sprite', type: 'Sprite3D' } };
const EXTERNALS = [{ id: '1_tex', path: 'res://sprite.png', type: 'Texture2D' }] as const;

function node(raw: Record<string, string> = {}): TscnNode {
  return {
    name: 'Sprite',
    type: 'Sprite3D',
    children: [],
    properties: parseSprite3D(heading, { texture: 'ExtResource("1_tex")', ...raw }),
  };
}

/** A camera 5 units back down -Z, so a node at world z=0 sits 5 units in front of it. */
function perspective(): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(70, 1.6, 0.1, 1000);
  camera.position.set(0, 0, 5);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
  // Without `manual`, R3F rewrites the projection from the canvas size.
  Object.assign(camera, { manual: true });
  return camera;
}

/** `top - bottom = 4`, so `PROJECTION_MATRIX[1][1] = 0.5`. */
function orthographic(): THREE.OrthographicCamera {
  const camera = new THREE.OrthographicCamera(-2, 2, 2, -2, 0.1, 1000);
  camera.position.set(0, 0, 5);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
  // Without `manual`, R3F rewrites the projection from the canvas size.
  Object.assign(camera, { manual: true });
  return camera;
}

async function spriteAfterFrame(raw: Record<string, string>, camera: THREE.PerspectiveCamera | THREE.OrthographicCamera) {
  const fake = createFakeResourceLoader();
  const renderer = await ReactThreeTestRenderer.create(
    <ResourceLoaderProvider loader={fake.loader}>
      <SceneResourcesProvider internalResources={[]} externalResources={[...EXTERNALS]}>
        <Sprite3D node={node(raw)} />
      </SceneResourcesProvider>
    </ResourceLoaderProvider>,
    { camera }
  );
  await renderer.advanceFrames(2, 16);
  return renderer.scene.children[0]!.instance as THREE.Object3D;
}

const AT_ORIGIN = 'Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0)';
const TWO_TOWARDS_CAMERA = 'Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 2)';

describe('<Sprite3D> fixed_size', () => {
  it('leaves the authored scale alone when fixed_size is false (the default)', async () => {
    const object = await spriteAfterFrame({ transform: AT_ORIGIN }, perspective());
    expect(object.scale.x).toBeCloseTo(1, 6);
  });

  it('scales by the view-space depth under a perspective camera', async () => {
    // `material.cpp:1375`: `sc = -(MODELVIEW_MATRIX)[3].z`, the node origin's
    // own view-space depth. Camera at z=5 looking down -Z: a node at z=0 is 5
    // units in front of it, one at z=2 only 3.
    const far = await spriteAfterFrame({ fixed_size: 'true', transform: AT_ORIGIN }, perspective());
    expect(far.scale.x).toBeCloseTo(5, 5);
    expect(far.scale.y).toBeCloseTo(5, 5);
    expect(far.scale.z).toBeCloseTo(5, 5);

    const near = await spriteAfterFrame(
      { fixed_size: 'true', transform: TWO_TOWARDS_CAMERA },
      perspective()
    );
    expect(near.scale.x).toBeCloseTo(3, 5);
  });

  it('scales by the viewport half-height under an orthographic camera, not by depth', async () => {
    // `material.cpp:1361-1364`: `h = abs(1/(2*PROJECTION_MATRIX[1][1]))`, then
    // `sc = h * 2`. With top-bottom = 4, `PROJECTION_MATRIX[1][1]` is 0.5, so
    // `h` is 1 and `sc` is 2 — the same at every depth, unlike the arm above.
    const atOrigin = await spriteAfterFrame({ fixed_size: 'true', transform: AT_ORIGIN }, orthographic());
    expect(atOrigin.scale.x).toBeCloseTo(2, 5);

    const nearer = await spriteAfterFrame(
      { fixed_size: 'true', transform: TWO_TOWARDS_CAMERA },
      orthographic()
    );
    expect(nearer.scale.x).toBeCloseTo(2, 5);
  });

  it('multiplies the AUTHORED scale rather than replacing it, and never compounds across frames', async () => {
    const fake = createFakeResourceLoader();
    const renderer = await ReactThreeTestRenderer.create(
      <ResourceLoaderProvider loader={fake.loader}>
        <SceneResourcesProvider internalResources={[]} externalResources={[...EXTERNALS]}>
          <Sprite3D
            node={node({
              fixed_size: 'true',
              transform: 'Transform3D(0.5, 0, 0, 0, 0.5, 0, 0, 0, 0.5, 0, 0, 0)',
            })}
          />
        </SceneResourcesProvider>
      </ResourceLoaderProvider>,
      { camera: perspective() }
    );
    await renderer.advanceFrames(2, 16);
    const object = renderer.scene.children[0]!.instance as THREE.Object3D;
    expect(object.scale.x).toBeCloseTo(2.5, 5);
    await renderer.advanceFrames(8, 16);
    expect(object.scale.x).toBeCloseTo(2.5, 5);
  });
});
