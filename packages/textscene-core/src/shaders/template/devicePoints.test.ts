import { describe, expect, it } from 'vitest';
import { devicePoints, sizesPoints } from './devicePoints.js';

describe('sizesPoints', () => {
  it('sizes the points of a shader that names POINT_SIZE', () => {
    expect(sizesPoints(new Set(['POINT_SIZE', 'COLOR']))).toBe(true);
  });

  it('leaves the points of a shader that names no POINT_SIZE to the device', () => {
    expect(sizesPoints(new Set(['POINT_COORD', 'COLOR']))).toBe(false);
  });

  it('leaves the points of a shader that names no built-in', () => {
    expect(sizesPoints(new Set())).toBe(false);
  });
});

describe('devicePoints', () => {
  it("writes the template's gl_PointSize as a float", () => {
    const { size } = devicePoints();

    expect([size.name, size.type]).toEqual(['gl_PointSize', 'float']);
  });

  it('gives the fragment its corner as a varying, as gl_PointCoord reads it', () => {
    expect((devicePoints().coord as unknown as { isVaryingNode: boolean }).isVaryingNode).toBe(true);
  });
});
