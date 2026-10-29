/**
 * The shared procedural dispatch: the React hook and both React-free material
 * paths use one walk, so a slice reaches every consumer.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { NO_FILES, poolsOf } from '../testing/loadedFiles';
import type { TscnInternalResource } from '../../parser/types';
import { WorkerJobRunner } from '../../workers/WorkerJobRunner';
import { resetProceduralTextures } from './proceduralBuilds';
import { resolveProceduralTexture } from './resolveProceduralTexture';

const RESOURCES: TscnInternalResource[] = [
  {
    id: 'Gradient_a',
    type: 'Gradient',
    data: { colors: 'PackedColorArray(1, 1, 1, 1, 0, 0, 0, 1)' },
  },
  {
    id: 'GradientTexture2D_a',
    type: 'GradientTexture2D',
    data: { gradient: 'SubResource("Gradient_a")', width: '8', height: '8' },
  },
  { id: 'FastNoiseLite_a', type: 'FastNoiseLite', data: { frequency: '0.05' } },
  {
    id: 'NoiseTexture2D_a',
    type: 'NoiseTexture2D',
    data: {
      width: '8',
      height: '8',
      noise: 'SubResource("FastNoiseLite_a")',
    },
  },
  { id: 'Other_a', type: 'PlaceholderTexture2D', data: {} },
];

afterEach(() => {
  resetProceduralTextures();
});

describe('resolveProceduralTexture', () => {
  it('resolves a GradientTexture2D, ready at once', () => {
    const resolved = resolveProceduralTexture(
      'SubResource("GradientTexture2D_a")',
      poolsOf(RESOURCES),
      NO_FILES
    );
    if (resolved?.status !== 'ready') throw new Error(`expected a ready gradient, got ${resolved?.status}`);
    expect((resolved.texture.image as { width: number }).width).toBe(8);
    expect(resolved.key).toContain('GradientTexture2D_a');
  });

  it('resolves a NoiseTexture2D as a build, ready once it lands', async () => {
    const pending = resolveProceduralTexture('SubResource("NoiseTexture2D_a")', poolsOf(RESOURCES), NO_FILES);
    if (pending?.status !== 'pending')
      throw new Error(`expected a pending noise build, got ${pending?.status}`);
    const handle = pending.start(new WorkerJobRunner());
    const texture = await handle.settled;
    handle.release();

    expect(resolveProceduralTexture('SubResource("NoiseTexture2D_a")', poolsOf(RESOURCES), NO_FILES)).toEqual(
      {
        status: 'ready',
        texture,
        key: pending.key,
      }
    );
    expect((texture?.image as { width: number }).width).toBe(8);
  });

  it('gives the two slices different keys', () => {
    const gradient = resolveProceduralTexture(
      'SubResource("GradientTexture2D_a")',
      poolsOf(RESOURCES),
      NO_FILES
    );
    const noise = resolveProceduralTexture('SubResource("NoiseTexture2D_a")', poolsOf(RESOURCES), NO_FILES);
    expect(noise?.key).not.toBe(gradient?.key);
  });

  it('declines every non-procedural reference form', () => {
    expect(resolveProceduralTexture(undefined, poolsOf(RESOURCES), NO_FILES)).toBeNull();
    expect(resolveProceduralTexture('res://image.png', poolsOf(RESOURCES), NO_FILES)).toBeNull();
    expect(resolveProceduralTexture('ExtResource("1")', poolsOf(RESOURCES), NO_FILES)).toBeNull();
    expect(resolveProceduralTexture('SubResource("Other_a")', poolsOf(RESOURCES), NO_FILES)).toBeNull();
    expect(resolveProceduralTexture('SubResource("missing")', poolsOf(RESOURCES), NO_FILES)).toBeNull();
  });

  it('hands back the cached gradient on a second call (one rasterisation)', () => {
    const first = resolveProceduralTexture(
      'SubResource("GradientTexture2D_a")',
      poolsOf(RESOURCES),
      NO_FILES
    );
    const second = resolveProceduralTexture(
      'SubResource("GradientTexture2D_a")',
      poolsOf(RESOURCES),
      NO_FILES
    );
    expect(first?.status === 'ready' && second?.status === 'ready' && second.texture === first.texture).toBe(
      true
    );
  });
});
