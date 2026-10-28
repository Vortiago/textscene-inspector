import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  decalAtlasRect,
  decalAtlasTexture,
  holdDecalTexture,
  releaseDecalTexture,
  setDecalAtlasFilter,
  updateDecalAtlas,
} from './decalAtlas';
import { godotTextureFilterState } from '../../../resources/textures/godotTextureFilter';
import { readableLiveTarget } from '../../../r3f/liveTargets.testkit';

const MAX_TEXTURE_SIZE = 4096;

/** A `size × size` RGBA8 texture whose rows run bottom-up, as the procedural textures store them. */
function dataTexture(size: number, rgba: readonly number[] = [255, 255, 255, 255]): THREE.DataTexture {
  const data = new Uint8Array(size * size * 4);
  for (let texel = 0; texel < size * size; texel++) data.set(rgba, texel * 4);
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.needsUpdate = true;
  return texture;
}

/** The atlas's level 0 bytes. */
function baseLevel(): Uint8Array {
  return (decalAtlasTexture().mipmaps[0] as unknown as { data: Uint8Array }).data;
}

/** The level 0 bytes of the first texel the atlas holds for `texture`. */
function firstTexelOf(texture: THREE.Texture): number[] {
  const { width, height } = decalAtlasTexture().image as { width: number; height: number };
  const rect = decalAtlasRect(texture)!;
  const offset = (Math.round(rect.y * height) * width + Math.round(rect.x * width)) * 4;
  return [...baseLevel().subarray(offset, offset + 4)];
}

const held: THREE.Texture[] = [];

function hold(texture: THREE.Texture): THREE.Texture {
  holdDecalTexture(texture);
  held.push(texture);
  return texture;
}

afterEach(() => {
  for (const texture of held.splice(0)) releaseDecalTexture(texture);
  updateDecalAtlas(MAX_TEXTURE_SIZE);
});

