/**
 * Unit tests for `applyUVTransform` — the clone-on-write UV helper.
 *
 * The identity-equality contract matters: cached textures are shared across
 * consumers, so the function must return the ORIGINAL reference when the
 * transform is identity, and a clone (leaving the original untouched) when
 * it is not. The function operates on a single texture; it has no
 * material-array overload.
 */

import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { applyUVTransform, type UVTransform } from './applyUVTransform';

function uv(sx: number, sy: number, ox: number, oy: number): UVTransform {
  return { scale: { x: sx, y: sy }, offset: { x: ox, y: oy } };
}

describe('applyUVTransform', () => {
  describe('identity transform', () => {
    it('returns the original texture reference for scale (1,1) / offset (0,0)', () => {
      const texture = new THREE.Texture();
      const result = applyUVTransform(texture, uv(1, 1, 0, 0));
      expect(result).toBe(texture);
    });

    it('does not mutate the texture on the identity path', () => {
      const texture = new THREE.Texture();
      applyUVTransform(texture, uv(1, 1, 0, 0));
      expect(texture.repeat.x).toBe(1);
      expect(texture.repeat.y).toBe(1);
      expect(texture.offset.x).toBe(0);
      expect(texture.offset.y).toBe(0);
      expect(texture.wrapS).toBe(THREE.ClampToEdgeWrapping);
      expect(texture.wrapT).toBe(THREE.ClampToEdgeWrapping);
      expect(texture.version).toBe(0);
    });

    it('treats values within the 1e-6 epsilon as identity', () => {
      const texture = new THREE.Texture();
      const result = applyUVTransform(
        texture,
        uv(1 + 5e-7, 1 - 5e-7, 5e-7, -5e-7)
      );
      expect(result).toBe(texture);
    });
  });

  describe('epsilon boundary', () => {
    it('clones when scale deviates just outside the epsilon', () => {
      const texture = new THREE.Texture();
      const result = applyUVTransform(texture, uv(1 + 1e-5, 1, 0, 0));
      expect(result).not.toBe(texture);
      expect(result.repeat.x).toBeCloseTo(1 + 1e-5, 10);
    });

    it('clones when offset deviates just outside the epsilon', () => {
      const texture = new THREE.Texture();
      const result = applyUVTransform(texture, uv(1, 1, 0, 1e-5));
      expect(result).not.toBe(texture);
      expect(result.offset.y).toBeCloseTo(1e-5, 10);
    });

    it('clones for a scale-only deviation (offset still zero)', () => {
      const texture = new THREE.Texture();
      const result = applyUVTransform(texture, uv(2, 2, 0, 0));
      expect(result).not.toBe(texture);
    });

    it('clones for an offset-only deviation (scale still identity)', () => {
      const texture = new THREE.Texture();
      const result = applyUVTransform(texture, uv(1, 1, 0.25, 0));
      expect(result).not.toBe(texture);
    });
  });

  describe('non-identity transform', () => {
    it('sets repeat, offset, and RepeatWrapping on the clone', () => {
      const texture = new THREE.Texture();
      const result = applyUVTransform(texture, uv(3, 4, 0.5, -0.25));
      expect(result.repeat.x).toBe(3);
      expect(result.repeat.y).toBe(4);
      expect(result.offset.x).toBe(0.5);
      expect(result.offset.y).toBe(-0.25);
      expect(result.wrapS).toBe(THREE.RepeatWrapping);
      expect(result.wrapT).toBe(THREE.RepeatWrapping);
    });

    it('flags the clone for re-upload (needsUpdate bumps version)', () => {
      const texture = new THREE.Texture();
      const result = applyUVTransform(texture, uv(2, 2, 0, 0));
      expect(result.version).toBeGreaterThanOrEqual(1);
    });

    it('leaves the original texture completely untouched', () => {
      const texture = new THREE.Texture();
      applyUVTransform(texture, uv(3, 4, 0.5, -0.25));
      expect(texture.repeat.x).toBe(1);
      expect(texture.repeat.y).toBe(1);
      expect(texture.offset.x).toBe(0);
      expect(texture.offset.y).toBe(0);
      expect(texture.wrapS).toBe(THREE.ClampToEdgeWrapping);
      expect(texture.wrapT).toBe(THREE.ClampToEdgeWrapping);
      expect(texture.version).toBe(0);
    });

    it('shares the underlying image data with the clone (memory-constant clone)', () => {
      const texture = new THREE.Texture();
      const image = { width: 4, height: 4 };
      texture.image = image;
      const result = applyUVTransform(texture, uv(2, 1, 0, 0));
      expect(result.image).toBe(image);
    });

    it('passes negative scales through verbatim (mirrored tiling)', () => {
      const texture = new THREE.Texture();
      const result = applyUVTransform(texture, uv(-1, 1, 0, 0));
      expect(result).not.toBe(texture);
      expect(result.repeat.x).toBe(-1);
      expect(result.repeat.y).toBe(1);
    });
  });
});
