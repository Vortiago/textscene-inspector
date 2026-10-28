/**
 * A texture view protects the identity-equality contract: a consumer that needs different sampler
 * state gets one clone, however many reasons diverge, and a consumer that needs none gets the
 * original. Which colour space a slot requires is tested in `standardmaterial3d/textureBinding.ts`.
 */

import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  applyViewSampler,
  ownedTextureView,
  pinColorSpace,
  releaseView,
  sameViewSampler,
  textureView,
  viewToRelease,
  type ViewSampler,
} from './textureView';
import { UV2_CHANNEL } from '../meshes/uv2';
import { godotTextureFilterState } from './godotTextureFilter';
import type { UvWindow } from '../../r3f/uvWindow';

function uvWindow(sx: number, sy: number, ox = 0, oy = 0): UvWindow {
  return { repeat: { x: sx, y: sy }, offset: { x: ox, y: oy } };
}

/** The Godot `texture_filter` ordinal's sampler state, at the viewport's anisotropy level if given. */
const filterOf = godotTextureFilterState;

/**
 * A sampler whose colour space matches a fresh `THREE.Texture`'s, so a case about window, filter or
 * wrapping isolates that reason alone. The colour-space cases name theirs.
 */
function sampler(wanted: Omit<ViewSampler, 'colorSpace'> = {}): ViewSampler {
  return { wrap: THREE.RepeatWrapping, ...wanted, colorSpace: THREE.NoColorSpace };
}

/**
 * A texture already carrying Repeat wrapping, which `sampler` states. A case about window, filter or
 * colour space starts from here so it isolates that reason and not the wrap.
 */
