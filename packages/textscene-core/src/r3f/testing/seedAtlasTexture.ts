/** Seeds a 64 by 64 atlas texture at `res://tiles.png`, which a tile row needs to draw a mesh. */
import * as THREE from 'three';
import type { FakeResourceLoader } from '../../resources/testing/createFakeResourceLoader';

export function seedAtlasTexture(fake: FakeResourceLoader): void {
  const atlas = new THREE.Texture();
  (atlas as unknown as { image: { width: number; height: number } }).image = { width: 64, height: 64 };
  fake.textures.seed('res://tiles.png', atlas);
}
