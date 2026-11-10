import { describe, expect, it } from 'vitest';
import { thickLinesGeometry } from './thickLines';

const positionsOf = (lines: Parameters<typeof thickLinesGeometry>[0], width: number) =>
  Array.from(thickLinesGeometry(lines, width)!.getAttribute('position').array);

describe('thickLinesGeometry', () => {
  // `renderer_canvas_cull.cpp:734-753`: the quad is the line pushed half the width to each side.
  it('draws a vertical line of width 4 as a 4 wide quad, with +y pointing down the screen', () => {
    expect(positionsOf([{ from: { x: 0, y: 0 }, to: { x: 0, y: 10 } }], 4)).toEqual([
      ...[-2, 0, 0], // begin_left: the orthogonal of from - to is (-10, 0)
      ...[2, 0, 0], // begin_right
      ...[2, -10, 0], // end_right
      ...[-2, -10, 0], // end_left
    ]);
  });

  it('splits each quad into two triangles', () => {
    const geometry = thickLinesGeometry([{ from: { x: 0, y: 0 }, to: { x: 0, y: 10 } }], 4)!;
    expect(Array.from(geometry.index!.array)).toEqual([0, 1, 2, 0, 2, 3]);
  });

  it('collapses a line of no length to a point, as the normal of a zero vector is zero', () => {
    expect(positionsOf([{ from: { x: 3, y: 5 }, to: { x: 3, y: 5 } }], 4)).toEqual([
      ...[3, -5, 0],
      ...[3, -5, 0],
      ...[3, -5, 0],
      ...[3, -5, 0],
    ]);
  });

  it('returns null for no lines', () => {
    expect(thickLinesGeometry([], 3)).toBeNull();
  });
});
