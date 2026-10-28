/** The size Godot reports for a drawn texture, which a sized canvas consumer lays out by. */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { reportedArea, textureSize } from './textureSize';
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

describe('reportedArea', () => {
  it("is the texture's image size", () => {
    const icon = new THREE.DataTexture(new Uint8Array(24 * 12 * 4), 24, 12);
    expect(reportedArea(icon)).toEqual({ x: 24, y: 12 });
  });

  /** An icon of width 0 draws nothing (`button.cpp:369`). */
  it('is null for a ViewportTexture its scene never sets up, which reports size 0', () => {
    expect(reportedArea(unconfiguredViewportTexture().clone())).toBeNull();
  });

  it('is null for no texture', () => {
    expect(reportedArea(null)).toBeNull();
  });
});
