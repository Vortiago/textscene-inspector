/**
 * UV transforms over a SHARED texture, through the imperative material path.
 *
 * Several materials legitimately sample one image with different `uv1_scale`;
 * `buildStandardMaterial` must clone per material so their repeats cannot
 * clobber each other, and must never write to the loader's cached source.
 */

import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { buildStandardMaterial } from './build';
import { parseStandardMaterial3DScalars } from './scalars';

function withScale(scale: number, texture: THREE.Texture): THREE.MeshStandardMaterial {
  return buildStandardMaterial(
    parseStandardMaterial3DScalars({ uv1_scale: `Vector3(${scale}, ${scale}, 1)` }),
    { albedo_texture: texture }
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

describe('UV transform integration — shared textures', () => {
  it('applies different UV transforms to materials sharing one texture', () => {
    // A single shared source texture, as if resolved once from ExtResource("1").
    const shared = loadedTexture();

    const twice = withScale(2, shared);
    const fourTimes = withScale(4, shared);

    expect(twice.map!.repeat.x).toBe(2);
    expect(twice.map!.repeat.y).toBe(2);
    expect(fourTimes.map!.repeat.x).toBe(4);
    expect(fourTimes.map!.repeat.y).toBe(4);

    // Cloned per material, so the two maps are distinct and neither is the
    // shared source itself.
    expect(twice.map).not.toBe(fourTimes.map);
    expect(twice.map).not.toBe(shared);
    expect(fourTimes.map).not.toBe(shared);
  });

  it('handles six materials with different UV scales (showcase scenario)', () => {
    const shared = loadedTexture();
    const scales = [0.25, 0.5, 1.0, 2.0, 4.0, 8.0];

    const materials = scales.map((scale) => withScale(scale, shared));

    for (const [index, material] of materials.entries()) {
      expect(material.map!.repeat.x).toBeCloseTo(scales[index]!, 5);
      expect(material.map!.repeat.y).toBeCloseTo(scales[index]!, 5);
    }

    // Five clones plus the identity scale, which shares the source rather than
    // cloning it for a transform that asks for nothing.
    expect(new Set(materials.map((m) => m.map)).size).toBe(6);
    expect(materials[2]!.map).toBe(shared);
  });
});
