/**
 * Sprite3D is a GeometryInstance3D, so its `visibility_range_*` culls and fades the quad. The
 * distance is to its AABB centre, which a billboard moves onto the origin
 * (`sprite_3d.cpp:252-273`). Driven against a camera 11 units from the sprite's origin.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { Sprite3D } from './Component';
import { SceneResourcesProvider } from '../../../r3f/SceneResourcesContext';
import { ResourceLoaderProvider } from '../../../resources/ResourceLoaderContext';
import { createFakeResourceLoader } from '../../../resources/testing/createFakeResourceLoader';
import { parseSprite3D } from './parser';
import { heading } from '../../../parser/testing/parserKit';
import type { TscnNode } from '../../../parser/types';
import { findMesh } from '../testing/reactThreeTestInstance';

const TEXTURE_PATH = 'res://sprite.png';

function cameraAt11(): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(70, 1, 0.1, 1000);
  camera.position.set(0, 0, 11);
  camera.updateMatrixWorld(true);
  Object.assign(camera, { manual: true });
  return camera;
}

/** A 256 px texture at the default `pixel_size` of 0.01: a quad 2.56 wide. */
function texture(): THREE.Texture {
  const t = new THREE.Texture();
  (t as unknown as { image: { width: number; height: number } }).image = { width: 256, height: 256 };
  return t;
}

async function spriteMesh(raw: Record<string, string>): Promise<THREE.Mesh> {
  const node: TscnNode = {
    rawProperties: {},
    name: 'Sprite',
    type: 'Sprite3D',
    children: [],
    properties: parseSprite3D(heading('Sprite3D', { name: 'Sprite' }), {
      texture: 'ExtResource("1")',
      ...raw,
    }),
  };
  const fake = createFakeResourceLoader();
  fake.textures.seed(TEXTURE_PATH, texture());
  const renderer = await ReactThreeTestRenderer.create(
    <ResourceLoaderProvider loader={fake.loader}>
      <SceneResourcesProvider externalResources={[{ id: '1', type: 'Texture2D', path: TEXTURE_PATH }]}>
        <Sprite3D node={node} />
      </SceneResourcesProvider>
    </ResourceLoaderProvider>,
    { camera: cameraAt11() }
  );
  await renderer.advanceFrames(2, 16);
  // The frame callback sets state, and this act commits the render it schedules.
  await ReactThreeTestRenderer.act(async () => {});
  return findMesh(renderer.scene) as unknown as THREE.Mesh;
}

describe('<Sprite3D> visibility range', () => {
  it('draws a sprite inside its range', async () => {
    expect((await spriteMesh({ visibility_range_end: '20.0' })).visible).toBe(true);
  });

  it('hides a sprite past its end', async () => {
    expect((await spriteMesh({ visibility_range_end: '10.0' })).visible).toBe(false);
  });

  it('blends a SELF sprite at the eased alpha across its end margin', async () => {
    // smoothstep(1 - (11 - 8) / 4) = 0.15625, and 0.15625 × 255 = 39.84 truncates to 39.
    const mesh = await spriteMesh({
      visibility_range_end: '10.0',
      visibility_range_end_margin: '2.0',
      visibility_range_fade_mode: '1',
    });
    expect(mesh.material).toMatchObject({ transparent: true, opacity: 39 / 255 });
  });

  it("measures an uncentred quad to its box's centre", async () => {
    // The quad's centre is (1.28, -1.28, 0), √(2 × 1.28² + 11²) ≈ 11.148 away, past an end of 11.1.
    expect((await spriteMesh({ centered: 'false', visibility_range_end: '11.1' })).visible).toBe(false);
  });

  it('measures a billboard to its origin, 11 away, inside an end of 11.1', async () => {
    const mesh = await spriteMesh({ centered: 'false', billboard: '1', visibility_range_end: '11.1' });
    expect(mesh.visible).toBe(true);
  });
});
