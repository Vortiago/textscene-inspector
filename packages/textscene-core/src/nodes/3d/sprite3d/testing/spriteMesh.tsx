/**
 * A Sprite3D quad mounted from raw `.tscn` properties, with a 256 px texture at the default
 * `pixel_size` of 0.01, so a quad 2.56 wide, and drawn once from 11 units in front of its origin.
 * Test-only: the build excludes the `testing/` directories under `src`.
 */
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { SceneResourcesProvider } from '../../../../r3f/SceneResourcesContext';
import { ResourceLoaderProvider } from '../../../../resources/ResourceLoaderContext';
import { createFakeResourceLoader } from '../../../../resources/testing/createFakeResourceLoader';
import { parseSprite3D } from '../parser';
import { heading } from '../../../../parser/testing/parserKit';
import type { TscnNode } from '../../../../parser/types';
import { findMesh } from '../../testing/reactThreeTestInstance';
import { manualCameraAt, renderScene } from '../../../../r3f/testing/renderScene';
import '../index.r3f';
import { registeredComponent } from '../../../../r3f/testing/registeredComponent';

const Sprite3D = registeredComponent('Sprite3D');

const TEXTURE_PATH = 'res://sprite.png';

function texture(): THREE.Texture {
  const t = new THREE.Texture();
  (t as unknown as { image: { width: number; height: number } }).image = { width: 256, height: 256 };
  return t;
}

export async function spriteMesh(raw: Record<string, string>): Promise<THREE.Mesh> {
  const rawProperties = { texture: 'ExtResource("1")', ...raw };
  const node: TscnNode = {
    rawProperties,
    name: 'Sprite',
    type: 'Sprite3D',
    children: [],
    properties: parseSprite3D(heading('Sprite3D', { name: 'Sprite' }), rawProperties),
  };
  const fake = createFakeResourceLoader();
  fake.textures.seed(TEXTURE_PATH, texture());
  const camera = manualCameraAt({ x: 0, y: 0, z: 11 });
  const renderer = await ReactThreeTestRenderer.create(
    <ResourceLoaderProvider loader={fake.loader}>
      <SceneResourcesProvider externalResources={[{ id: '1', type: 'Texture2D', path: TEXTURE_PATH }]}>
        <Sprite3D node={node} />
      </SceneResourcesProvider>
    </ResourceLoaderProvider>,
    { camera }
  );
  await renderScene(renderer, camera);
  return findMesh(renderer.scene) as unknown as THREE.Mesh;
}
