import { describe, expect, it } from 'vitest';
import { emptyPath, PathCommand } from './renderPath';
import { svgPathToShape } from './svgPath';

function read(d: string) {
  const path = emptyPath();
  const isRead = svgPathToShape(d, path);
  return { isRead, ...path };
}

describe('svgPathToShape', () => {
  it('reads absolute and relative moves and lines, numbers after a move repeating as lines', () => {
    const { cmds, pts } = read('M1 2 3 4l1,1h2v-1z');
    expect(cmds).toEqual([
      PathCommand.MoveTo,
      PathCommand.LineTo,
      PathCommand.LineTo,
      PathCommand.LineTo,
      PathCommand.LineTo,
      PathCommand.Close,
    ]);
    expect(pts).toEqual([
      { x: 1, y: 2 },
      { x: 3, y: 4 },
      { x: 4, y: 5 },
      { x: 6, y: 5 },
      { x: 6, y: 4 },
    ]);
  });

  it('turns a quadratic into a cubic at a third of the way to its control', () => {
    const { pts } = read('M0 0Q3 3 6 0');
    expect(pts.slice(1)).toEqual([
      { x: 2, y: 2 },
      { x: 4, y: 2 },
      { x: 6, y: 0 },
    ]);
  });

  it('reflects the last control point of a smooth cubic', () => {
    const { pts } = read('M0 0C0 1 1 2 2 2S4 1 4 0');
    expect(pts[4]).toEqual({ x: 3, y: 2 });
  });

  it('draws an arc as cubics of under 90 degrees', () => {
    const { cmds, pts } = read('M0 0A1 1 0 0 1 2 0');
    expect(cmds).toEqual([PathCommand.MoveTo, PathCommand.CubicTo, PathCommand.CubicTo, PathCommand.CubicTo]);
    expect(pts.at(-1)!.x).toBeCloseTo(2, 5);
    expect(pts.at(-1)!.y).toBeCloseTo(0, 5);
  });

  it('draws an arc with a zero radius as a line', () => {
    expect(read('M0 0A0 1 0 0 1 2 0').cmds).toEqual([PathCommand.MoveTo, PathCommand.LineTo]);
  });

  it('stops at the first command that does not read, and keeps what came before', () => {
    const { isRead, cmds } = read('M0 0L1 1L2#');
    expect(isRead).toBe(true);
    expect(cmds).toEqual([PathCommand.MoveTo, PathCommand.LineTo]);
  });

  it('fails a path that does not start with a move', () => {
    expect(read('L1 1').isRead).toBe(false);
  });
});
