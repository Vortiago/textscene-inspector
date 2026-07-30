/**
 * `applyTextureState` — the clone-on-divergence helper both material paths share.
 *
 * The identity-equality contract is what these tests protect: `useResource`
 * hands every consumer of a path the SAME cached `THREE.Texture`, so a material
 * that needs different sampler state must clone rather than mutate, and a
 * material that needs none must get the original reference back.
 *
 * The case worth naming: a texture can diverge for TWO independent reasons (a UV
 * transform and a `texture_filter`), and it must still produce ONE clone.
 */

import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { applyTextureState, isMaterialOwnedTexture, type UVTransform } from './applyTextureState';
import { GODOT_ANISOTROPY_MAX } from './godotTextureFilter';

function uv(sx: number, sy: number, ox = 0, oy = 0): UVTransform {
  return { scale: { x: sx, y: sy }, offset: { x: ox, y: oy } };
}

describe('applyTextureState', () => {
  describe('no divergence', () => {
    it('returns the original reference when nothing diverges', () => {
      // Repeat wrapping is Godot's default, so a texture already carrying it
      // needs nothing of its own.
      const texture = new THREE.Texture();
      expect(applyTextureState(texture, {})).toBe(texture);
    });

    it("returns the original for Godot's default filter, which is three's state already", () => {
      const texture = new THREE.Texture();
      expect(applyTextureState(texture, { filter: 3 })).toBe(texture);
      expect(applyTextureState(texture, { filter: undefined })).toBe(texture);
    });

    it('returns the original for an identity UV transform', () => {
      const texture = new THREE.Texture();
      expect(applyTextureState(texture, { uv: uv(1, 1) })).toBe(texture);
    });

    it('treats values within the 1e-6 epsilon as identity', () => {
      const texture = new THREE.Texture();
      const result = applyTextureState(texture, { uv: uv(1 + 5e-7, 1 - 5e-7, 5e-7, -5e-7) });
      expect(result).toBe(texture);
    });

    it('mutates nothing on the pass-through path', () => {
      const texture = new THREE.Texture();
      applyTextureState(texture, { uv: uv(1, 1), filter: 3 });
      expect(texture.repeat.x).toBe(1);
      expect(texture.version).toBe(0);
    });
  });

  describe('UV divergence', () => {
    it('clones and sets repeat, offset and RepeatWrapping', () => {
      const texture = new THREE.Texture();
      const result = applyTextureState(texture, { uv: uv(3, 4, 0.5, -0.25) });

      expect(result).not.toBe(texture);
      expect(result.repeat.x).toBe(3);
      expect(result.repeat.y).toBe(4);
      expect(result.offset.x).toBe(0.5);
      expect(result.offset.y).toBe(-0.25);
      expect(result.wrapS).toBe(THREE.RepeatWrapping);
      expect(result.wrapT).toBe(THREE.RepeatWrapping);
    });

    it('clones just outside the epsilon, for scale or offset alone', () => {
      expect(applyTextureState(new THREE.Texture(), { uv: uv(1 + 1e-5, 1) }).repeat.x).toBeCloseTo(
        1 + 1e-5,
        10
      );
      expect(applyTextureState(new THREE.Texture(), { uv: uv(1, 1, 0, 1e-5) }).offset.y).toBeCloseTo(
        1e-5,
        10
      );
    });

    it('passes negative scales through verbatim (mirrored tiling)', () => {
      const result = applyTextureState(new THREE.Texture(), { uv: uv(-1, 1) });
      expect(result.repeat.x).toBe(-1);
    });

    it('leaves the original untouched and shares its image data', () => {
      const texture = new THREE.Texture();
      const image = { width: 4, height: 4 };
      texture.image = image;
      const result = applyTextureState(texture, { uv: uv(3, 4, 0.5, -0.25) });

      expect(result.image).toBe(image);
      expect(texture.repeat.x).toBe(1);
      expect(texture.offset.x).toBe(0);
      expect(texture.wrapS).toBe(THREE.ClampToEdgeWrapping);
      expect(texture.version).toBe(0);
    });

    it('flags the clone for re-upload', () => {
      expect(applyTextureState(new THREE.Texture(), { uv: uv(2, 2) }).version).toBeGreaterThanOrEqual(
        1
      );
    });
  });

  describe('textures that must never be cloned for filtering', () => {
    it('leaves a render-target texture alone even when its sampling differs', () => {
      // A ViewportTexture IS its render target's texture. Cloning it hands the
      // material a copy that no longer receives the target's renders — a frozen
      // frame. Its sampler state legitimately differs from Godot's material
      // default, so a naive "does it match row 3?" test would clone every one.
      const target = new THREE.WebGLRenderTarget(64, 64);
      expect(target.texture.isRenderTargetTexture).toBe(true);

      expect(applyTextureState(target.texture, { filter: 0 })).toBe(target.texture);
      expect(applyTextureState(target.texture, {})).toBe(target.texture);
    });

    it('does not clone merely because the source diverges from Godot\'s default', () => {
      // An unauthored `texture_filter` means "no opinion", not "force row 3".
      const texture = new THREE.Texture();
      texture.minFilter = THREE.LinearFilter;
      texture.generateMipmaps = false;

      expect(applyTextureState(texture, {})).toBe(texture);
      expect(applyTextureState(texture, { filter: undefined })).toBe(texture);
      expect(texture.minFilter).toBe(THREE.LinearFilter);
    });
  });

  describe('texture_repeat', () => {
    it('does not clone for the default, which the loader already applied', () => {
      // Godot's BaseMaterial3D constructs with FLAG_USE_TEXTURE_REPEAT = true,
      // so repeat is the shared default every material inherits — set once on
      // the loaded texture, not cloned per material. Cloning for it would break
      // texture identity for essentially every material in the corpus.
      const texture = new THREE.Texture();
      expect(applyTextureState(texture, {})).toBe(texture);
    });

    it('clones only when a material turns repeat OFF', () => {
      const texture = new THREE.Texture();
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;

      const result = applyTextureState(texture, { repeat: false });

      expect(result).not.toBe(texture);
      expect(result.wrapS).toBe(THREE.ClampToEdgeWrapping);
      expect(texture.wrapS).toBe(THREE.RepeatWrapping);
    });

    it('leaves a render target alone', () => {
      // Its wrapping is the target's business, and cloning detaches it.
      const target = new THREE.WebGLRenderTarget(8, 8);
      expect(applyTextureState(target.texture, { repeat: false })).toBe(target.texture);
    });
  });

  describe('filter divergence', () => {
    it('clones and writes the sampler state', () => {
      const texture = new THREE.Texture();
      const result = applyTextureState(texture, { filter: 0 });

      expect(result).not.toBe(texture);
      expect(result.magFilter).toBe(THREE.NearestFilter);
      expect(result.minFilter).toBe(THREE.NearestFilter);
      expect(result.generateMipmaps).toBe(false);
    });

    it('leaves the shared source sampling exactly as it was', () => {
      const texture = new THREE.Texture();
      applyTextureState(texture, { filter: 5 });

      expect(texture.magFilter).toBe(THREE.LinearFilter);
      expect(texture.anisotropy).toBe(1);
    });
  });

  describe('both reasons at once', () => {
    it('produces ONE clone carrying both, not a clone of a clone', () => {
      const texture = new THREE.Texture();
      const image = { width: 4, height: 4 };
      texture.image = image;

      const result = applyTextureState(texture, { uv: uv(2, 2), filter: 0 });

      expect(result).not.toBe(texture);
      expect(result.repeat.x).toBe(2);
      expect(result.magFilter).toBe(THREE.NearestFilter);
      // A second clone would have copied the first's image reference too, so
      // identity here is not the discriminator — the source being pristine is.
      expect(result.image).toBe(image);
      expect(texture.repeat.x).toBe(1);
      expect(texture.magFilter).toBe(THREE.LinearFilter);
    });
  });

  describe('cross-material contamination', () => {
    it('gives two materials sharing one image their own sampler state', () => {
      // The whole reason filter state is applied at material build rather than
      // at texture load: the loader caches ONE texture per path.
      const shared = new THREE.Texture();

      const nearest = applyTextureState(shared, { filter: 0 });
      const anisotropic = applyTextureState(shared, { filter: 5 });

      expect(nearest).not.toBe(anisotropic);
      expect(nearest.magFilter).toBe(THREE.NearestFilter);
      expect(anisotropic.anisotropy).toBe(GODOT_ANISOTROPY_MAX);
      expect(shared.magFilter).toBe(THREE.LinearFilter);
      expect(shared.anisotropy).toBe(1);
    });
  });

  describe('clone tagging', () => {
    it('tags clones so the owning material can dispose them', () => {
      const original = new THREE.Texture();
      const clone = applyTextureState(original, { filter: 0 });

      expect(isMaterialOwnedTexture(clone)).toBe(true);
      expect(isMaterialOwnedTexture(original)).toBe(false);
    });
  });
});