describe('the decal atlas', () => {
  it('places a held texture where Godot does', () => {
    const texture = hold(dataTexture(64));

    updateDecalAtlas(MAX_TEXTURE_SIZE);

    // 64 x 64 is 3 x 3 cells in a 256 x 128 atlas, at texel 16 (`texture_storage.cpp:3144-3153`).
    expect(decalAtlasRect(texture)).toEqual({ x: 16 / 256, y: 16 / 128, width: 64 / 256, height: 64 / 128 });
  });

  it('gives two decals with one texture one rectangle', () => {
    const texture = dataTexture(64);
    hold(texture);
    holdDecalTexture(texture);
    hold(dataTexture(64, [0, 0, 0, 255]));

    updateDecalAtlas(MAX_TEXTURE_SIZE);

    expect(decalAtlasTexture().image).toMatchObject({ width: 256, height: 128 });
    expect(decalAtlasRect(texture)).toEqual({ x: 16 / 256, y: 16 / 128, width: 64 / 256, height: 64 / 128 });
    releaseDecalTexture(texture);
  });

  it('keeps the entry while a decal still projects it, and drops it with the last (:3240-3258)', () => {
    const texture = dataTexture(64);
    holdDecalTexture(texture);
    holdDecalTexture(texture);
    updateDecalAtlas(MAX_TEXTURE_SIZE);

    releaseDecalTexture(texture);
    expect(decalAtlasRect(texture)).toBeDefined();

    releaseDecalTexture(texture);
    expect(decalAtlasRect(texture)).toBeUndefined();
  });

  it('leaves the other textures where they are when one leaves (:3258)', () => {
    const first = hold(dataTexture(64));
    const second = dataTexture(64, [0, 0, 255, 255]);
    holdDecalTexture(second);
    updateDecalAtlas(MAX_TEXTURE_SIZE);
    const before = decalAtlasRect(second);

    releaseDecalTexture(first);
    updateDecalAtlas(MAX_TEXTURE_SIZE);

    // Godot does not mark the atlas dirty when an entry leaves, so no layout moves.
    expect(decalAtlasRect(second)).toEqual(before);
    releaseDecalTexture(second);
  });

  it('rebuilds when a texture joins (edge case: a texture wider than the rest grows the base)', () => {
    const narrow = hold(dataTexture(64));
    updateDecalAtlas(MAX_TEXTURE_SIZE);
    expect(decalAtlasTexture().image).toMatchObject({ width: 256 });

    hold(dataTexture(300));
    updateDecalAtlas(MAX_TEXTURE_SIZE);

    // 300 / 32 + 1 = 10 cells: base 16 cells, 512 texels wide.
    expect(decalAtlasTexture().image).toMatchObject({ width: 512 });
    expect(decalAtlasRect(narrow)!.width).toBe(64 / 512);
  });

  it("rebuilds once a held texture's pixels change", () => {
    const texture = hold(dataTexture(64, [0, 0, 0, 255]));
    updateDecalAtlas(MAX_TEXTURE_SIZE);

    (texture.image as { data: Uint8Array }).data.fill(255);
    texture.needsUpdate = true;
    updateDecalAtlas(MAX_TEXTURE_SIZE);

    const level0 = baseLevel();
    expect([...level0.subarray((16 * 256 + 16) * 4, (16 * 256 + 16) * 4 + 4)]).toEqual([255, 255, 255, 255]);
  });

  it('keeps a bottom-up texture top row first, as Godot copies it', () => {
    const texture = hold(dataTexture(2));
    const data = (texture.image as { data: Uint8Array }).data;
    data.set([255, 0, 0, 255, 255, 0, 0, 255], 0);
    data.set([0, 0, 255, 255, 0, 0, 255, 255], 8);
    texture.needsUpdate = true;

    updateDecalAtlas(MAX_TEXTURE_SIZE);

    // Bottom-up, the last row is the image's top: blue.
    const level0 = baseLevel();
    expect([...level0.subarray((16 * 256 + 16) * 4, (16 * 256 + 16) * 4 + 4)]).toEqual([0, 0, 255, 255]);
  });

  it("copies a live target's bytes, top row first, when it rebuilds (texture_storage.cpp:3216)", () => {
    const target = readableLiveTarget(2, [255, 0, 0, 255], [0, 0, 255, 255]);
    hold(target.texture);

    updateDecalAtlas(MAX_TEXTURE_SIZE);

    const level0 = baseLevel();
    expect([...level0.subarray((16 * 256 + 16) * 4, (16 * 256 + 16) * 4 + 4)]).toEqual([0, 0, 255, 255]);
    target.withdraw();
  });

  /** Godot reads an opaque target's image as RGB8 (`texture_storage.cpp:3571-3575`). */
  it("copies an opaque target's texels opaque, as its image has no alpha", () => {
    const target = readableLiveTarget(2, [0, 0, 0, 0], [0, 0, 0, 0]);
    hold(target.texture);

    updateDecalAtlas(MAX_TEXTURE_SIZE);

    expect(firstTexelOf(target.texture)).toEqual([0, 0, 0, 255]);
    target.withdraw();
  });

  it('keeps the copy while the target redraws, and copies again at the next rebuild', () => {
    const target = readableLiveTarget(2, [0, 0, 255, 255], [0, 0, 255, 255]);
    hold(target.texture);
    updateDecalAtlas(MAX_TEXTURE_SIZE);
    target.paint([0, 255, 0, 255], [0, 255, 0, 255]);

    updateDecalAtlas(MAX_TEXTURE_SIZE);
    const frozen = firstTexelOf(target.texture);
    hold(dataTexture(64));
    updateDecalAtlas(MAX_TEXTURE_SIZE);
    const recopied = firstTexelOf(target.texture);

    expect([frozen, recopied]).toEqual([
      [0, 0, 255, 255],
      [0, 255, 0, 255],
    ]);
    target.withdraw();
  });

  it('is sampled as sRGB over five linear-mipmap levels, clamped (render_forward_clustered.cpp:3213)', () => {
    hold(dataTexture(64));
    updateDecalAtlas(MAX_TEXTURE_SIZE);

    const atlas = decalAtlasTexture();
    expect(atlas.colorSpace).toBe(THREE.SRGBColorSpace);
    expect(atlas.mipmaps).toHaveLength(5);
    expect(atlas.minFilter).toBe(THREE.LinearMipmapLinearFilter);
    expect(atlas.wrapS).toBe(THREE.ClampToEdgeWrapping);
  });

  it('is 32 x 32 with five levels before any texture joins (:3144-3153)', async () => {
    // A fresh module: the atlas keeps the last layout it built, as Godot's does (:3258).
    vi.resetModules();
    const fresh = await import('./decalAtlas');

    expect(fresh.decalAtlasTexture().mipmaps.map((level) => level.width)).toEqual([32, 16, 8, 4, 2]);
  });

  it('draws the decals that fit a smaller GPU texture and warns with both sizes (edge case)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const fits = hold(dataTexture(64));
    const overflows = hold(dataTexture(300));

    updateDecalAtlas(256);

    expect(decalAtlasRect(fits)).toBeDefined();
    expect(decalAtlasRect(overflows)).toBeUndefined();
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/512x512.*256/));
    warn.mockRestore();
  });

  it('places nothing for a texture whose pixels cannot be read (error case)', () => {
    const texture = hold(new THREE.Texture());

    updateDecalAtlas(MAX_TEXTURE_SIZE);

    expect(decalAtlasRect(texture)).toBeUndefined();
  });

  it('places nothing for a float texture, whose texels are not RGBA8 bytes (error case)', () => {
    const texture = hold(
      new THREE.DataTexture(new Float32Array(2 * 2 * 4), 2, 2, THREE.RGBAFormat, THREE.FloatType)
    );

    updateDecalAtlas(MAX_TEXTURE_SIZE);

    expect(decalAtlasRect(texture)).toBeUndefined();
  });

  it('draws a texture it left out for size once another decal releases its room (edge case)', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    // Each 64 x 64 texture is 3 x 3 cells, two to a row of 8 columns: four fit 256 texels, a fifth needs 512.
    const textures = [0, 1, 2, 3, 4].map((shade) => hold(dataTexture(64, [shade, shade, shade, 255])));
    updateDecalAtlas(256);
    expect(decalAtlasRect(textures[4]!)).toBeUndefined();

    releaseDecalTexture(textures[0]!);
    updateDecalAtlas(256);

    expect(decalAtlasRect(textures[4]!)).toBeDefined();
    vi.restoreAllMocks();
  });
});

