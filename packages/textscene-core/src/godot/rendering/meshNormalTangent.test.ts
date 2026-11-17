import { describe, expect, it } from 'vitest';
import { normalizedVector3 } from '../math/vector.js';
import { encodedNormalTangent } from './meshNormalTangent.js';

// Each expected value is the uint16 of Godot 4.6.3's `mesh_get_surface` vertex data for the same arrays.
const NORMALS = [[0, 0, 1], normalizedVector3(0.6, -0.8, 0), normalizedVector3(-0.2, 0.3, -0.9)];

describe('encodedNormalTangent', () => {
  it('writes the normal and the tangent Godot makes up when the mesh has none', () => {
    expect(NORMALS.map((normal) => encodedNormalTangent(normal))).toEqual([
      [0x7fff, 0x7fff, 0x7fff, 0x8000],
      [0xb6da, 0x36db, 0x48a5, 0xab3d],
      [0x1b6d, 0xedb5, 0x5148, 0x8c9c],
    ]);
  });

  it("writes the mesh's tangent with the binormal's sign in its second lane", () => {
    const tangents = [
      [1, 0, 0, 1],
      [0.8, 0.6, 0, -1],
      [0, 0.95, 0.3, 1],
    ];
    expect(NORMALS.map((normal, index) => encodedNormalTangent(normal, tangents[index]))).toEqual([
      [0x7fff, 0x7fff, 0xffff, 0xbfff],
      [0xb6da, 0x36db, 0xc923, 0x2492],
      [0x1b6d, 0xedb5, 0x7fff, 0xf0a2],
    ]);
  });

  it('writes a tangent of (0, 65535) as (65535, 65535), as Godot keeps it apart from a compressed one', () => {
    const [, , x, y] = encodedNormalTangent([0, 0, 1], [0, 0, -1, 1]);
    expect([x, y]).toEqual([0xffff, 0xffff]);
  });
});
