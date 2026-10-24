import { describe, expect, it } from 'vitest';
import { rowAt, writeRings } from './rows';
import { SurfaceWriter } from './surfaceWriter';

describe('rowAt', () => {
  it('puts the first row at the top edge, with V 0', () => {
    expect(rowAt(0, 4, 2)).toEqual({ v: 0, y: 1 });
  });

  it('puts the last row at the bottom edge, with V 1', () => {
    expect(rowAt(4, 4, 2)).toEqual({ v: 1, y: -1 });
  });

  it('rounds V and Y to single precision, as Godot holds them in a float', () => {
    // 1/3 as a float is 0.3333333432674408; 0.5 - 0.3333333432674408 rounds to 0.1666666567325592.
    expect(rowAt(1, 3, 1)).toEqual({ v: 0.3333333432674408, y: 0.1666666567325592 });
  });
});

describe('writeRings', () => {
  /** A ring of three vertices at the given Y. */
  function writeTriangleRing(writer: SurfaceWriter, y: number): void {
    for (let i = 0; i < 3; i++) writer.vertex([i, y, 0], [0, 0, 1], [1, 0, 0, 1], [0, 0], [0, 0]);
  }

  it('writes rowCount + 1 rings, numbered from the top down', () => {
    const writer = new SurfaceWriter(false);
    const rows: number[] = [];
    writeRings(writer, 2, (j) => {
      rows.push(j);
      writeTriangleRing(writer, j);
    });

    expect(rows).toEqual([0, 1, 2]);
    expect(writer.vertexCount).toBe(9);
  });

  it('joins each ring to the one above with quadBetweenRows, column by column', () => {
    const writer = new SurfaceWriter(false);
    writeRings(writer, 1, (j) => writeTriangleRing(writer, j));

    expect(Array.from(writer.surface().indices)).toEqual([0, 1, 3, 1, 4, 3, 1, 2, 4, 2, 5, 4]);
  });

  it('numbers the rings from the vertex the writer is at (edge case)', () => {
    const writer = new SurfaceWriter(false);
    writeTriangleRing(writer, 5);
    writeRings(writer, 1, (j) => writeTriangleRing(writer, j));

    expect(Array.from(writer.surface().indices).slice(0, 3)).toEqual([3, 4, 6]);
  });
});
