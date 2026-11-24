import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { decodeArrayMeshTres } from '../../testing/decodeArrayMeshTres';
import { decodeSkin } from './skinData';

// Saved by Godot 4.6.3: pairs of 4, compressed 4, 8 and compressed 8 weights, then a surface with no skin.
const surfaces = decodeArrayMeshTres(
  readFileSync(join(import.meta.dirname, 'testing', 'skinFormats.tres'), 'utf8'),
  'res://skinFormats.tres'
).surfaces;

/** The bones and weights the generating script wrote for `vertex`, `count` of each. */
function writtenSkin(vertex: number, count: number): { indices: number[]; weights: number[] } {
  const indices = Array.from({ length: count }, (_, slot) => (vertex * 3 + slot * 5) % 11);
  const raw = Array.from({ length: count }, (_, slot) => 1 / (slot + 1 + (vertex % 3)));
  const total = raw.reduce((sum, weight) => sum + weight, 0);
  return { indices, weights: raw.map((weight) => weight / total) };
}

function expectWeights(actual: ArrayLike<number>, expected: readonly number[]): void {
  expected.forEach((weight, slot) => expect(actual[slot]).toBeCloseTo(weight, 4));
}

describe('decodeSkin', () => {
  it.each([0, 2])('reads the bones and weights of the 4-weight surface %i', (index) => {
    const bones = surfaces[index]!.bones!;
    for (let vertex = 0; vertex < 6; vertex++) {
      const written = writtenSkin(vertex, 4);
      expect([...bones.indices.subarray(vertex * 4, vertex * 4 + 4)]).toEqual(written.indices);
      expectWeights(bones.weights.subarray(vertex * 4, vertex * 4 + 4), written.weights);
    }
  });

  it('gives a 4-weight surface no separate bones for the vertex stage', () => {
    expect(surfaces[0]!.vertexStageBones).toBeUndefined();
  });

  it.each([4, 6])(
    'skins the 8-weight surface %i with its 4 largest weights, scaled to a sum of 1',
    (index) => {
      const bones = surfaces[index]!.bones!;
      for (let vertex = 0; vertex < 6; vertex++) {
        const written = writtenSkin(vertex, 8);
        const kept = written.weights.slice(0, 4);
        const total = kept.reduce((sum, weight) => sum + weight, 0);
        expect([...bones.indices.subarray(vertex * 4, vertex * 4 + 4)]).toEqual(written.indices.slice(0, 4));
        expectWeights(
          bones.weights.subarray(vertex * 4, vertex * 4 + 4),
          kept.map((weight) => weight / total)
        );
      }
    }
  );

  it('gives the vertex stage of an 8-weight surface the 16-byte records Godot binds', () => {
    const stage = surfaces[4]!.vertexStageBones!;
    const first = writtenSkin(0, 8);

    expect([...stage.indices.subarray(0, 4)]).toEqual(first.indices.slice(0, 4));
    expectWeights(
      stage.weights.subarray(0, 4),
      first.indices.slice(4).map((index) => index / 65535)
    );
    expect([...stage.indices.subarray(4, 8)]).toEqual(
      first.weights.slice(0, 4).map((weight) => Math.min(Math.floor(weight * 65535), 65535))
    );
  });

  it('gives a surface with no skin_data no bones', () => {
    expect(surfaces[8]!.bones).toBeUndefined();
  });

  it('reads no bones from skin_data shorter than its vertices need (error case)', () => {
    expect(decodeSkin(new Uint8Array(15), 1, { count: 4, stride: 16 })).toBeUndefined();
  });
});
