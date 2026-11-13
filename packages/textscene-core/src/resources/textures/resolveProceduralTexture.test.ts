/**
 * The shared procedural dispatch: the React hook and both React-free material
 * paths use one walk, so a slice reaches every consumer.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { loadedValue } from '../reading/reading.testkit';
import { WorkerJobRunner } from '../../workers/WorkerJobRunner';
import { resetProceduralTextures } from './proceduralBuilds';
import { proceduralTexture2D } from './resolveProceduralTexture';
import { TEXTURE_2D } from './texture2d/kind';
import type { Texture2DSource } from './texture2d/types';

const SCENE = `[sub_resource type="Gradient" id="Gradient_a"]
colors = PackedColorArray(1, 1, 1, 1, 0, 0, 0, 1)

[sub_resource type="GradientTexture2D" id="GradientTexture2D_a"]
gradient = SubResource("Gradient_a")
width = 8
height = 8

[sub_resource type="FastNoiseLite" id="FastNoiseLite_a"]
frequency = 0.05

[sub_resource type="NoiseTexture2D" id="NoiseTexture2D_a"]
width = 8
height = 8
noise = SubResource("FastNoiseLite_a")

[sub_resource type="ViewportTexture" id="ViewportTexture_a"]
viewport_path = NodePath("SubViewport")
`;

/** The source of the pixels `ref` names in the scene. */
function sourceAt(ref: string): Texture2DSource {
  const texture = loadedValue(TEXTURE_2D, ref, SCENE);
  if (texture.form === 'canvas' || texture.form === 'atlas')
    throw new Error(`expected a source, got ${texture.form}`);
  return texture;
}

const GRADIENT = sourceAt('SubResource("GradientTexture2D_a")');
const NOISE = sourceAt('SubResource("NoiseTexture2D_a")');

afterEach(() => {
  resetProceduralTextures();
});

describe('proceduralTexture2D', () => {
  it('resolves a GradientTexture2D, ready at once', () => {
    const resolved = proceduralTexture2D(GRADIENT);
    if (resolved?.status !== 'ready') throw new Error(`expected a ready gradient, got ${resolved?.status}`);
    expect((resolved.texture.image as { width: number }).width).toBe(8);
  });

  it('resolves a NoiseTexture2D as a build, ready once it lands', async () => {
    const pending = proceduralTexture2D(NOISE);
    if (pending?.status !== 'pending')
      throw new Error(`expected a pending noise build, got ${pending?.status}`);
    const handle = pending.start(new WorkerJobRunner());
    const texture = await handle.settled;
    handle.release();

    expect(proceduralTexture2D(NOISE)).toEqual({ status: 'ready', texture, key: pending.key });
    expect((texture?.image as { width: number }).width).toBe(8);
  });

  it('gives the two slices different keys', () => {
    expect(proceduralTexture2D(NOISE)?.key).not.toBe(proceduralTexture2D(GRADIENT)?.key);
  });

  it('declines a texture that is not procedural', () => {
    expect(proceduralTexture2D(sourceAt('SubResource("ViewportTexture_a")'))).toBeNull();
  });

  it('hands back the cached gradient on a second call (one rasterisation)', () => {
    const first = proceduralTexture2D(GRADIENT);
    const second = proceduralTexture2D(GRADIENT);
    expect(first?.status === 'ready' && second?.status === 'ready' && second.texture === first.texture).toBe(
      true
    );
  });
});
