/**
 * `texture_filter` through the imperative (`.tres`) material path.
 *
 * The property is per-MATERIAL in Godot but lives on the Texture in three, and
 * the loader caches ONE texture per path — so the contract under test is that
 * two materials sharing an image get their own sampler state and the shared
 * source is never written to. Getting this wrong is silent and order-dependent:
 * whichever material built last would win for every consumer.
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
 * A texture as the LOADER hands it out: tagged `SRGBColorSpace` before any slot
 * is known (`resources/formats/image/textureProcessing.ts`). Binding is what
 * decides the colour space each Godot slot actually samples in, so starting
 * from three's own default would let a raw slot pass without being bound.
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

  it('hands back the shared texture itself when the filter is unauthored', () => {
    // Godot's default IS three's default state, so an ordinary material must
    // not clone — this is what keeps the change off every existing baseline.
    const shared = loadedTexture();
    expect(build({}, { albedo_texture: shared }).map).toBe(shared);
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
