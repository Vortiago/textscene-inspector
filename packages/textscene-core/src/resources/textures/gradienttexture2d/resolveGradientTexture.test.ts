import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { resolveGradientTexture2D } from './resolveGradientTexture';
import { proceduralTextureKey } from '../proceduralTextureCache';
import { parseTresFile } from '../../../parser/parsedResource';
import type { TscnInternalResource } from '../../../parser/types';

const coinResources: TscnInternalResource[] = [
  {
    id: 'Gradient_cd1ha',
    type: 'Gradient',
    data: {
      interpolation_mode: '2',
      offsets: 'PackedFloat32Array(0, 0.642276, 1)',
      colors: 'PackedColorArray(1, 1, 1, 1, 1, 1, 1, 0.180392, 1, 1, 1, 0)',
    },
  },
  {
    id: 'GradientTexture2D_qhu5r',
    type: 'GradientTexture2D',
    data: {
      gradient: 'SubResource("Gradient_cd1ha")',
      fill: '1',
      fill_from: 'Vector2(0.5, 0.5)',
      fill_to: 'Vector2(0.5, 0.01)',
    },
  },
];

describe('resolveGradientTexture2D', () => {
  it('rasterises a SubResource(GradientTexture2D) into a DataTexture', () => {
    const resolved = resolveGradientTexture2D(
      'SubResource("GradientTexture2D_qhu5r")',
      coinResources
    );
    expect(resolved!.texture).toBeInstanceOf(THREE.DataTexture);
    expect(resolved!.texture.image.width).toBe(64);
  });

  it('pairs the texture with the cache key that holds it resident', () => {
    const resolved = resolveGradientTexture2D(
      'SubResource("GradientTexture2D_qhu5r")',
      coinResources
    );
    expect(resolved!.key).toBe(
      proceduralTextureKey(coinResources, 'GradientTexture2D_qhu5r')
    );
    // Same scene, same sub-resource: one entry, one key, one rasterisation.
    const again = resolveGradientTexture2D(
      'SubResource("GradientTexture2D_qhu5r")',
      coinResources
    );
    expect(again!.key).toBe(resolved!.key);
    expect(again!.texture).toBe(resolved!.texture);
  });

  it('returns null for an ExtResource reference (async image path)', () => {
    expect(resolveGradientTexture2D('ExtResource("3")', coinResources)).toBeNull();
  });

  // A null result carries no key, so a consumer has nothing to pin.
  it('returns null for a SubResource of a different type', () => {
    const resources: TscnInternalResource[] = [
      { id: 'CanvasTexture_x', type: 'CanvasTexture', data: {} },
    ];
    expect(resolveGradientTexture2D('SubResource("CanvasTexture_x")', resources)).toBeNull();
  });

  it('returns null when the gradient reference cannot be resolved', () => {
    const resources: TscnInternalResource[] = [
      {
        id: 'GradientTexture2D_orphan',
        type: 'GradientTexture2D',
        data: { gradient: 'SubResource("Missing")', fill: '1' },
      },
    ];
    expect(
      resolveGradientTexture2D('SubResource("GradientTexture2D_orphan")', resources)
    ).toBeNull();
  });

  it('returns null for undefined / malformed references', () => {
    expect(resolveGradientTexture2D(undefined, coinResources)).toBeNull();
    expect(resolveGradientTexture2D('res://foo.png', coinResources)).toBeNull();
  });
});

/** The gradient block, as `.tres` section text. */
const GRADIENT_SECTION = `[sub_resource type="Gradient" id="Gradient_cd1ha"]
interpolation_mode = 2
offsets = PackedFloat32Array(0, 0.642276, 1)
colors = PackedColorArray(1, 1, 1, 1, 1, 1, 1, 0.180392, 1, 1, 1, 0)
`;

/** The texture's own properties, identical to the inline scene form's. */
const TEXTURE_PROPERTIES = `gradient = SubResource("Gradient_cd1ha")
fill = 1
fill_from = Vector2(0.5, 0.5)
fill_to = Vector2(0.5, 0.01)
`;

/**
 * A material `.tres` carrying the same texture as a `[sub_resource]`, where the
 * reference resolves against the material file's table, not a scene's.
 */
const MATERIAL_FILE = `[gd_resource type="StandardMaterial3D" load_steps=3 format=3 uid="uid://cmat000"]

${GRADIENT_SECTION}
[sub_resource type="GradientTexture2D" id="GradientTexture2D_qhu5r"]
${TEXTURE_PROPERTIES}
[resource]
albedo_texture = SubResource("GradientTexture2D_qhu5r")
roughness = 0.4
`;

/** The rasterised bytes: a comparison that ignores cache and texture identity. */
function pixels(texture: THREE.DataTexture): Uint8Array {
  return texture.image.data as Uint8Array;
}

describe('a GradientTexture2D inside a material .tres', () => {
  it('resolves against the material file’s own sub-resource table', () => {
    // The texture is in no scene's table, so it resolves in the file that carries it.
    const parsed = parseTresFile(MATERIAL_FILE);
    const resolved = resolveGradientTexture2D(
      parsed.properties.albedo_texture,
      parsed.subResources
    );

    expect(resolved!.texture).toBeInstanceOf(THREE.DataTexture);
    expect(resolved!.key).toBe(
      proceduralTextureKey(parsed.subResources, 'GradientTexture2D_qhu5r')
    );
  });

  it('rasterises the same pixels the inline scene form does', () => {
    // The material file's [sub_resource] and the scene's inline one must produce
    // the same pixels, wherever the gradient was saved.
    const parsed = parseTresFile(MATERIAL_FILE);
    const inMaterial = resolveGradientTexture2D(
      parsed.properties.albedo_texture,
      parsed.subResources
    );
    const inline = resolveGradientTexture2D(
      'SubResource("GradientTexture2D_qhu5r")',
      coinResources
    );

    expect(pixels(inMaterial!.texture)).toEqual(pixels(inline!.texture));
  });
});
