import { describe, expect, it } from 'vitest';
import { savedImage } from '../image/savedImage.testkit';
import { decodeCubemapFaces } from './decode';

const face = (level: number, width = 1) => savedImage('Lum8', width, 1, Array(width).fill(level).join(', '));

describe('decodeCubemapFaces', () => {
  it('stacks the six faces in order', () => {
    const faces = decodeCubemapFaces([10, 20, 30, 40, 50, 60].map((level) => face(level)))!;
    expect(faces.depth).toBe(6);
    expect([...faces.texels].filter((_, index) => index % 4 === 0)).toEqual([10, 20, 30, 40, 50, 60]);
  });

  it('decodes nothing from seven images, which Godot refuses (error case)', () => {
    expect(decodeCubemapFaces([1, 2, 3, 4, 5, 6, 7].map((level) => face(level)))).toBeNull();
  });

  it('decodes nothing from faces of two sizes, which Godot refuses (edge case)', () => {
    expect(decodeCubemapFaces([face(1), face(2), face(3), face(4), face(5), face(6, 2)])).toBeNull();
  });
});