describe('the decal atlas filter', () => {
  afterEach(() => setDecalAtlasFilter(godotTextureFilterState(3)));

  it('samples nearest, with no mip filter, under the Nearest filter (render_forward_clustered.cpp:3437)', () => {
    setDecalAtlasFilter(godotTextureFilterState(0));

    const atlas = decalAtlasTexture();
    expect([atlas.magFilter, atlas.minFilter]).toEqual([THREE.NearestFilter, THREE.NearestFilter]);
  });

  it('samples a nearest mip chain under the Nearest Mipmap filter (:3443)', () => {
    setDecalAtlasFilter(godotTextureFilterState(2));

    const atlas = decalAtlasTexture();
    expect([atlas.magFilter, atlas.minFilter]).toEqual([
      THREE.NearestFilter,
      THREE.NearestMipmapLinearFilter,
    ]);
  });

  it('samples at the anisotropy of the level under an anisotropic filter (:3449)', () => {
    setDecalAtlasFilter(godotTextureFilterState(5, 3));

    expect(decalAtlasTexture().anisotropy).toBe(8);
  });

  it('keeps its levels under a filter that reads none', () => {
    setDecalAtlasFilter(godotTextureFilterState(1));

    expect(decalAtlasTexture().mipmaps.length).toBeGreaterThan(1);
  });

  it('uploads again when the filter changes, and not when it stays', () => {
    const atlas = decalAtlasTexture();
    const { version } = atlas;

    setDecalAtlasFilter(godotTextureFilterState(3));
    expect(atlas.version).toBe(version);

    setDecalAtlasFilter(godotTextureFilterState(1));
    expect(atlas.version).toBe(version + 1);
  });
});
