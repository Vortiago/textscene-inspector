import { describe, expect, it } from 'vitest';
import { buildCylinderMeshSurface } from './build';
import { expectClockwiseFronts, expectClose, vertexOf } from '../primitivemesh/surface.testkit';
import type { CylinderMeshProperties } from './types';

/** Four segments round and no extra rings: a side of two rows of five vertices, then each cap. */
const COARSE: CylinderMeshProperties = {
  topRadius: 0.5,
  bottomRadius: 0.5,
  height: 2,
  radialSegments: 4,
  rings: 0,
  capTop: true,
  capBottom: true,
};
/** The centre of each cap, which follows its rim of five vertices. */
const TOP_CENTRE = 10;
const BOTTOM_CENTRE = 16;

describe('buildCylinderMeshSurface', () => {
  it('builds (rings + 2) rows of (radial_segments + 1) side vertices, then a fan per cap', () => {
    const surface = buildCylinderMeshSurface(COARSE, null);

    expect(surface.positions.length / 3).toBe(22);
    expect(surface.indices.length).toBe(3 * (8 + 4 + 4));
  });

  it('starts the side at +Z on the top edge, its tangent along +X', () => {
    const surface = buildCylinderMeshSurface(COARSE, null);

    expectClose(vertexOf(surface.positions, 0), [0, 1, 0.5]);
    expectClose(vertexOf(surface.normals, 0), [0, 0, 1]);
    expectClose(vertexOf(surface.tangents, 0, 4), [1, 0, 0, 1]);
    expectClose(vertexOf(surface.uvs, 0, 2), [0, 0]);
  });

  it('turns U from +Z towards +X and runs V down the side to one half', () => {
    const surface = buildCylinderMeshSurface(COARSE, null);

    expectClose(vertexOf(surface.positions, 1), [0.5, 1, 0]);
    expectClose(vertexOf(surface.tangents, 1, 4), [0, 0, -1, 1]);
    expectClose(vertexOf(surface.uvs, 1, 2), [0.25, 0]);
    expectClose(vertexOf(surface.positions, 5), [0, -1, 0.5]);
    expectClose(vertexOf(surface.uvs, 5, 2), [0, 0.5]);
  });

  it('closes the side seam at +Z, not at the sine of a full turn', () => {
    const surface = buildCylinderMeshSurface(COARSE, null);

    expect(vertexOf(surface.positions, 4)).toEqual([0, 1, 0.5]);
    expectClose(vertexOf(surface.uvs, 4, 2), [1, 0]);
  });

  it('centres the top cap on (0.25, 0.75) of the UV atlas, facing up', () => {
    const surface = buildCylinderMeshSurface(COARSE, null);

    expectClose(vertexOf(surface.positions, TOP_CENTRE), [0, 1, 0]);
    expectClose(vertexOf(surface.normals, TOP_CENTRE), [0, 1, 0]);
    expectClose(vertexOf(surface.tangents, TOP_CENTRE, 4), [1, 0, 0, 1]);
    expectClose(vertexOf(surface.uvs, TOP_CENTRE, 2), [0.25, 0.75]);
    expectClose(vertexOf(surface.uvs, TOP_CENTRE + 1, 2), [0.25, 1]);
    expectClose(vertexOf(surface.uvs, TOP_CENTRE + 2, 2), [0.5, 0.75]);
  });

  it('centres the bottom cap on (0.75, 0.75), facing down, with V mirrored', () => {
    const surface = buildCylinderMeshSurface(COARSE, null);

    expectClose(vertexOf(surface.positions, BOTTOM_CENTRE), [0, -1, 0]);
    expectClose(vertexOf(surface.normals, BOTTOM_CENTRE), [0, -1, 0]);
    expectClose(vertexOf(surface.tangents, BOTTOM_CENTRE, 4), [1, 0, 0, 1]);
    expectClose(vertexOf(surface.uvs, BOTTOM_CENTRE, 2), [0.75, 0.75]);
    expectClose(vertexOf(surface.uvs, BOTTOM_CENTRE + 1, 2), [0.75, 0.5]);
    expectClose(vertexOf(surface.uvs, BOTTOM_CENTRE + 2, 2), [1, 0.75]);
  });

  it("fronts the side and both caps clockwise, Godot's winding", () => {
    const surface = buildCylinderMeshSurface(COARSE, null);
    const indices = Array.from(surface.indices);

    expect(indices.slice(0, 6)).toEqual([0, 1, 5, 1, 6, 5]);
    expect(indices.slice(24, 27)).toEqual([10, 12, 11]);
    expect(indices.slice(36, 39)).toEqual([16, 17, 18]);
    expectClockwiseFronts(surface);
  });

  it('keeps the bottom cap when cap_top is off', () => {
    const surface = buildCylinderMeshSurface({ ...COARSE, capTop: false }, null);

    expect(surface.positions.length / 3).toBe(16);
    expectClose(vertexOf(surface.positions, TOP_CENTRE), [0, -1, 0]);
    expectClose(vertexOf(surface.uvs, TOP_CENTRE, 2), [0.75, 0.75]);
  });

  it('keeps the top cap when cap_bottom is off', () => {
    const surface = buildCylinderMeshSurface({ ...COARSE, capBottom: false }, null);

    expect(surface.positions.length / 3).toBe(16);
    expectClose(vertexOf(surface.positions, TOP_CENTRE), [0, 1, 0]);
  });

  it('builds only the side with both caps off', () => {
    const surface = buildCylinderMeshSurface({ ...COARSE, capTop: false, capBottom: false }, null);

    expect(surface.positions.length / 3).toBe(10);
    expect(surface.indices.length).toBe(24);
  });

  it('builds no cap at a zero radius, and leans the side normal for a cone (edge case)', () => {
    const surface = buildCylinderMeshSurface({ ...COARSE, topRadius: 0 }, null);

    expect(surface.positions.length / 3).toBe(16);
    expectClose(vertexOf(surface.positions, 0), [0, 1, 0]);
    expectClose(vertexOf(surface.normals, 0), [0, 0.242536, 0.970143]);
    expectClose(vertexOf(surface.positions, TOP_CENTRE), [0, -1, 0]);
  });

  it('adds a side row per ring', () => {
    const surface = buildCylinderMeshSurface({ ...COARSE, rings: 1, capTop: false, capBottom: false }, null);

    expect(surface.positions.length / 3).toBe(15);
    expectClose(vertexOf(surface.positions, 5), [0, 0, 0.5]);
    expectClose(vertexOf(surface.uvs, 5, 2), [0, 0.25]);
  });

  it('writes no UV2 without a padding', () => {
    expect(buildCylinderMeshSurface(COARSE, null).uv2s).toBeUndefined();
  });

  // Godot 4.6.3 writes each expected UV2 for the same properties.
  it('lays UV2 out as the unrolled side above the two caps side by side', () => {
    const surface = buildCylinderMeshSurface(COARSE, 0);

    expectClose(vertexOf(surface.uv2s, 1, 2), [0.25, 0]);
    expectClose(vertexOf(surface.uv2s, 5, 2), [0, 0.666667]);
    expectClose(vertexOf(surface.uv2s, TOP_CENTRE, 2), [0.159155, 0.833333]);
    expectClose(vertexOf(surface.uv2s, BOTTOM_CENTRE, 2), [0.477465, 0.833333]);
    expectClose(vertexOf(surface.uv2s, BOTTOM_CENTRE + 1, 2), [0.477465, 0.666667]);
  });

  it('pads UV2 between the side and the caps, and between the two caps', () => {
    const surface = buildCylinderMeshSurface(COARSE, Math.PI);

    expectClose(vertexOf(surface.uv2s, 1, 2), [0.2155449, 0]);
    expectClose(vertexOf(surface.uv2s, 5, 2), [0.1207265, 0.2154433]);
    expectClose(vertexOf(surface.uv2s, TOP_CENTRE + 1, 2), [0.0603632, 0.6615825]);
    expectClose(vertexOf(surface.uv2s, BOTTOM_CENTRE, 2), [0.5603632, 0.6077216]);
    expectClose(vertexOf(surface.uv2s, BOTTOM_CENTRE + 1, 2), [0.5603632, 0.5538608]);
  });
});
