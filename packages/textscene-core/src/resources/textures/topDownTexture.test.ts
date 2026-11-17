import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { topDownTexture } from './topDownTexture';

/** Two rows of one texel: the bottom row reads 1, the top row 2. */
const bottomUp = () => new THREE.DataTexture(new Uint8Array([1, 1, 1, 1, 2, 2, 2, 2]), 1, 2);

const firstTexel = (texture: THREE.Texture) => (texture.image as { data: Uint8Array }).data[0];

describe('topDownTexture', () => {
  it('reverses the rows of a bottom-up typed array, so the top row comes first', () => {
    expect(firstTexel(topDownTexture(bottomUp()))).toBe(2);
  });

  it('keeps a texture whose rows already run top-down', () => {
    const image = new THREE.Texture();
    image.flipY = true;
    expect(topDownTexture(image)).toBe(image);
  });

  it('reverses again after the texture changes', () => {
    const texture = bottomUp();
    topDownTexture(texture);
    (texture.image as { data: Uint8Array }).data.set([3, 3, 3, 3, 4, 4, 4, 4]);
    texture.needsUpdate = true;
    expect(firstTexel(topDownTexture(texture))).toBe(4);
  });

  it('refills one copy on each change, so no stale copy stays behind', () => {
    const texture = bottomUp();
    const first = topDownTexture(texture);
    texture.needsUpdate = true;
    expect(topDownTexture(texture)).toBe(first);
  });

  it('raises the version of the copy on each refill, so a sampler that follows it reads the new rows', () => {
    const texture = bottomUp();
    const firstVersion = topDownTexture(texture).version;
    texture.needsUpdate = true;
    expect(topDownTexture(texture).version).toBeGreaterThan(firstVersion);
  });

  it('frees the copy with its source', () => {
    const texture = bottomUp();
    let isFreed = false;
    topDownTexture(texture).addEventListener('dispose', () => (isFreed = true));
    texture.dispose();
    expect(isFreed).toBe(true);
  });
});
