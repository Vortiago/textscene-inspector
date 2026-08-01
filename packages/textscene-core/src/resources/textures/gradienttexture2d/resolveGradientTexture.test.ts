import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  resolveGradientTexture2D,
  resolveGradientTexture2DFromResource,
} from './resolveGradientTexture';
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

  // A null result is also the absence of a key: a reference the cache holds
  // nothing for must not hand back something a consumer would pin.
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

/** The gradient block both arrival paths carry, as `.tres` section text. */
const GRADIENT_SECTION = `[sub_resource type="Gradient" id="Gradient_cd1ha"]
interpolation_mode = 2
offsets = PackedFloat32Array(0, 0.642276, 1)
colors = PackedColorArray(1, 1, 1, 1, 1, 1, 1, 0.180392, 1, 1, 1, 0)
`;

/** The texture's own properties, identical in both arrivals. */
const TEXTURE_PROPERTIES = `gradient = SubResource("Gradient_cd1ha")
fill = 1
fill_from = Vector2(0.5, 0.5)
fill_to = Vector2(0.5, 0.01)
`;

/** A standalone `GradientTexture2D.tres`: the `[resource]` body IS the texture. */
const TEXTURE_FILE = `[gd_resource type="GradientTexture2D" load_steps=2 format=3 uid="uid://cgt2d00"]

${GRADIENT_SECTION}
[resource]
${TEXTURE_PROPERTIES}`;

/**
 * A material `.tres` carrying the same texture as a `[sub_resource]` — the
 * shape a procedural material uses, where the reference resolves against the
 * MATERIAL FILE's table rather than any scene's.
 */
const MATERIAL_FILE = `[gd_resource type="StandardMaterial3D" load_steps=3 format=3 uid="uid://cmat000"]

${GRADIENT_SECTION}
[sub_resource type="GradientTexture2D" id="GradientTexture2D_qhu5r"]
${TEXTURE_PROPERTIES}
[resource]
albedo_texture = SubResource("GradientTexture2D_qhu5r")
roughness = 0.4
`;

/** The rasterised bytes, the comparison that ignores cache/texture identity. */
function pixels(texture: THREE.DataTexture): Uint8Array {
  return texture.image.data as Uint8Array;
}

describe('resolveGradientTexture2DFromResource', () => {
  it('rasterises a standalone .tres identically to the same texture inline', () => {
    // One property set, two serializations: the external file's [resource] body
    // and the inline [sub_resource] must produce the same pixels, or a shipped
    // gradient would render differently depending on how it was saved.
    const external = resolveGradientTexture2DFromResource(parseTresFile(TEXTURE_FILE));
    const inline = resolveGradientTexture2D(
      'SubResource("GradientTexture2D_qhu5r")',
      coinResources
    );

    expect(external!.texture).toBeInstanceOf(THREE.DataTexture);
    expect(external!.texture.image.width).toBe(64);
    expect(pixels(external!.texture)).toEqual(pixels(inline!.texture));
  });

  it('pairs the texture with the key that holds it, one entry per loaded file', () => {
    const parsed = parseTresFile(TEXTURE_FILE);
    const first = resolveGradientTexture2DFromResource(parsed);
    const again = resolveGradientTexture2DFromResource(parsed);

    expect(first!.key).toBe(proceduralTextureKey(parsed.subResources, '[resource]'));
    expect(again!.texture).toBe(first!.texture);
    // A re-parse is a different load: new table identity, new entry, new key.
    const reparsed = resolveGradientTexture2DFromResource(parseTresFile(TEXTURE_FILE));
    expect(reparsed!.key).not.toBe(first!.key);
  });

  it('returns null for a .tres of another resource type (error path)', () => {
    expect(resolveGradientTexture2DFromResource(parseTresFile(MATERIAL_FILE))).toBeNull();
  });

  it('returns null when the gradient is an ExtResource or missing (edge case)', () => {
    // A separate Gradient.tres would have to be fetched first; the synchronous
    // path declines rather than rasterising a stopless gradient.
    const external = `[gd_resource type="GradientTexture2D" format=3]

[ext_resource type="Gradient" path="res://ramp.tres" id="1_abc"]

[resource]
gradient = ExtResource("1_abc")
`;
    expect(resolveGradientTexture2DFromResource(parseTresFile(external))).toBeNull();
    const bare = '[gd_resource type="GradientTexture2D" format=3]\n\n[resource]\n';
    expect(resolveGradientTexture2DFromResource(parseTresFile(bare))).toBeNull();
  });
});

describe('a GradientTexture2D inside a material .tres', () => {
  it('resolves against the material file’s own sub-resource table', () => {
    // The procedural-material shape: the texture never appears in any scene's
    // table, so the reference must be resolved in the file that carries it.
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

  it('rasterises the same pixels the standalone .tres and the inline form do', () => {
    const parsed = parseTresFile(MATERIAL_FILE);
    const inMaterial = resolveGradientTexture2D(
      parsed.properties.albedo_texture,
      parsed.subResources
    );
    const standalone = resolveGradientTexture2DFromResource(parseTresFile(TEXTURE_FILE));

    expect(pixels(inMaterial!.texture)).toEqual(pixels(standalone!.texture));
  });
});
