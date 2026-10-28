import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buttonIconSize } from './buttonIconSize';
import { unconfiguredViewportTexture } from '../../../../resources/textures/viewporttexture/unconfiguredViewportTexture';

describe('buttonIconSize', () => {
  it("is the icon's image size", () => {
    const icon = new THREE.DataTexture(new Uint8Array(24 * 12 * 4), 24, 12);
    expect(buttonIconSize(icon)).toEqual({ x: 24, y: 12 });
  });

  /** An icon of width 0 draws nothing (`button.cpp:369`). */
  it('is null for a ViewportTexture its scene never sets up, which reports size 0', () => {
    expect(buttonIconSize(unconfiguredViewportTexture().clone())).toBeNull();
  });

  it('is null for no icon', () => {
    expect(buttonIconSize(null)).toBeNull();
  });
});
