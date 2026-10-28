/**
 * `texture_mipmap_bias` through the imperative (`.tres`) material path: which surfaces compile the
 * bias into their program. The bias offsets the mip level on the four mipmapped filters only
 * (`material_storage.cpp:2454-2502`), so a NEAREST or LINEAR surface compiles none.
 */

import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildMaterial } from './buildMaterial.testkit';
import { parseStandardMaterial3DScalars } from './scalars';
import type { ResolvedTextures } from './types';
import { patchedFragment } from '../../../r3f/testing/patchedFragment';

const BIASED_ALBEDO = 'godotMipmapBiased( map,';

/** A texture as the loader hands it out: a mip chain, which `texture_filter` then keeps or drops. */
function loadedTexture(): THREE.Texture {
  const texture = new THREE.Texture();
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function fragmentOf(properties: Record<string, string>, textures: ResolvedTextures): string {
  return patchedFragment(buildMaterial(parseStandardMaterial3DScalars(properties), textures));
}

describe('texture_mipmap_bias — which surfaces compile the bias', () => {
  it.each([2, 3, 4, 5])('compiles the bias into texture_filter %i, which samples mip levels', (filter) => {
    const fragment = fragmentOf({ texture_filter: String(filter) }, { albedo_texture: loadedTexture() });

    expect(fragment).toContain(BIASED_ALBEDO);
  });

  it.each([0, 1])('compiles no bias into texture_filter %i, which has no mip levels', (filter) => {
    const fragment = fragmentOf({ texture_filter: String(filter) }, { albedo_texture: loadedTexture() });

    expect(fragment).not.toContain('godotMipmapBias');
  });

  it('compiles the bias into the default filter, LINEAR_WITH_MIPMAPS', () => {
    expect(fragmentOf({}, { albedo_texture: loadedTexture() })).toContain(BIASED_ALBEDO);
  });

  it('biases a slot other than the albedo', () => {
    const fragment = fragmentOf({ normal_enabled: 'true' }, { normal_texture: loadedTexture() });

    expect(fragment).toContain('godotMipmapBiased( normalMap,');
  });

  it('biases an unshaded surface', () => {
    const fragment = fragmentOf({ shading_mode: '0' }, { albedo_texture: loadedTexture() });

    expect(fragment).toContain(BIASED_ALBEDO);
  });

  it('compiles no bias into a surface that samples no texture', () => {
    expect(fragmentOf({ albedo_color: 'Color(1, 0, 0, 1)' }, {})).not.toContain('godotMipmapBias');
  });

  it("keeps every other patch of the same surface, which match three's own sample text", () => {
    const fragment = fragmentOf(
      { ao_enabled: 'true', ao_light_affect: '1.0', normal_enabled: 'true' },
      { albedo_texture: loadedTexture(), ao_texture: loadedTexture(), normal_texture: loadedTexture() }
    );

    expect(fragment).toContain('godotAoTextureChannel');
    expect(fragment).toContain('#define USE_PACKED_NORMALMAP');
    expect(fragment).toContain('godotMipmapBiased( aoMap,');
  });
});
