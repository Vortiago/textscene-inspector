/** The capture probes of a `probe_data` and the edges Godot's editor gizmo draws between them. */

import { describe, expect, it } from 'vitest';
import { parseBinaryResource } from '../formats/binaryresource/parse';
import { fileBytes } from '../testing/fileBytes';
import { scenesDir } from '../../parser/testing/parserKit';
import { resolve } from 'node:path';
import { probeEdgeSegments, readCaptureProbes, type CaptureProbes } from './captureProbes';

const FOUR_POINTS = 'PackedVector3Array(0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1)';
const SH_OF_FOUR = `PackedColorArray(${Array(4 * 9 * 4)
  .fill(0)
  .join(', ')})`;

function probeData(fields: { points?: string; tetrahedra?: string; bsp?: string; sh?: string } = {}): string {
  const {
    points = FOUR_POINTS,
    tetrahedra = 'PackedInt32Array(0, 1, 2, 3)',
    bsp = 'PackedInt32Array()',
    sh = SH_OF_FOUR,
  } = fields;
  return `{ "bounds": AABB(0, 0, 0, 1, 1, 1), "points": ${points}, "tetrahedra": ${tetrahedra}, "bsp": ${bsp}, "sh": ${sh}, "interior": false, "baked_exposure": 1.0 }`;
}

/** The segments as `[low, high]` point index pairs, read back from the flat positions of a probe set. */
function pairsOf(probes: CaptureProbes): number[][] {
  const edges = probeEdgeSegments(probes);
  const indexOf = (offset: number) => {
    for (let i = 0; i < probes.points.length; i += 3) {
      if (
        probes.points[i] === edges[offset] &&
        probes.points[i + 1] === edges[offset + 1] &&
        probes.points[i + 2] === edges[offset + 2]
      )
        return i / 3;
    }
    return -1;
  };
  return Array.from({ length: edges.length / 6 }, (_, s) => [indexOf(s * 6), indexOf(s * 6 + 3)]);
}

const pairs = (text: string) => pairsOf(readCaptureProbes(text)!);

describe('probeEdgeSegments', () => {
  it('draws the six edges of one tetrahedron, low index first, in pair order', () => {
    expect(pairs(probeData())).toEqual([
      [0, 1],
      [0, 2],
      [0, 3],
      [1, 2],
      [1, 3],
      [2, 3],
    ]);
  });

  it('orders each pair low first when the tetrahedron lists the higher index first', () => {
    expect(pairs(probeData({ tetrahedra: 'PackedInt32Array(3, 2, 1, 0)' }))[0]).toEqual([2, 3]);
  });

  it('skips an edge a later tetrahedron repeats (edge case)', () => {
    expect(pairs(probeData({ tetrahedra: 'PackedInt32Array(0, 1, 2, 3, 3, 2, 1, 0)' }))).toHaveLength(6);
  });

  it('adds no segment for an index outside the points (edge case)', () => {
    expect(pairs(probeData({ tetrahedra: 'PackedInt32Array(0, 1, 2, 9)' }))).toEqual([
      [0, 1],
      [0, 2],
      [1, 2],
    ]);
  });
});

describe('readCaptureProbes', () => {
  it.each([
    ['no points', { points: 'PackedVector3Array()', sh: 'PackedColorArray()' }],
    ['sh that is not nine colours per point', { sh: 'PackedColorArray(0, 0, 0, 0)' }],
    ['tetrahedra that are not whole groups of 4', { tetrahedra: 'PackedInt32Array(0, 1, 2)' }],
    ['bsp that is not whole groups of 6', { bsp: 'PackedInt32Array(0, 1, 2, 3)' }],
  ])('reads none for %s', (_label, fields) => {
    expect(readCaptureProbes(probeData(fields))).toBeNull();
  });

  it('reads none for a dictionary that lacks a required key', () => {
    expect(readCaptureProbes(probeData().replace('"bsp"', '"x"'))).toBeNull();
  });

  it('reads none when there is no probe_data', () => {
    expect(readCaptureProbes(undefined)).toBeNull();
  });
});

describe('capture probes of the corpus bakes', () => {
  const probesOf = async (path: string) => {
    const { properties } = await parseBinaryResource(fileBytes(resolve(scenesDir(), path)));
    return readCaptureProbes(properties.probe_data)!;
  };

  it.each([
    ['demos/3d/ragdoll_physics/ragdoll_physics.lmbake', 1183],
    ['demos/3d/global_illumination/zdm2_all.lmbake', 10309],
    ['demos/3d/global_illumination/zdm2_indirect.lmbake', 10309],
    ['fixtures/unit-lightmap-gi-baked.lmbake', 942],
  ])('%s has %i unique edges, the first three from point 0', async (path, count) => {
    const probes = await probesOf(path);
    expect(probeEdgeSegments(probes).length / 6).toBe(count);
    expect(pairsOf(probes).slice(0, 3)).toEqual([
      [0, 8],
      [0, 9],
      [0, 11],
    ]);
  });
});