function tiling(): THREE.Texture {
  const texture = new THREE.Texture();
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

function disposals(texture: THREE.Texture): { count: number } {
  const seen = { count: 0 };
  texture.addEventListener('dispose', () => {
    seen.count += 1;
  });
  return seen;
}

describe('textureView', () => {
  describe('no divergence', () => {
    it('returns the original reference when nothing diverges', () => {
      const texture = tiling();
      expect(textureView(texture, sampler())).toBe(texture);
    });

    it('states no wrap, so a source keeps the wrap it carries', () => {
      const texture = new THREE.Texture();
      expect(textureView(texture, { colorSpace: THREE.NoColorSpace })).toBe(texture);
    });

    it("returns the original for Godot's default filter, which is three's state already", () => {
      const texture = tiling();
      expect(textureView(texture, sampler({ filter: filterOf(3) }))).toBe(texture);
      expect(textureView(texture, sampler({ filter: undefined }))).toBe(texture);
    });

    it("samples an anisotropic filter at the viewport's anisotropic_filtering_level", () => {
      const anisotropyAt = (level: number) =>
        textureView(tiling(), sampler({ filter: filterOf(5, level) })).anisotropy;

      expect(anisotropyAt(1)).toBe(2);
      expect(anisotropyAt(3)).toBe(8);
    });

    it('returns the original for the window it already shows', () => {
      const texture = tiling();
      expect(textureView(texture, sampler({ window: uvWindow(1, 1) }))).toBe(texture);
    });

    it('treats values within the 1e-6 epsilon as the same window', () => {
      const texture = tiling();
      const view = textureView(texture, sampler({ window: uvWindow(1 + 5e-7, 1 - 5e-7, 5e-7, -5e-7) }));
      expect(view).toBe(texture);
    });

    it('mutates nothing on the pass-through path', () => {
      const texture = tiling();
      textureView(texture, sampler({ window: uvWindow(1, 1), filter: filterOf(3) }));
      expect(texture.repeat.x).toBe(1);
      expect(texture.version).toBe(0);
    });
  });

  describe('window divergence', () => {
    it('clones and sets repeat, offset and the wrap it states', () => {
      const texture = new THREE.Texture();
      const view = textureView(texture, sampler({ window: uvWindow(3, 4, 0.5, -0.25) }));

      expect(view).not.toBe(texture);
      expect(view.repeat.toArray()).toEqual([3, 4]);
      expect(view.offset.toArray()).toEqual([0.5, -0.25]);
      expect(view.wrapS).toBe(THREE.RepeatWrapping);
      expect(view.wrapT).toBe(THREE.RepeatWrapping);
    });

    it('clones just outside the epsilon, for repeat or offset alone', () => {
      expect(textureView(tiling(), sampler({ window: uvWindow(1 + 1e-5, 1) })).repeat.x).toBeCloseTo(
        1 + 1e-5,
        10
      );
      expect(textureView(tiling(), sampler({ window: uvWindow(1, 1, 0, 1e-5) })).offset.y).toBeCloseTo(
        1e-5,
        10
      );
    });

    it('passes a negative repeat through verbatim (mirrored tiling)', () => {
      const view = textureView(tiling(), sampler({ window: uvWindow(-1, 1) }));
      expect(view.repeat.x).toBe(-1);
    });

    it('clones a source that shows another window back to the one stated', () => {
      const texture = tiling();
      texture.repeat.set(2, 2);

      const view = textureView(texture, sampler({ window: uvWindow(1, 1) }));

      expect(view).not.toBe(texture);
      expect(view.repeat.toArray()).toEqual([1, 1]);
    });

    it('leaves the original untouched and shares its image data', () => {
      const texture = new THREE.Texture();
      const image = { width: 4, height: 4 };
      texture.image = image;
      const view = textureView(texture, sampler({ window: uvWindow(3, 4, 0.5, -0.25) }));

      expect(view.source).toBe(texture.source);
      expect(texture.repeat.x).toBe(1);
      expect(texture.offset.x).toBe(0);
      expect(texture.wrapS).toBe(THREE.ClampToEdgeWrapping);
      expect(texture.version).toBe(0);
    });

    it('flags the clone for re-upload', () => {
      expect(textureView(new THREE.Texture(), sampler({ window: uvWindow(2, 2) })).version).toBeGreaterThan(
        0
      );
    });
  });

  describe('textures that must never be cloned', () => {
    it('leaves a render-target texture alone even when its sampling differs', () => {
      // A ViewportTexture is its render target's texture, and a clone is a frozen
      // frame. Its sampler state differs from Godot's default, so a naive match
      // test would clone every one.
      const target = new THREE.WebGLRenderTarget(64, 64);
      expect(target.texture.isRenderTargetTexture).toBe(true);

      expect(textureView(target.texture, sampler({ filter: filterOf(0) }))).toBe(target.texture);
      expect(textureView(target.texture, sampler())).toBe(target.texture);
      expect(textureView(target.texture, sampler({ window: uvWindow(4, 4) }))).toBe(target.texture);
      expect(textureView(target.texture, sampler({ wrap: THREE.ClampToEdgeWrapping }))).toBe(target.texture);
    });

    it('leaves a render target alone for an owned view too', () => {
      const target = new THREE.WebGLRenderTarget(8, 8);
      expect(ownedTextureView(target.texture, sampler())).toBe(target.texture);
    });

    it("does not clone merely because the source diverges from Godot's default", () => {
      // An unauthored `texture_filter` means "no opinion", not "force row 3".
      const texture = tiling();
      texture.minFilter = THREE.LinearFilter;
      texture.generateMipmaps = false;

      expect(textureView(texture, sampler())).toBe(texture);
      expect(textureView(texture, sampler({ filter: undefined }))).toBe(texture);
      expect(texture.minFilter).toBe(THREE.LinearFilter);
    });
  });

  describe('wrap', () => {
    it('clones a clamped arrival to Repeat when Repeat is stated', () => {
      // The loader ships three's clamp default (ADR-0044). A 3D material states
      // Repeat, so the view clones to tile it, which guards against terrain stripes.
      const texture = new THREE.Texture();
      const view = textureView(texture, sampler());

      expect(view).not.toBe(texture);
      expect(view.wrapS).toBe(THREE.RepeatWrapping);
      expect(view.wrapT).toBe(THREE.RepeatWrapping);
      expect(texture.wrapS).toBe(THREE.ClampToEdgeWrapping);
      expect(texture.wrapT).toBe(THREE.ClampToEdgeWrapping);
    });

    it('shares a clamped texture when clamp is stated', () => {
      const texture = new THREE.Texture();
      expect(textureView(texture, sampler({ wrap: THREE.ClampToEdgeWrapping }))).toBe(texture);
    });

    it('clones a Repeat texture to clamp when clamp is stated', () => {
      const texture = tiling();

      const view = textureView(texture, sampler({ wrap: THREE.ClampToEdgeWrapping }));

      expect(view).not.toBe(texture);
      expect(view.wrapS).toBe(THREE.ClampToEdgeWrapping);
      expect(view.wrapT).toBe(THREE.ClampToEdgeWrapping);
      expect(texture.wrapS).toBe(THREE.RepeatWrapping);
    });

    it('clones a Repeat texture to mirrored repeat when that is stated', () => {
      const view = textureView(tiling(), sampler({ wrap: THREE.MirroredRepeatWrapping }));
      expect([view.wrapS, view.wrapT]).toEqual([THREE.MirroredRepeatWrapping, THREE.MirroredRepeatWrapping]);
    });
  });

  describe('filter divergence', () => {
    it('clones and writes the sampler state', () => {
      const texture = new THREE.Texture();
      const view = textureView(texture, sampler({ filter: filterOf(0) }));

      expect(view).not.toBe(texture);
      expect(view.magFilter).toBe(THREE.NearestFilter);
      expect(view.minFilter).toBe(THREE.NearestFilter);
      expect(view.generateMipmaps).toBe(false);
    });

    it('leaves the shared source sampling exactly as it was', () => {
      const texture = new THREE.Texture();
      textureView(texture, sampler({ filter: filterOf(5) }));

      expect(texture.magFilter).toBe(THREE.LinearFilter);
      expect(texture.anisotropy).toBe(1);
    });

    it('gives two consumers of one image their own sampler state', () => {
      const shared = new THREE.Texture();

      const nearest = textureView(shared, sampler({ filter: filterOf(0) }));
      const anisotropic = textureView(shared, sampler({ filter: filterOf(5) }));

      expect(nearest).not.toBe(anisotropic);
      expect(nearest.magFilter).toBe(THREE.NearestFilter);
      expect(anisotropic.anisotropy).toBe(filterOf(5).anisotropy);
      expect(shared.magFilter).toBe(THREE.LinearFilter);
      expect(shared.anisotropy).toBe(1);
    });

    it('drops the levels of a clone that samples no chain, and leaves the source its own', () => {
      const shared = tiling();
      shared.mipmaps = [
        { width: 2, height: 2 },
        { width: 1, height: 1 },
      ] as unknown as THREE.Texture['mipmaps'];

      const view = textureView(shared, sampler({ filter: filterOf(1) }));

      expect(view.mipmaps).toEqual([]);
      expect(shared.mipmaps).toHaveLength(2);
    });
  });

  describe('every reason at once', () => {
    it('produces ONE clone carrying all of them, not a clone of a clone', () => {
      const texture = new THREE.Texture();
      const image = { width: 4, height: 4 };
      texture.image = image;

      const view = textureView(texture, sampler({ window: uvWindow(2, 2), filter: filterOf(0) }));

      expect(view).not.toBe(texture);
      expect(view.repeat.x).toBe(2);
      expect(view.magFilter).toBe(THREE.NearestFilter);
      // A second clone copies the image reference too, so the discriminator is a
      // pristine source, not identity.
      expect(view.image).toBe(image);
      expect(texture.repeat.x).toBe(1);
      expect(texture.magFilter).toBe(THREE.LinearFilter);
    });
  });

  describe('colour space', () => {
    it('returns the original when the tag already matches the sampler', () => {
      const texture = tiling();
      texture.colorSpace = THREE.SRGBColorSpace;
      expect(textureView(texture, { colorSpace: THREE.SRGBColorSpace })).toBe(texture);
    });

    it('clones and pins when the sampler reads raw bytes', () => {
      const shared = tiling();
      shared.colorSpace = THREE.SRGBColorSpace;

      const view = textureView(shared, sampler());

      expect(view).not.toBe(shared);
      expect(view.colorSpace).toBe(THREE.NoColorSpace);
      // The shared cache entry keeps the tag its other consumers rely on.
      expect(shared.colorSpace).toBe(THREE.SRGBColorSpace);
    });

    it('pins hard enough to survive a later write', () => {
      // `@react-three/fiber` reasserts `SRGBColorSpace` on colour-map props on
      // every commit, so a plain assignment would be undone silently.
      const shared = tiling();
      shared.colorSpace = THREE.SRGBColorSpace;
      const view = textureView(shared, sampler());

      view.colorSpace = THREE.SRGBColorSpace;

      expect(view.colorSpace).toBe(THREE.NoColorSpace);
    });

    it('clones and DECODES when the sampler needs a decode the producer skipped', () => {
      // A producer's raw tag describes the bytes, the sampler describes the
      // read, and the sampler wins.
      const shared = tiling();
      expect(shared.colorSpace).toBe(THREE.NoColorSpace);

      const view = textureView(shared, { colorSpace: THREE.SRGBColorSpace });

      expect(view).not.toBe(shared);
      expect(view.colorSpace).toBe(THREE.SRGBColorSpace);
      expect(shared.colorSpace).toBe(THREE.NoColorSpace);
    });

    it('produces ONE clone when colour space and window both diverge', () => {
      const shared = tiling();
      shared.colorSpace = THREE.SRGBColorSpace;
      const image = { width: 4, height: 4 };
      shared.image = image;

      const view = textureView(shared, sampler({ window: uvWindow(2, 2) }));

      expect(view.repeat.x).toBe(2);
      expect(view.colorSpace).toBe(THREE.NoColorSpace);
      expect(view.image).toBe(image);
      expect(shared.repeat.x).toBe(1);
      expect(shared.colorSpace).toBe(THREE.SRGBColorSpace);
    });

    it('leaves a render target on the colour space its viewport chose', () => {
      // A SubViewport writes its target already tone-mapped and tags it
      // LinearSRGB; re-tagging the live attachment would change what every
      // other reader of that same target sees.
      const target = new THREE.WebGLRenderTarget(8, 8);
      target.texture.colorSpace = THREE.LinearSRGBColorSpace;

      const view = textureView(target.texture, { colorSpace: THREE.SRGBColorSpace });

      expect(view).toBe(target.texture);
      expect(view.colorSpace).toBe(THREE.LinearSRGBColorSpace);
    });
  });

  describe('UV set', () => {
    it('clones onto the UV set the sampler reads', () => {
      const texture = tiling();
      const view = textureView(texture, sampler({ channel: UV2_CHANNEL }));

      expect(view).not.toBe(texture);
      expect(view.channel).toBe(UV2_CHANNEL);
      expect(texture.channel).toBe(0);
    });

    it('returns the original when it already reads that UV set', () => {
      const texture = tiling();
      texture.channel = UV2_CHANNEL;

      expect(textureView(texture, sampler({ channel: UV2_CHANNEL }))).toBe(texture);
    });

    it('reads an omitted UV set as the first, so a UV2 texture clones back (edge case)', () => {
      const texture = tiling();
      texture.channel = UV2_CHANNEL;

      expect(textureView(texture, sampler()).channel).toBe(0);
    });
  });
});

describe('ownedTextureView', () => {
  it('clones even when the source already matches, so the caller may write its window', () => {
    const texture = tiling();

    const view = ownedTextureView(texture, sampler());

    expect(view).not.toBe(texture);
    expect(view.source).toBe(texture.source);
    expect(view.colorSpace).toBe(THREE.NoColorSpace);
  });

  it('carries every field the sampler states', () => {
    const view = ownedTextureView(
      new THREE.Texture(),
      sampler({
        filter: filterOf(0),
        wrap: THREE.MirroredRepeatWrapping,
        window: uvWindow(0.5, 0.25, 0.5, 0),
      })
    );

    expect([view.magFilter, view.wrapS, view.repeat.toArray(), view.offset.toArray()]).toEqual([
      THREE.NearestFilter,
      THREE.MirroredRepeatWrapping,
      [0.5, 0.25],
      [0.5, 0],
    ]);
  });

  it('leaves a source with no wrap stated on the wrap it carries', () => {
    const texture = tiling();
    expect(ownedTextureView(texture, { colorSpace: THREE.NoColorSpace }).wrapS).toBe(THREE.RepeatWrapping);
  });

  it('marks the clone for upload', () => {
    expect(ownedTextureView(new THREE.Texture(), sampler()).version).toBeGreaterThan(0);
  });
});

describe('release', () => {
  it('disposes a clone a view made', () => {
    const view = textureView(new THREE.Texture(), sampler({ filter: filterOf(0) }));
    const seen = disposals(view);

    releaseView(view);

    expect(seen.count).toBe(1);
  });

  it('disposes an owned view', () => {
    const view = ownedTextureView(new THREE.Texture(), sampler());
    const seen = disposals(view);

    releaseView(view);

    expect(seen.count).toBe(1);
  });

  it('leaves the loader’s shared entry alone', () => {
    const shared = tiling();
    const seen = disposals(shared);

    releaseView(textureView(shared, sampler()));
    releaseView(shared);

    expect(seen.count).toBe(0);
  });

  it('leaves a render target alone', () => {
    const target = new THREE.WebGLRenderTarget(8, 8);
    const seen = disposals(target.texture);

    releaseView(textureView(target.texture, sampler()));

    expect(seen.count).toBe(0);
  });

  it('tolerates an empty slot (edge case)', () => {
    expect(() => releaseView(undefined)).not.toThrow();
    expect(() => releaseView(null)).not.toThrow();
  });

  it('names the texture of a clone, and none for a shared entry', () => {
    const shared = tiling();
    const clone = textureView(new THREE.Texture(), sampler());

    expect(viewToRelease(clone)).toBe(clone);
    expect(viewToRelease(shared)).toBeNull();
    expect(viewToRelease(textureView(shared, sampler()))).toBeNull();
    expect(viewToRelease(null)).toBeNull();
  });

  it('does not own a clone of a view, which no view made', () => {
    const view = textureView(new THREE.Texture(), sampler());
    const copy = view.clone();
    const seen = disposals(copy);

    releaseView(copy);

    expect(seen.count).toBe(0);
  });
});

describe('applyViewSampler', () => {
  it('writes every field the sampler states onto the texture itself', () => {
    const texture = new THREE.Texture();

    const sampled = applyViewSampler(
      texture,
      sampler({ filter: filterOf(0), wrap: THREE.MirroredRepeatWrapping, window: uvWindow(0.5, 0.25) })
    );

    expect([sampled === texture, texture.magFilter, texture.wrapT, texture.repeat.toArray()]).toEqual([
      true,
      THREE.NearestFilter,
      THREE.MirroredRepeatWrapping,
      [0.5, 0.25],
    ]);
  });

  it('pins the colour space, so a later write leaves it', () => {
    const texture = applyViewSampler(new THREE.Texture(), sampler());

    texture.colorSpace = THREE.SRGBColorSpace;

    expect(texture.colorSpace).toBe(THREE.NoColorSpace);
  });

  it('leaves the texture to its caller: no upload mark, and nothing for a view to release', () => {
    const texture = applyViewSampler(new THREE.Texture(), sampler());

    expect([texture.version, viewToRelease(texture)]).toEqual([0, null]);
  });
});

describe('pinColorSpace', () => {
  it('reads back the pinned colour space', () => {
    const texture = pinColorSpace(new THREE.Texture(), THREE.LinearSRGBColorSpace);
    expect(texture.colorSpace).toBe(THREE.LinearSRGBColorSpace);
  });

  /** The write `@react-three/fiber`'s `applyProps` makes on a texture bound to a `map`. */
  it('discards a later write without throwing', () => {
    const texture = pinColorSpace(new THREE.Texture(), THREE.LinearSRGBColorSpace);
    expect(() => {
      texture.colorSpace = THREE.SRGBColorSpace;
    }).not.toThrow();
    expect(texture.colorSpace).toBe(THREE.LinearSRGBColorSpace);
  });

  it('takes a second pin, which replaces the first (edge case)', () => {
    const texture = pinColorSpace(new THREE.Texture(), THREE.LinearSRGBColorSpace);
    pinColorSpace(texture, THREE.SRGBColorSpace);
    expect(texture.colorSpace).toBe(THREE.SRGBColorSpace);
  });
});

describe('sameViewSampler', () => {
  it('holds for two samplers that state the same values, whatever their identity', () => {
    const state = sampler({ filter: filterOf(0), channel: UV2_CHANNEL, window: uvWindow(2, 3, 0.5, 0.25) });
    expect(sameViewSampler(state, { ...state, window: uvWindow(2, 3, 0.5, 0.25) })).toBe(true);
  });

  it.each([
    ['colour space', { colorSpace: THREE.SRGBColorSpace }],
    ['wrap', { wrap: THREE.ClampToEdgeWrapping }],
    ['filter', { filter: filterOf(0) }],
    ['channel', { channel: UV2_CHANNEL }],
    ['window repeat', { window: uvWindow(2, 1) }],
    ['window offset', { window: uvWindow(1, 1, 0, 0.5) }],
  ])('fails once the %s differs', (_name, change) => {
    const base = sampler({ filter: filterOf(1), window: uvWindow(1, 1) });
    expect(sameViewSampler(base, { ...base, ...change })).toBe(false);
  });

  it('takes an omitted channel as the first UV set (edge case)', () => {
    expect(sameViewSampler(sampler(), sampler({ channel: 0 }))).toBe(true);
  });

  it('takes no sampler as null or undefined alike, and as unlike a stated one (edge case)', () => {
    expect(sameViewSampler(undefined, null)).toBe(true);
    expect(sameViewSampler(null, sampler())).toBe(false);
  });
});
