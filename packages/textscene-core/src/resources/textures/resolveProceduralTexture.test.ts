/**
 * The shared procedural dispatch: one walk that every consumer — the React hook
 * and both React-free material paths — uses, so a slice cannot reach some
 * consumers and not others.
 */
import { afterEach, describe, expect, it } from 'vitest';
import type { TscnInternalResource } from '../../parser/types';
import { clearProceduralTextureCache } from './proceduralTextureCache';
import { resolveProceduralTexture } from './resolveProceduralTexture';

const RESOURCES: TscnInternalResource[] = [
  {
    id: 'Gradient_a',
    type: 'Gradient',
    data: { id: 'Gradient_a', colors: 'PackedColorArray(1, 1, 1, 1, 0, 0, 0, 1)' },
  },
  {
    id: 'GradientTexture2D_a',
    type: 'GradientTexture2D',
    data: { id: 'GradientTexture2D_a', gradient: 'SubResource("Gradient_a")', width: '8', height: '8' },
  },
  { id: 'FastNoiseLite_a', type: 'FastNoiseLite', data: { id: 'FastNoiseLite_a', frequency: '0.05' } },
  {
    id: 'NoiseTexture2D_a',
    type: 'NoiseTexture2D',
    data: {
      id: 'NoiseTexture2D_a',
      width: '8',
      height: '8',
      noise: 'SubResource("FastNoiseLite_a")',
    },
  },
  { id: 'Other_a', type: 'PlaceholderTexture2D', data: { id: 'Other_a' } },
];

afterEach(() => {
  clearProceduralTextureCache();
});

describe('resolveProceduralTexture', () => {
  it('resolves a GradientTexture2D', () => {
    const resolved = resolveProceduralTexture('SubResource("GradientTexture2D_a")', RESOURCES)!;
    expect((resolved.texture.image as { width: number }).width).toBe(8);
    expect(resolved.key).toContain('GradientTexture2D_a');
  });

  it('resolves a NoiseTexture2D', () => {
    const resolved = resolveProceduralTexture('SubResource("NoiseTexture2D_a")', RESOURCES)!;
    expect((resolved.texture.image as { width: number }).width).toBe(8);
    expect(resolved.key).toContain('NoiseTexture2D_a');
  });

  it('gives the two slices different textures and keys', () => {
    const gradient = resolveProceduralTexture('SubResource("GradientTexture2D_a")', RESOURCES)!;
    const noise = resolveProceduralTexture('SubResource("NoiseTexture2D_a")', RESOURCES)!;
    expect(noise.texture).not.toBe(gradient.texture);
    expect(noise.key).not.toBe(gradient.key);
  });

  it('declines every non-procedural reference form', () => {
    expect(resolveProceduralTexture(undefined, RESOURCES)).toBeNull();
    expect(resolveProceduralTexture('res://image.png', RESOURCES)).toBeNull();
    expect(resolveProceduralTexture('ExtResource("1")', RESOURCES)).toBeNull();
    expect(resolveProceduralTexture('SubResource("Other_a")', RESOURCES)).toBeNull();
    expect(resolveProceduralTexture('SubResource("missing")', RESOURCES)).toBeNull();
  });

  it('hands back the cached texture on a second call (one rasterisation)', () => {
    const first = resolveProceduralTexture('SubResource("NoiseTexture2D_a")', RESOURCES)!;
    const second = resolveProceduralTexture('SubResource("NoiseTexture2D_a")', RESOURCES)!;
    expect(second.texture).toBe(first.texture);
  });
});
