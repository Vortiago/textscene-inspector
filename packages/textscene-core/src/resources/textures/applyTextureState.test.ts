/**
 * `applyTextureState` protects the identity-equality contract: a material that
 * needs different sampler state gets one clone, however many reasons diverge,
 * and a material that needs none gets the original. Which colour space a slot
 * requires is tested in `standardmaterial3d/textureBinding.ts`.
 */

import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  applyTextureState,
  isMaterialOwnedTexture,
  type MaterialTextureState,
  type UVTransform,
} from './applyTextureState';
import { GODOT_ANISOTROPY_MAX } from './godotTextureFilter';

function uv(sx: number, sy: number, ox = 0, oy = 0): UVTransform {
  return { scale: { x: sx, y: sy }, offset: { x: ox, y: oy } };
}

/**
 * A state whose colour space matches a fresh `THREE.Texture`'s, so a case about
 * UV, filter or wrapping isolates that reason alone. The colour-space cases
 * below name theirs.
 */
function state(material: MaterialTextureState = {}) {
  return { ...material, colorSpace: THREE.NoColorSpace };
}

/**
 * A texture already carrying the default binding's Repeat wrapping. A case about
 * UV, filter or colour space starts from here so it isolates that reason and not
 * the wrap: a default material tiles, so a clamped arrival would clone for
 * wrapping before any of these reasons were reached.
 */
