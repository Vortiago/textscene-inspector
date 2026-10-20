/**
 * The mark that tells a render target holding sRGB bytes from a texture R3F stamped with the same
 * sRGB tag.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { holdsSrgbBytes, markSrgbBytes } from './srgbByteTextures';

describe('markSrgbBytes', () => {
  it('marks the texture it is given and returns it', () => {
    const texture = new THREE.Texture();
    expect(markSrgbBytes(texture)).toBe(texture);
    expect(holdsSrgbBytes(texture)).toBe(true);
  });

  it('leaves a clone unmarked, since the clone holds no target storage (edge case)', () => {
    const texture = markSrgbBytes(new THREE.Texture());
    expect(holdsSrgbBytes(texture.clone())).toBe(false);
  });
});

describe('holdsSrgbBytes', () => {
  it('is false for an unmarked texture, whatever its tag', () => {
    const texture = new THREE.Texture();
    texture.colorSpace = THREE.SRGBColorSpace;
    expect(holdsSrgbBytes(texture)).toBe(false);
  });
});
