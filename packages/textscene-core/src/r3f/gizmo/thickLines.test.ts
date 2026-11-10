import { describe, expect, it } from 'vitest';
import { thickLinesGeometry } from './thickLines';

const line = { from: { x: 0, y: 0 }, to: { x: 0, y: 10 } };

/** The corners of each triangle, as `x,y` text in three's space, so a quad's area is order-free. */
function area(geometry: NonNullable<ReturnType<typeof thickLinesGeometry>>) {
  const p = geometry.getAttribute('position');
  const index = Array.from(geometry.index!.array);
  let total = 0;
  for (let t = 0; t < index.length; t += 3) {
    const [a, b, c] = [index[t]!, index[t + 1]!, index[t + 2]!];
    total +=
      Math.abs(
        (p.getX(b) - p.getX(a)) * (p.getY(c) - p.getY(a)) - (p.getX(c) - p.getX(a)) * (p.getY(b) - p.getY(a))
      ) / 2;
  }
  return total;
}

describe('thickLinesGeometry', () => {
  // `renderer_canvas_cull.cpp:734-753`: the quad is the line pushed half the width to each side.
  it('draws a line of length 10 and width 4 as an area of 40', () => {
    expect(area(thickLinesGeometry([line], 4)!)).toBeCloseTo(40, 5);
  });

  it('spans half the width to each side of a vertical line, with +y pointing down the screen', () => {
    const p = thickLinesGeometry([line], 4)!.getAttribute('position');
    const xs = Array.from({ length: p.count }, (_, i) => p.getX(i));
    const ys = Array.from({ length: p.count }, (_, i) => p.getY(i));
    expect([Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]).toEqual([-2, 2, -10, 0]);
  });

  it('adds the quads of several lines in one geometry, each indexed on its own vertices', () => {
    const geometry = thickLinesGeometry([line, { from: { x: 5, y: 0 }, to: { x: 5, y: 10 } }], 4)!;
    expect([geometry.getAttribute('position').count, geometry.index!.count]).toEqual([8, 12]);
    expect(area(geometry)).toBeCloseTo(80, 5);
  });

  it('draws no area for a line of no length, as the normal of a zero vector is zero', () => {
    expect(area(thickLinesGeometry([{ from: { x: 3, y: 5 }, to: { x: 3, y: 5 } }], 4)!)).toBe(0);
  });

  it('returns null for no lines', () => {
    expect(thickLinesGeometry([], 3)).toBeNull();
  });
});
