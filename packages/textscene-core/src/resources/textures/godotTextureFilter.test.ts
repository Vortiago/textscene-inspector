/**
 * Godot's `BaseMaterial3D.texture_filter` to three sampler state. Every expected
 * value is read off Godot 4.6.3's `MaterialStorage::samplers_rd_allocate`. Row 3
 * is Godot's default and three's, so an unauthored filter is a byte-identical no-op.
 */

import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  applyTextureFilterState,
  dropMipChain,
  godotTextureFilterState,
  hasDroppedMipChain,
  textureFilterMatches,
} from './godotTextureFilter';

/** The anisotropy ceiling of Godot's default `anisotropic_filtering_level` 2 (`rendering_server.cpp:3750`): `1 << 2`. */
const GODOT_ANISOTROPY_MAX = 4;

/**
 * Godot's six sampler states. `min_filter` there is the within-level filter and
 * `mip_filter` the between-level one, and three fuses both into `minFilter`.
 * Rows 0 and 1 set `max_lod = 0`, so no mipmapping.
 */
const TABLE = [
  [0, 'NEAREST', THREE.NearestFilter, THREE.NearestFilter, false, 1],
  [1, 'LINEAR', THREE.LinearFilter, THREE.LinearFilter, false, 1],
  [2, 'NEAREST_WITH_MIPMAPS', THREE.NearestFilter, THREE.NearestMipmapLinearFilter, true, 1],
  [3, 'LINEAR_WITH_MIPMAPS', THREE.LinearFilter, THREE.LinearMipmapLinearFilter, true, 1],
  [
    4,
    'NEAREST_WITH_MIPMAPS_ANISOTROPIC',
    THREE.NearestFilter,
    THREE.NearestMipmapLinearFilter,
    true,
    GODOT_ANISOTROPY_MAX,
  ],
  [
    5,
    'LINEAR_WITH_MIPMAPS_ANISOTROPIC',
    THREE.LinearFilter,
    THREE.LinearMipmapLinearFilter,
    true,
    GODOT_ANISOTROPY_MAX,
  ],
] as const;

describe('godotTextureFilterState', () => {
  it.each(TABLE)(
    'maps %i (%s) to the sampler state Godot allocates',
    (filter, _name, magFilter, minFilter, generateMipmaps, anisotropy) => {
      expect(godotTextureFilterState(filter)).toEqual({
        magFilter,
        minFilter,
        generateMipmaps,
        anisotropy,
      });
    }
  );

  it.each([
    [0, 1],
    [1, 2],
    [3, 8],
    [4, 16],
  ])(
    'lets anisotropic_filtering_level %i raise the anisotropic rows to %i (material_storage.cpp:2461)',
    (level, anisotropy) => {
      expect(godotTextureFilterState(5, level).anisotropy).toBe(anisotropy);
      expect(godotTextureFilterState(4, level).anisotropy).toBe(anisotropy);
    }
  );

  it('leaves the rows without anisotropy at 1 whatever the level', () => {
    expect(godotTextureFilterState(3, 4).anisotropy).toBe(1);
    expect(godotTextureFilterState(1, 4).anisotropy).toBe(1);
  });

  it("falls back to Godot's default for an absent or out-of-range value", () => {
    // `BaseMaterial3D::texture_filter = TEXTURE_FILTER_LINEAR_WITH_MIPMAPS`.
    const fallback = godotTextureFilterState(3);
    expect(godotTextureFilterState(undefined)).toEqual(fallback);
    expect(godotTextureFilterState(99)).toEqual(fallback);
    expect(godotTextureFilterState(-1)).toEqual(fallback);
  });

  it("matches a fresh THREE.Texture's own defaults, so an unauthored filter is a no-op", () => {
    // A material that does not author texture_filter renders byte-identically.
    expect(textureFilterMatches(new THREE.Texture(), godotTextureFilterState(undefined))).toBe(true);
  });
});

describe('textureFilterMatches', () => {
  it('is false once any one of the four fields diverges', () => {
    const nearest = godotTextureFilterState(0);
    expect(textureFilterMatches(new THREE.Texture(), nearest)).toBe(false);

    const texture = new THREE.Texture();
    applyTextureFilterState(texture, nearest);
    expect(textureFilterMatches(texture, nearest)).toBe(true);

    texture.anisotropy = 8;
    expect(textureFilterMatches(texture, nearest)).toBe(false);
  });
});

