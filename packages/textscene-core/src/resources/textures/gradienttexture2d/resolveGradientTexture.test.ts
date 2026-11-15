import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { loadedValue } from '../../reading/reading.testkit';
import { gradientTexture2D } from './resolveGradientTexture';
import { proceduralTextureKey } from '../proceduralTextureCache';
import { TEXTURE_2D } from '../texture2d/kind';
import type { GradientTexture2DSource } from '../texture2d/types';

const GRADIENT = `[sub_resource type="Gradient" id="Gradient_cd1ha"]
interpolation_mode = 2
offsets = PackedFloat32Array(0, 0.642276, 1)
colors = PackedColorArray(1, 1, 1, 1, 1, 1, 1, 0.180392, 1, 1, 1, 0)
`;

/** A radial GradientTexture2D over the gradient, with `extra` property lines. */
function coinScene(extra = ''): string {
  return `${GRADIENT}
[sub_resource type="GradientTexture2D" id="GradientTexture2D_qhu5r"]
gradient = SubResource("Gradient_cd1ha")
fill = 1
fill_from = Vector2(0.5, 0.5)
fill_to = Vector2(0.5, 0.01)
${extra}`;
}

function gradientSource(sceneText: string): GradientTexture2DSource {
  const source = loadedValue(TEXTURE_2D, 'SubResource("GradientTexture2D_qhu5r")', sceneText);
  if (source.form !== 'gradient') throw new Error(`expected a gradient source, got ${source.form}`);
  return source;
}

describe('gradientTexture2D', () => {
  it('rasterises a GradientTexture2D into a DataTexture', () => {
    const resolved = gradientTexture2D(gradientSource(coinScene()));

    expect(resolved!.texture).toBeInstanceOf(THREE.DataTexture);
    expect(resolved!.texture.image.width).toBe(64);
  });

  it('rasterises one decoded value once, under the key that holds it resident', () => {
    const source = gradientSource(coinScene());
    const resolved = gradientTexture2D(source);
    const again = gradientTexture2D(source);

    expect(resolved!.key).toBe(proceduralTextureKey(source, 'GradientTexture2D'));
    expect(again!.texture).toBe(resolved!.texture);
  });

  it('rasterises a width Godot refuses at its 64 default, without throwing', () => {
    const resolved = gradientTexture2D(gradientSource(coinScene('width = 100000')));

    expect(resolved!.texture.image.width).toBe(64);
  });

  it('gives no texture for a GradientTexture2D with no gradient', () => {
    const source = gradientSource(`[sub_resource type="GradientTexture2D" id="GradientTexture2D_qhu5r"]\n`);

    expect(gradientTexture2D(source)).toBeNull();
  });
});
