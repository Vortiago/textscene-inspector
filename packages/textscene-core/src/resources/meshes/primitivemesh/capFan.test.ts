import { describe, expect, it } from 'vitest';
import { BOTTOM_CAP, TOP_CAP, writeCapFan } from './capFan';
import { rimColumns } from './rimPoint';
import { SurfaceWriter } from './surfaceWriter';
import { vertexOf } from './surface.testkit';

/** Four columns and the seam: the rim starts and ends at +Z. */
const RIM = rimColumns(4);

describe('writeCapFan', () => {
  it('writes the centre, then one vertex for each rim column', () => {
    const writer = new SurfaceWriter(false);
    writeCapFan(writer, RIM, TOP_CAP, 1, 2);
    const surface = writer.surface();

    expect(writer.vertexCount).toBe(6);
    expect(vertexOf(surface.positions, 0)).toEqual([0, 1, 0]);
    expect(vertexOf(surface.positions, 1)).toEqual([0, 1, 2]);
  });

  it('faces the top cap up, with the newer rim vertex last', () => {
    const writer = new SurfaceWriter(false);
    writeCapFan(writer, RIM, TOP_CAP, 1, 2);
    const surface = writer.surface();

    expect(vertexOf(surface.normals, 3)).toEqual([0, 1, 0]);
    expect(Array.from(surface.indices).slice(0, 6)).toEqual([0, 2, 1, 0, 3, 2]);
  });

  it('faces the bottom cap down, with the newer rim vertex first', () => {
    const writer = new SurfaceWriter(false);
    writeCapFan(writer, RIM, BOTTOM_CAP, -1, 2);
    const surface = writer.surface();

    expect(vertexOf(surface.normals, 3)).toEqual([0, -1, 0]);
    expect(Array.from(surface.indices).slice(0, 6)).toEqual([0, 1, 2, 0, 2, 3]);
  });

  it('centres the top cap on (0.25, 0.75) in UV', () => {
    const writer = new SurfaceWriter(false);
    writeCapFan(writer, RIM, TOP_CAP, 1, 2);
    const { uvs } = writer.surface();

    expect(vertexOf(uvs, 0, 2)).toEqual([0.25, 0.75]);
    expect(vertexOf(uvs, 1, 2)).toEqual([0.25, 1]);
  });

  it('centres the bottom cap on (0.75, 0.75) in UV, with V mirrored', () => {
    const writer = new SurfaceWriter(false);
    writeCapFan(writer, RIM, BOTTOM_CAP, -1, 2);
    const { uvs } = writer.surface();

    expect(vertexOf(uvs, 0, 2)).toEqual([0.75, 0.75]);
    expect(vertexOf(uvs, 1, 2)).toEqual([0.75, 0.5]);
  });

  it('places UV2 with the given function of the unit disc point', () => {
    const writer = new SurfaceWriter(true);
    writeCapFan(writer, RIM, TOP_CAP, 1, 2, (x, z) => [x + 10, z + 20]);
    const { uv2s } = writer.surface();

    expect(vertexOf(uv2s, 0, 2)).toEqual([10, 20]);
    expect(vertexOf(uv2s, 1, 2)).toEqual([10, 21]);
  });
});
