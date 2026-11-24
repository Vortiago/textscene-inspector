import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { decodeArrayMeshTres } from '../../testing/decodeArrayMeshTres';
import { decodeCustomArrays } from './customArrays';
import { surfaceLayout } from './surfaceFormat';

// Saved by Godot 4.6.3: one surface per custom format, in slot `format / 2`, RGBA_FLOAT in the others.
function savedMesh(file: string) {
  return decodeArrayMeshTres(
    readFileSync(join(import.meta.dirname, 'testing', file), 'utf8'),
    `res://${file}`
  );
}

/** The lanes each format stores, in format order. */
const STORED_LANES = [4, 4, 2, 4, 1, 2, 3, 4];

/** The decimals each format keeps of the value the script wrote: 8-bit, 8-bit signed, half, then float. */
const KEPT_DECIMALS = [2, 2, 3, 3, 6, 6, 6, 6];

/** The value the generating script wrote to lane `lane` of vertex `vertex` of the surface of `format`. */
function writtenLane(format: number, vertex: number, lane: number): number {
  const t = (0.17 * (vertex + 1) + 0.29 * (lane + 1) + 0.11 * format) % 1;
  return format === 1 ? t * 2 - 1 : t;
}

describe('decodeCustomArrays', () => {
  const surfaces = savedMesh('customFormats.tres').surfaces;

  it.each(STORED_LANES.map((lanes, format) => [format, lanes]))(
    'reads the format %i array as its %i stored lanes, then 0 and an alpha of 1',
    (format, lanes) => {
      const values = surfaces[format]!.customs![Math.floor(format / 2)]!;
      for (let vertex = 0; vertex < 6; vertex++) {
        for (let lane = 0; lane < 4; lane++) {
          const expected = lane < lanes ? writtenLane(format, vertex, lane) : lane === 3 ? 1 : 0;
          expect(values[vertex * 4 + lane]).toBeCloseTo(expected, KEPT_DECIMALS[format]);
        }
      }
    }
  );

  it('reads each array at its own offset after the arrays before it', () => {
    const fillers = surfaces[7]!.customs!;

    expect([...fillers[0]!.subarray(0, 4)].map((lane) => +lane.toFixed(6))).toEqual([0, 0.2, 0.3, 1]);
    expect([...fillers[2]!.subarray(0, 4)].map((lane) => +lane.toFixed(6))).toEqual([0.2, 0.2, 0.3, 1]);
  });

  it('reads the arrays of a compressed surface after its 4-byte UV', () => {
    const [plain, compressed] = savedMesh('customCompressed.tres').surfaces;

    expect(compressed!.customs![1]![0]).toBeCloseTo(0.2, 6);
    expect(plain!.customs![1]![0]).toBeCloseTo(0, 6);
    expect(compressed!.customs![3]![1]).toBeCloseTo(1, 6);
  });

  it('gives a surface with no custom array none', () => {
    expect(savedMesh('skinFormats.tres').surfaces[0]!.customs).toBeUndefined();
  });

  it('reads no custom array from attribute_data narrower than its format, and reports the width (error case)', () => {
    const rgbaFloatCustom0 = (1 << 0) | (1 << 6) | (7 << 13);
    const widths: number[] = [];

    const customs = decodeCustomArrays(new Uint8Array(8), 1, surfaceLayout(rgbaFloatCustom0), (width) =>
      widths.push(width)
    );

    expect(customs).toEqual([undefined, undefined, undefined, undefined]);
    expect(widths).toEqual([8]);
  });
});