describe('applyTextureFilterState', () => {
  it('writes all four fields onto the texture', () => {
    const texture = new THREE.Texture();
    applyTextureFilterState(texture, godotTextureFilterState(5));

    expect(texture.magFilter).toBe(THREE.LinearFilter);
    expect(texture.minFilter).toBe(THREE.LinearMipmapLinearFilter);
    expect(texture.generateMipmaps).toBe(true);
    expect(texture.anisotropy).toBe(GODOT_ANISOTROPY_MAX);
  });

  it('turns mipmapping off for the two no-mipmap rows', () => {
    const texture = new THREE.Texture();
    applyTextureFilterState(texture, godotTextureFilterState(0));

    expect(texture.generateMipmaps).toBe(false);
    expect(texture.minFilter).toBe(THREE.NearestFilter);
  });
});

describe('a texture with no mipmaps', () => {
  // Godot's procedural textures never call `generate_mipmaps`
  // (`scene/resources/gradient_texture.cpp`), so a `*_WITH_MIPMAPS` filter
  // samples the base level only.
  it('keeps a mipless texture mipless and degrades the min filter', () => {
    const texture = new THREE.DataTexture(new Uint8Array(4), 1, 1);
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearFilter;
    expect(texture.generateMipmaps).toBe(false);

    applyTextureFilterState(texture, godotTextureFilterState(3));

    expect(texture.generateMipmaps).toBe(false);
    expect(texture.minFilter).toBe(THREE.LinearFilter);
    expect(texture.magFilter).toBe(THREE.LinearFilter);
  });

  it('still uses mipmaps on a texture that has them', () => {
    const texture = new THREE.DataTexture(new Uint8Array(4), 1, 1);
    texture.generateMipmaps = true;

    applyTextureFilterState(texture, godotTextureFilterState(3));

    expect(texture.generateMipmaps).toBe(true);
    expect(texture.minFilter).toBe(THREE.LinearMipmapLinearFilter);
  });
});

describe('a texture with an uploaded mip chain', () => {
  /** A 2 × 2 texture whose chain was built on the CPU, as an imported image's is. */
  function uploadedChain(): THREE.DataTexture {
    const texture = new THREE.DataTexture(new Uint8Array(16), 2, 2);
    texture.mipmaps = [
      { data: new Uint8Array(16), width: 2, height: 2 },
      { data: new Uint8Array(4), width: 1, height: 1 },
    ] as unknown as THREE.DataTexture['mipmaps'];
    return texture;
  }

  it('samples its chain under a mipmapped filter, without asking the GPU for another', () => {
    const texture = uploadedChain();
    applyTextureFilterState(texture, godotTextureFilterState(3));
    expect([texture.minFilter, texture.generateMipmaps]).toEqual([THREE.LinearMipmapLinearFilter, false]);
  });

  it('already matches a mipmapped filter once that filter is applied', () => {
    const texture = uploadedChain();
    applyTextureFilterState(texture, godotTextureFilterState(5));
    expect(textureFilterMatches(texture, godotTextureFilterState(5))).toBe(true);
  });

  it('samples its base level under a filter with no mipmaps (edge case)', () => {
    const texture = uploadedChain();
    applyTextureFilterState(texture, godotTextureFilterState(1));
    expect([texture.minFilter, texture.generateMipmaps]).toEqual([THREE.LinearFilter, false]);
  });
});

describe('dropMipChain', () => {
  it('stops a mipmapped texture generating mipmaps and samples its base level', () => {
    const texture = new THREE.Texture();
    dropMipChain(texture);
    expect([texture.generateMipmaps, texture.minFilter]).toEqual([false, THREE.LinearFilter]);
  });

  it('keeps a nearest mip filter nearest within the level', () => {
    const texture = new THREE.Texture();
    texture.minFilter = THREE.NearestMipmapLinearFilter;
    dropMipChain(texture);
    expect(texture.minFilter).toBe(THREE.NearestFilter);
  });

  it('leaves a filter with no mip lookup as it is (edge case)', () => {
    const texture = new THREE.Texture();
    texture.minFilter = THREE.NearestFilter;
    dropMipChain(texture);
    expect(texture.minFilter).toBe(THREE.NearestFilter);
  });
});

describe('hasDroppedMipChain', () => {
  it('finds the mark dropMipChain leaves on a texture and on its clone', () => {
    const texture = new THREE.Texture();
    dropMipChain(texture);
    expect([hasDroppedMipChain(texture), hasDroppedMipChain(texture.clone())]).toEqual([true, true]);
  });

  it('finds none on a texture that keeps its mip chain (edge case)', () => {
    expect(hasDroppedMipChain(new THREE.Texture())).toBe(false);
  });
});
