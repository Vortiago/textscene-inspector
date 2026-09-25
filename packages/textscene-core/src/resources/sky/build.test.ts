import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { skyPanoramaTexture } from './build';

describe('skyPanoramaTexture', () => {
  it('tiles a clamped panorama on a source-shared clone', () => {
    // The panorama shader samples with `fract(atan(...))`, so u wraps 0..1 and
    // needs Repeat wrapping. The loader's shared entry is clamp, so the sky
    // clones it rather than mutating the entry a 2D consumer shares.
    const shared = new THREE.Texture();
    const tiled = skyPanoramaTexture(shared);
    expect(tiled).not.toBe(shared);
    expect(tiled!.wrapS).toBe(THREE.RepeatWrapping);
    expect(tiled!.wrapT).toBe(THREE.RepeatWrapping);
    expect(tiled!.source).toBe(shared.source);
    expect(shared.wrapS).toBe(THREE.ClampToEdgeWrapping);
  });

  it('returns null when the sky has no panorama', () => {
    expect(skyPanoramaTexture(null)).toBeNull();
    expect(skyPanoramaTexture(undefined)).toBeNull();
  });
});