function tiling(): THREE.Texture {
  const texture = new THREE.Texture();
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

describe('applyTextureState', () => {
  describe('no divergence', () => {
    it('returns the original reference when nothing diverges', () => {
      // Repeat wrapping is Godot's default, so a texture already carrying it
      // needs nothing of its own.
      const texture = tiling();
      expect(applyTextureState(texture, state({}))).toBe(texture);
    });

    it("returns the original for Godot's default filter, which is three's state already", () => {
      const texture = tiling();
      expect(applyTextureState(texture, state({ filter: 3 }))).toBe(texture);
      expect(applyTextureState(texture, state({ filter: undefined }))).toBe(texture);
    });

    it('returns the original for an identity UV transform', () => {
      const texture = tiling();
      expect(applyTextureState(texture, state({ uv: uv(1, 1) }))).toBe(texture);
    });

    it('treats values within the 1e-6 epsilon as identity', () => {
      const texture = tiling();
      const result = applyTextureState(texture, state({ uv: uv(1 + 5e-7, 1 - 5e-7, 5e-7, -5e-7) }));
      expect(result).toBe(texture);
    });

    it('mutates nothing on the pass-through path', () => {
      const texture = tiling();
      applyTextureState(texture, state({ uv: uv(1, 1), filter: 3 }));
      expect(texture.repeat.x).toBe(1);
      expect(texture.version).toBe(0);
    });
  });

  describe('UV divergence', () => {
    it('clones and sets repeat, offset and RepeatWrapping', () => {
      const texture = new THREE.Texture();
      const result = applyTextureState(texture, state({ uv: uv(3, 4, 0.5, -0.25) }));

      expect(result).not.toBe(texture);
      expect(result.repeat.x).toBe(3);
      expect(result.repeat.y).toBe(4);
      expect(result.offset.x).toBe(0.5);
      expect(result.offset.y).toBe(-0.25);
      expect(result.wrapS).toBe(THREE.RepeatWrapping);
      expect(result.wrapT).toBe(THREE.RepeatWrapping);
    });

    it('clones just outside the epsilon, for scale or offset alone', () => {
      expect(applyTextureState(new THREE.Texture(), state({ uv: uv(1 + 1e-5, 1) })).repeat.x).toBeCloseTo(
        1 + 1e-5,
        10
      );
      expect(applyTextureState(new THREE.Texture(), state({ uv: uv(1, 1, 0, 1e-5) })).offset.y).toBeCloseTo(
        1e-5,
        10
      );
    });

    it('passes negative scales through verbatim (mirrored tiling)', () => {
      const result = applyTextureState(new THREE.Texture(), state({ uv: uv(-1, 1) }));
      expect(result.repeat.x).toBe(-1);
    });

    it('leaves the original untouched and shares its image data', () => {
      const texture = new THREE.Texture();
      const image = { width: 4, height: 4 };
      texture.image = image;
      const result = applyTextureState(texture, state({ uv: uv(3, 4, 0.5, -0.25) }));

      expect(result.image).toBe(image);
      expect(texture.repeat.x).toBe(1);
      expect(texture.offset.x).toBe(0);
      expect(texture.wrapS).toBe(THREE.ClampToEdgeWrapping);
      expect(texture.version).toBe(0);
    });

    it('flags the clone for re-upload', () => {
      expect(applyTextureState(new THREE.Texture(), state({ uv: uv(2, 2) })).version).toBeGreaterThanOrEqual(
        1
      );
    });
  });

  describe('textures that must never be cloned for filtering', () => {
    it('leaves a render-target texture alone even when its sampling differs', () => {
      // A ViewportTexture is its render target's texture, and a clone is a frozen
      // frame. Its sampler state differs from Godot's default, so a naive match
      // test would clone every one.
      const target = new THREE.WebGLRenderTarget(64, 64);
      expect(target.texture.isRenderTargetTexture).toBe(true);

      expect(applyTextureState(target.texture, state({ filter: 0 }))).toBe(target.texture);
      expect(applyTextureState(target.texture, state({}))).toBe(target.texture);
      // The same holds for the UV transform.
      expect(
        applyTextureState(
          target.texture,
          state({ uv: { scale: { x: 4, y: 4 }, offset: { x: 0, y: 0 } } })
        )
      ).toBe(target.texture);
    });

    it('does not clone merely because the source diverges from Godot\'s default', () => {
      // An unauthored `texture_filter` means "no opinion", not "force row 3".
      const texture = tiling();
      texture.minFilter = THREE.LinearFilter;
      texture.generateMipmaps = false;

      expect(applyTextureState(texture, state({}))).toBe(texture);
      expect(applyTextureState(texture, state({ filter: undefined }))).toBe(texture);
      expect(texture.minFilter).toBe(THREE.LinearFilter);
    });
  });

  describe('texture_repeat', () => {
    it('clones a clamped arrival to Repeat for the default, Godot\'s repeat', () => {
      // The loader ships three's clamp default. A default material asks for
      // Repeat (`BaseMaterial3D` FLAG_USE_TEXTURE_REPEAT = true), so the binding
      // clones to tile it, which guards against terrain stripes. The shared entry
      // stays clamp for a 2D consumer of the same path.
      const texture = new THREE.Texture();
      const result = applyTextureState(texture, state({}));

      expect(result).not.toBe(texture);
      expect(result.wrapS).toBe(THREE.RepeatWrapping);
      expect(result.wrapT).toBe(THREE.RepeatWrapping);
      expect(texture.wrapS).toBe(THREE.ClampToEdgeWrapping);
      expect(texture.wrapT).toBe(THREE.ClampToEdgeWrapping);
    });

    it('clones a clamped arrival to Repeat when repeat is authored true', () => {
      const texture = new THREE.Texture();
      const result = applyTextureState(texture, state({ repeat: true }));
      expect(result.wrapS).toBe(THREE.RepeatWrapping);
      expect(result.wrapT).toBe(THREE.RepeatWrapping);
    });

    it('shares an already-Repeat texture for the default, as nothing diverges', () => {
      const texture = new THREE.Texture();
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      expect(applyTextureState(texture, state({}))).toBe(texture);
      expect(applyTextureState(texture, state({ repeat: true }))).toBe(texture);
    });

    it('shares a clamped texture when a material turns repeat OFF', () => {
      // Clamp is what the entry already carries, so `repeat = false` asks for
      // nothing: the loader's own texture comes straight back.
      const texture = new THREE.Texture();
      expect(applyTextureState(texture, state({ repeat: false }))).toBe(texture);
    });

    it('clones to clamp when a material turns repeat OFF on a Repeat texture', () => {
      const texture = new THREE.Texture();
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;

      const result = applyTextureState(texture, state({ repeat: false }));

      expect(result).not.toBe(texture);
      expect(result.wrapS).toBe(THREE.ClampToEdgeWrapping);
      expect(texture.wrapS).toBe(THREE.RepeatWrapping);
    });

    it('leaves a render target alone', () => {
      // Its wrapping is the target's business, and cloning detaches it.
      const target = new THREE.WebGLRenderTarget(8, 8);
      expect(applyTextureState(target.texture, state({ repeat: false }))).toBe(target.texture);
    });
  });

  describe('filter divergence', () => {
    it('clones and writes the sampler state', () => {
      const texture = new THREE.Texture();
      const result = applyTextureState(texture, state({ filter: 0 }));

      expect(result).not.toBe(texture);
      expect(result.magFilter).toBe(THREE.NearestFilter);
      expect(result.minFilter).toBe(THREE.NearestFilter);
      expect(result.generateMipmaps).toBe(false);
    });

    it('leaves the shared source sampling exactly as it was', () => {
      const texture = new THREE.Texture();
      applyTextureState(texture, state({ filter: 5 }));

      expect(texture.magFilter).toBe(THREE.LinearFilter);
      expect(texture.anisotropy).toBe(1);
    });
  });

  describe('both reasons at once', () => {
    it('produces ONE clone carrying both, not a clone of a clone', () => {
      const texture = new THREE.Texture();
      const image = { width: 4, height: 4 };
      texture.image = image;

      const result = applyTextureState(texture, state({ uv: uv(2, 2), filter: 0 }));

      expect(result).not.toBe(texture);
      expect(result.repeat.x).toBe(2);
      expect(result.magFilter).toBe(THREE.NearestFilter);
      // A second clone copies the image reference too, so the discriminator is a
      // pristine source, not identity.
      expect(result.image).toBe(image);
      expect(texture.repeat.x).toBe(1);
      expect(texture.magFilter).toBe(THREE.LinearFilter);
    });
  });

  describe('cross-material contamination', () => {
    it('gives two materials sharing one image their own sampler state', () => {
      // The loader caches one texture per path, so filter state applies at
      // material build, not texture load.
      const shared = new THREE.Texture();

      const nearest = applyTextureState(shared, state({ filter: 0 }));
      const anisotropic = applyTextureState(shared, state({ filter: 5 }));

      expect(nearest).not.toBe(anisotropic);
      expect(nearest.magFilter).toBe(THREE.NearestFilter);
      expect(anisotropic.anisotropy).toBe(GODOT_ANISOTROPY_MAX);
      expect(shared.magFilter).toBe(THREE.LinearFilter);
      expect(shared.anisotropy).toBe(1);
    });
  });

  describe('colour space', () => {
    it('returns the original when the tag already matches the binding', () => {
      const texture = tiling();
      texture.colorSpace = THREE.SRGBColorSpace;
      expect(applyTextureState(texture, { colorSpace: THREE.SRGBColorSpace })).toBe(texture);
    });

    it('clones and pins when the binding samples raw bytes', () => {
      const shared = new THREE.Texture();
      shared.colorSpace = THREE.SRGBColorSpace;

      const result = applyTextureState(shared, { colorSpace: THREE.NoColorSpace });

      expect(result).not.toBe(shared);
      expect(result.colorSpace).toBe(THREE.NoColorSpace);
      // The shared cache entry keeps the tag its other consumers rely on.
      expect(shared.colorSpace).toBe(THREE.SRGBColorSpace);
    });

    it('pins hard enough to survive a later write', () => {
      // `@react-three/fiber` reasserts `SRGBColorSpace` on colour-map props on
      // every commit, so a plain assignment would be undone silently.
      const shared = new THREE.Texture();
      shared.colorSpace = THREE.SRGBColorSpace;
      const result = applyTextureState(shared, { colorSpace: THREE.NoColorSpace });

      result.colorSpace = THREE.SRGBColorSpace;

      expect(result.colorSpace).toBe(THREE.NoColorSpace);
    });

    it('clones and DECODES when the binding needs a decode the producer skipped', () => {
      // A producer's raw tag describes the bytes, the binding describes the
      // sampler, and the sampler wins.
      const shared = new THREE.Texture();
      expect(shared.colorSpace).toBe(THREE.NoColorSpace);

      const result = applyTextureState(shared, { colorSpace: THREE.SRGBColorSpace });

      expect(result).not.toBe(shared);
      expect(result.colorSpace).toBe(THREE.SRGBColorSpace);
      expect(shared.colorSpace).toBe(THREE.NoColorSpace);
    });

    it('produces ONE clone when colour space and UV both diverge', () => {
      const shared = new THREE.Texture();
      shared.colorSpace = THREE.SRGBColorSpace;
      const image = { width: 4, height: 4 };
      shared.image = image;

      const result = applyTextureState(shared, {
        uv: uv(2, 2),
        colorSpace: THREE.NoColorSpace,
      });

      expect(result.repeat.x).toBe(2);
      expect(result.colorSpace).toBe(THREE.NoColorSpace);
      expect(result.image).toBe(image);
      expect(shared.repeat.x).toBe(1);
      expect(shared.colorSpace).toBe(THREE.SRGBColorSpace);
    });

    it('leaves a render target on the colour space its viewport chose', () => {
      // A SubViewport writes its target already tone-mapped and tags it
      // LinearSRGB; re-tagging the live attachment would change what every
      // other reader of that same target sees.
      const target = new THREE.WebGLRenderTarget(8, 8);
      target.texture.colorSpace = THREE.LinearSRGBColorSpace;

      const result = applyTextureState(target.texture, { colorSpace: THREE.SRGBColorSpace });

      expect(result).toBe(target.texture);
      expect(result.colorSpace).toBe(THREE.LinearSRGBColorSpace);
    });
  });

  describe('clone tagging', () => {
    it('tags clones so the owning material can dispose them', () => {
      const original = new THREE.Texture();
      const clone = applyTextureState(original, state({ filter: 0 }));

      expect(isMaterialOwnedTexture(clone)).toBe(true);
      expect(isMaterialOwnedTexture(original)).toBe(false);
    });
  });
});
