import { describe, expect, it } from 'vitest';
import { POLYLINE_FEATHER_SIZE, polylineStrokeGeometry } from './polylineStroke';

const RED = { r: 1, g: 0, b: 0, a: 1 };
const BLUE = { r: 0, g: 0, b: 1, a: 1 };

/** `points` as (x, y) pairs, with the Y flip this module bakes in undone. */
function xy(positions: readonly number[]): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < positions.length; i += 3) out.push([positions[i]!, -positions[i + 1]!]);
  return out;
}

function alphas(colors: readonly number[]): number[] {
  const out: number[] = [];
  for (let i = 3; i < colors.length; i += 4) out.push(colors[i]!);
  return out;
}

describe('polylineStrokeGeometry — no antialiasing', () => {
  const geometry = polylineStrokeGeometry([{ x: 0, y: 0 }, { x: 10, y: 0 }], [RED, BLUE], 0.5, false);

  it('emits one 2-vertex cross-section per point (renderer_canvas_cull.cpp:1200-1201)', () => {
    expect(xy(geometry.positions)).toEqual([
      [0, -0.25],
      [0, 0.25],
      [10, -0.25],
      [10, 0.25],
    ]);
  });

  it('gives both vertices of a cross-section that point\'s own colour (:1207-1208)', () => {
    expect(geometry.colors.slice(0, 8)).toEqual([1, 0, 0, 1, 1, 0, 0, 1]);
    expect(geometry.colors.slice(8)).toEqual([0, 0, 1, 1, 0, 0, 1, 1]);
  });

  it('expands the triangle strip into 2 triangles', () => {
    expect(geometry.indices).toHaveLength(6);
  });
});

describe('polylineStrokeGeometry — antialiased', () => {
  const geometry = polylineStrokeGeometry([{ x: 0, y: 0 }, { x: 10, y: 0 }], [RED, BLUE], 0.5, true);

  it('scales the feather by the width below 1px (:1031-1034)', () => {
    expect(POLYLINE_FEATHER_SIZE).toBe(1.25);
  });

  it('adds a begin and an end cap to the core strip, both fully transparent (:1113-1143)', () => {
    // 2*2 core + 2+2 caps for `pline`, then 2*2+5 for each of `pline_left`/`pline_right`.
    expect(xy(geometry.positions)).toHaveLength(8 + 9 + 9);
    const core = xy(geometry.positions).slice(0, 8);
    expect(core[0]).toEqual([-0.625, -0.25]);
    expect(core[1]).toEqual([-0.625, 0.25]);
    expect(core[6]).toEqual([10.625, -0.25]);
    expect(core[7]).toEqual([10.625, 0.25]);
    expect(alphas(geometry.colors).slice(0, 8)).toEqual([0, 0, 1, 1, 1, 1, 0, 0]);
  });

  it('feathers the left border out along the edge offset, fading alpha to zero (:1093-1094)', () => {
    const left = xy(geometry.positions).slice(8, 17);
    expect(left[2]).toEqual([0, -0.25]);
    expect(left[3]).toEqual([0, -0.875]);
    // The end corner walks back to the edge vertex first, so its quad's seam runs from the corner (:1145-1150).
    expect(left[6]).toEqual([10, -0.25]);
    expect(left[7]).toEqual([10.625, -0.875]);
    expect(left[8]).toEqual([10.625, -0.25]);
    expect(alphas(geometry.colors).slice(8, 17)).toEqual([0, 0, 1, 0, 1, 0, 1, 0, 0]);
  });

  it('mirrors that feather on the right (:1096-1097)', () => {
    const right = xy(geometry.positions).slice(17);
    expect(right[2]).toEqual([0, 0.25]);
    expect(right[3]).toEqual([0, 0.875]);
  });
});

describe('polylineStrokeGeometry — degenerate input', () => {
  it('draws nothing below two points (ERR_FAIL_COND, :956)', () => {
    expect(polylineStrokeGeometry([{ x: 0, y: 0 }], [RED], 0.5, true).positions).toEqual([]);
  });
});
