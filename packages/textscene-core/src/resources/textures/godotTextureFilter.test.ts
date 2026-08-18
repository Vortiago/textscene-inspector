/**
 * Godot's `BaseMaterial3D.texture_filter` → three sampler state.
 *
 * `godotTextureFilter.ts` carries the citations; this file owns the expected
 * values, every one read off Godot 4.6.3's `MaterialStorage::samplers_rd_allocate`
 * rather than off our own output.
 *
 * The load-bearing case is row 3. It is Godot's default AND three's default
 * state, which is what makes an unauthored `texture_filter` a byte-identical
 * no-op — and therefore why wiring this property moves no existing baseline.
 */

import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  GODOT_ANISOTROPY_MAX,
  GODOT_TEXTURE_FILTER_DEFAULT,
  applyTextureFilterState,
  godotTextureFilterState,
  textureFilterMatches,
} from './godotTextureFilter';

/**
 * Godot's six sampler states. `min_filter` there is the WITHIN-level filter and
 * `mip_filter` the BETWEEN-level one; three fuses both into `minFilter`. Rows 0
 * and 1 set `max_lod = 0`, i.e. no mipmapping at all.
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

  it("falls back to Godot's default for an absent or out-of-range value", () => {
    // `BaseMaterial3D::texture_filter = TEXTURE_FILTER_LINEAR_WITH_MIPMAPS`.
    expect(GODOT_TEXTURE_FILTER_DEFAULT).toBe(3);
    const fallback = godotTextureFilterState(3);
    expect(godotTextureFilterState(undefined)).toEqual(fallback);
    expect(godotTextureFilterState(99)).toEqual(fallback);
    expect(godotTextureFilterState(-1)).toEqual(fallback);
  });

  it("matches a fresh THREE.Texture's own defaults, so an unauthored filter is a no-op", () => {
    // This is what makes wiring texture_filter move zero existing baselines: a
    // material that does not author it must produce a byte-identical render.
    expect(textureFilterMatches(new THREE.Texture(), godotTextureFilterState(undefined))).toBe(
      true
    );
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
  // samples base level only — it does not manufacture a mip chain.
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
