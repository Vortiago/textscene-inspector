/**
 * `ninePatchGeometry` against Godot 4.6.3's `map_ninepatch_axis`
 * (`servers/rendering/renderer_rd/shaders/canvas.glsl:435-467`, called once
 * per axis at `:587-588`). Every expected number is worked by hand from that
 * function's branches, never from this renderer or a screenshot.
 */
import { describe, expect, it } from 'vitest';
import {
  ninePatchGeometry,
  NINE_PATCH_STRETCH,
  NINE_PATCH_TILE,
  NINE_PATCH_TILE_FIT,
  type NinePatchInput,
  type NinePatchGeometryBuffers,
} from './ninePatchGeometry';

interface Quad {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  u0: number;
  u1: number;
  v0: number;
  v1: number;
}

/** Decodes the flat buffers back into per-quad corners, in emission order. */
/** Field-by-field `toBeCloseTo`, for a quad whose UVs carry float division. */
function expectQuadCloseTo(actual: Quad, expected: Quad): void {
  for (const key of Object.keys(expected) as (keyof Quad)[]) {
    expect(actual[key]).toBeCloseTo(expected[key]);
  }
}

function quads(buf: NinePatchGeometryBuffers): Quad[] {
  const out: Quad[] = [];
  const count = buf.positions.length / 12;
  for (let i = 0; i < count; i++) {
    const p = buf.positions.slice(i * 12, i * 12 + 12);
    const uv = buf.uvs.slice(i * 8, i * 8 + 8);
    out.push({
      x0: p[0]!,
      y0: p[1]!,
      x1: p[3]!,
      y1: p[7]!,
      u0: uv[0]!,
      v0: uv[1]!,
      u1: uv[2]!,
      v1: uv[5]!,
    });
  }
  return out;
}

const BASE: NinePatchInput = {
  rectSize: { x: 0, y: 0 },
  textureSize: { x: 0, y: 0 },
  regionOffset: { x: 0, y: 0 },
  regionSize: { x: 0, y: 0 },
  margin: { left: 0, top: 0, right: 0, bottom: 0 },
  axisH: NINE_PATCH_STRETCH,
  axisV: NINE_PATCH_STRETCH,
  drawCenter: true,
};

describe('ninePatchGeometry — STRETCH', () => {
  it('no margins: one quad spanning the whole rect, full UV', () => {
    const buf = ninePatchGeometry({
      ...BASE,
      rectSize: { x: 50, y: 25 },
      textureSize: { x: 16, y: 8 },
      regionSize: { x: 16, y: 8 },
    });
    const q = quads(buf);
    expect(q).toHaveLength(1);
    expect(q[0]).toEqual({ x0: 0, x1: 50, y0: 0, y1: 25, u0: 0, u1: 1, v0: 1, v1: 0 });
  });

  it('symmetric margins on both axes: 9 cells, corners at native size, centre stretched', () => {
    const buf = ninePatchGeometry({
      ...BASE,
      rectSize: { x: 40, y: 30 },
      textureSize: { x: 20, y: 20 },
      regionSize: { x: 20, y: 20 },
      margin: { left: 4, top: 4, right: 4, bottom: 4 },
    });
    const q = quads(buf);
    expect(q).toHaveLength(9);
    expect(buf.positions).toHaveLength(9 * 12);
    expect(buf.indices).toHaveLength(9 * 6);

    // Row-major emission order: y-cells outer, x-cells inner, so the top-left
    // corner is quad 0.
    expectQuadCloseTo(q[0]!, { x0: 0, x1: 4, y0: 0, y1: 4, u0: 0, u1: 0.2, v0: 1, v1: 0.8 });
    // Centre: x-middle (dest [4,36) ⇐ src [4,16)) × y-middle (dest [4,26) ⇐ src [4,16)).
    expectQuadCloseTo(q[4]!, { x0: 4, x1: 36, y0: 4, y1: 26, u0: 0.2, u1: 0.8, v0: 0.8, v1: 0.2 });
    // Bottom-right corner.
    expectQuadCloseTo(q[8]!, { x0: 36, x1: 40, y0: 26, y1: 30, u0: 0.8, u1: 1, v0: 0.2, v1: 0 });
  });
});

describe('ninePatchGeometry — TILE', () => {
  const TILE_INPUT: NinePatchInput = {
    ...BASE,
    rectSize: { x: 45, y: 20 },
    textureSize: { x: 20, y: 20 },
    regionSize: { x: 20, y: 20 },
    margin: { left: 5, top: 0, right: 5, bottom: 0 },
    axisH: NINE_PATCH_TILE,
    axisV: NINE_PATCH_STRETCH,
  };

  it('tiles the middle strip at native size, cropping the final partial tile from its own start', () => {
    const q = quads(ninePatchGeometry(TILE_INPUT));
    // corner(0,5) + 3 full 10px tiles + 1 partial 5px tile + corner(40,45).
    expect(q).toHaveLength(6);
    expect(q.map((c) => [c.x0, c.x1])).toEqual([
      [0, 5],
      [5, 15],
      [15, 25],
      [25, 35],
      [35, 40],
      [40, 45],
    ]);
    // Every full tile shows the same middle strip.
    for (const tile of q.slice(1, 4)) {
      expect(tile.u0).toBeCloseTo(0.25);
      expect(tile.u1).toBeCloseTo(0.75);
    }
    // The partial tile is cropped from the strip's start, not its end.
    expect(q[4]!.u0).toBeCloseTo(0.25);
    expect(q[4]!.u1).toBeCloseTo(0.5);
    // Corners stay at native size, unstretched.
    expect(q[0]).toMatchObject({ u0: 0, u1: 0.25 });
    expect(q[5]).toMatchObject({ u0: 0.75, u1: 1 });
  });

  it('draw_center = false hides every middle-on-both-axes cell, never an edge or corner', () => {
    const q = quads(ninePatchGeometry({ ...TILE_INPUT, drawCenter: false }));
    // The Y axis carries no margin, so every X cell is also middle on Y, and
    // only the two X corners survive.
    expect(q).toHaveLength(2);
    expect(q.map((c) => [c.x0, c.x1])).toEqual([
      [0, 5],
      [40, 45],
    ]);
  });
});

