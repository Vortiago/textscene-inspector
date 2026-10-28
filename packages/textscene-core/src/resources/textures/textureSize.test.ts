/** The size Godot reports for a drawn texture, which a sized canvas consumer lays out by. */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { textureSize } from './textureSize';
import { unconfiguredViewportTexture } from './viewporttexture/unconfiguredViewportTexture';

describe('textureSize', () => {
  it("reports the image's size", () => {
    const texture = new THREE.DataTexture(new Uint8Array(6 * 2 * 4), 6, 2);
    expect(textureSize(texture)).toEqual({ width: 6, height: 2 });
  });

  /** `ViewportTexture::get_size` answers an empty size while no viewport is set (`viewport.cpp:156-160`). */
  it('reports 0 by 0 for a ViewportTexture its scene never sets up, a view of it too', () => {
    expect(textureSize(unconfiguredViewportTexture().clone())).toEqual({ width: 0, height: 0 });
  });

  it('reports nothing for a texture with no image yet (edge case)', () => {
    expect(textureSize(new THREE.Texture())).toBeUndefined();
  });

  it('reports nothing for no texture', () => {
    expect(textureSize(null)).toBeUndefined();
  });
});
