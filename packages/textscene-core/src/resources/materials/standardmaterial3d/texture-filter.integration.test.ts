/**
 * `texture_filter` through the imperative (`.tres`) material path. It is per material in
 * Godot but lives on the cached Texture in three, so two materials sharing an image get
 * their own sampler state, and the shared source is never written to. A write to it
 * fails silently: the last material built wins for every consumer.
 */

import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildStandardMaterial } from './build';
import { parseStandardMaterial3DScalars } from './scalars';
import type { ResolvedTextureSlots } from './types';
import { GODOT_ANISOTROPY_MAX } from '../../textures/godotTextureFilter';

function build(
  properties: Record<string, string>,
  textures: ResolvedTextureSlots
): THREE.MeshStandardMaterial {
  return buildStandardMaterial(
    parseStandardMaterial3DScalars(properties),
    textures
  ) as THREE.MeshStandardMaterial;
}

/**
 * A texture as the loader hands it out: tagged `SRGBColorSpace` before any slot is known
 * (`resources/formats/image/textureProcessing.ts`). From three's own default, a raw slot
 * would pass without being bound.
 */
function loadedTexture(): THREE.Texture {
  const texture = new THREE.Texture();
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

describe('texture_filter integration — shared textures', () => {
  it('gives two materials sharing one texture their own sampler state', () => {
    const shared = loadedTexture();

    const pixelArt = build({ texture_filter: '0' }, { albedo_texture: shared });
    const anisotropic = build({ texture_filter: '5' }, { albedo_texture: shared });

    expect(pixelArt.map!.magFilter).toBe(THREE.NearestFilter);
    expect(pixelArt.map!.generateMipmaps).toBe(false);
    expect(anisotropic.map!.magFilter).toBe(THREE.LinearFilter);
    expect(anisotropic.map!.anisotropy).toBe(GODOT_ANISOTROPY_MAX);

    expect(pixelArt.map).not.toBe(anisotropic.map);
    // The source must come back untouched, or every other consumer of this
    // path silently inherits whichever filter was applied last.
    expect(shared.magFilter).toBe(THREE.LinearFilter);
    expect(shared.minFilter).toBe(THREE.LinearMipMapLinearFilter);
    expect(shared.generateMipmaps).toBe(true);
    expect(shared.anisotropy).toBe(1);
  });

  it('clones to the stated Repeat default even when the filter is unauthored', () => {
    // The consumer states the wrapping, not the loader. The loader hands out a
    // clamp entry and a default material asks for Repeat, so the map is a Repeat
    // clone that shares the source. The shared entry stays clamp for 2D.
    const shared = loadedTexture();
    const material = build({}, { albedo_texture: shared });

    expect(material.map).not.toBe(shared);
    expect(material.map!.source).toBe(shared.source);
    expect(material.map!.wrapS).toBe(THREE.RepeatWrapping);
    expect(material.map!.wrapT).toBe(THREE.RepeatWrapping);
    expect(shared.wrapS).toBe(THREE.ClampToEdgeWrapping);
  });

  it('clones once when a material diverges on both filter and UV scale', () => {
    const shared = loadedTexture();
    const material = build(
      { texture_filter: '0', uv1_scale: 'Vector3(2, 2, 1)' },
      { albedo_texture: shared }
    );

    expect(material.map!.magFilter).toBe(THREE.NearestFilter);
    expect(material.map!.repeat.x).toBe(2);
    expect(shared.magFilter).toBe(THREE.LinearFilter);
    expect(shared.repeat.x).toBe(1);
  });

  it('applies the filter to every texture slot, not only albedo', () => {
    const shared = loadedTexture();
    const material = build(
      {
        texture_filter: '0',
        // The normal slot is gated on `normal_enabled`, as Godot gates it.
        normal_enabled: 'true',
        normal_texture: 'ExtResource("1")',
      },
      { albedo_texture: shared, normal_texture: shared, roughness_texture: shared }
    );

    expect(material.map!.magFilter).toBe(THREE.NearestFilter);
    expect(material.normalMap!.magFilter).toBe(THREE.NearestFilter);
    expect(material.roughnessMap!.magFilter).toBe(THREE.NearestFilter);
  });
});