describe('ninePatchGeometry — TILE_FIT', () => {
  it('rounds to the nearest integer tile count and stretches each repeat to fit exactly', () => {
    const buf = ninePatchGeometry({
      ...BASE,
      rectSize: { x: 100, y: 10 },
      textureSize: { x: 26, y: 10 },
      regionSize: { x: 26, y: 10 },
      axisH: NINE_PATCH_TILE_FIT,
    });
    const q = quads(buf);
    // scale = floor(100/26 + 0.5) = floor(4.346) = 4; no corners (0 margin).
    expect(q).toHaveLength(4);
    expect(q.map((c) => [c.x0, c.x1])).toEqual([
      [0, 25],
      [25, 50],
      [50, 75],
      [75, 100],
    ]);
    // Every repeat shows the whole source strip.
    for (const cell of q) {
      expect(cell.u0).toBe(0);
      expect(cell.u1).toBe(1);
    }
  });
});

describe('ninePatchGeometry — region_rect windowing', () => {
  it('folds the region offset into every cell and normalises UVs by the FULL texture, not the region', () => {
    const buf = ninePatchGeometry({
      ...BASE,
      rectSize: { x: 20, y: 20 },
      textureSize: { x: 100, y: 100 },
      regionOffset: { x: 10, y: 20 },
      regionSize: { x: 40, y: 30 },
      margin: { left: 5, top: 5, right: 5, bottom: 5 },
    });
    const q = quads(buf);
    expect(q).toHaveLength(9);
    expect(q[0]).toEqual({ x0: 0, x1: 5, y0: 0, y1: 5, u0: 0.1, u1: 0.15, v0: 0.8, v1: 0.75 });
    expect(q[4]).toEqual({ x0: 5, x1: 15, y0: 5, y1: 15, u0: 0.15, u1: 0.45, v0: 0.75, v1: 0.55 });
    expect(q[8]).toEqual({ x0: 15, x1: 20, y0: 15, y1: 20, u0: 0.45, u1: 0.5, v0: 0.55, v1: 0.5 });
  });
});

describe('ninePatchGeometry — degenerate and error inputs', () => {
  it('a zero-width dest rect draws nothing', () => {
    const buf = ninePatchGeometry({
      ...BASE,
      rectSize: { x: 0, y: 20 },
      textureSize: { x: 10, y: 10 },
      regionSize: { x: 10, y: 10 },
    });
    expect(buf.positions).toHaveLength(0);
    expect(buf.indices).toHaveLength(0);
    expect(buf.uvs).toHaveLength(0);
  });

  it('an invalid (zero) texture size draws nothing', () => {
    const buf = ninePatchGeometry({
      ...BASE,
      rectSize: { x: 20, y: 20 },
      textureSize: { x: 0, y: 10 },
      regionSize: { x: 10, y: 10 },
    });
    expect(buf.positions).toHaveLength(0);
  });

  it('margins overlapping in dest space: the far corner clips from its own tail, no middle cell', () => {
    const buf = ninePatchGeometry({
      ...BASE,
      rectSize: { x: 10, y: 10 },
      textureSize: { x: 20, y: 10 },
      regionSize: { x: 20, y: 10 },
      margin: { left: 8, top: 0, right: 8, bottom: 0 },
    });
    const q = quads(buf);
    expect(q).toHaveLength(2);
    expect(q[0]).toMatchObject({ x0: 0, x1: 8, u0: 0, u1: 0.4 });
    expect(q[1]).toMatchObject({ x0: 8, x1: 10, u0: 0.9, u1: 1 });
  });

  it('margins exceeding the source region degrade to a single clamped texel instead of NaN', () => {
    const buf = ninePatchGeometry({
      ...BASE,
      rectSize: { x: 100, y: 10 },
      textureSize: { x: 15, y: 10 },
      regionSize: { x: 15, y: 10 },
      margin: { left: 10, top: 0, right: 10, bottom: 0 },
    });
    const q = quads(buf);
    expect(q).toHaveLength(3);
    const middle = q[1]!;
    expect(middle.x0).toBe(10);
    expect(middle.x1).toBe(90);
    expect(middle.u0).toBeCloseTo(10 / 15);
    expect(middle.u1).toBe(middle.u0);
    for (const value of [...buf.positions, ...buf.uvs]) {
      expect(Number.isFinite(value)).toBe(true);
    }
  });
});
