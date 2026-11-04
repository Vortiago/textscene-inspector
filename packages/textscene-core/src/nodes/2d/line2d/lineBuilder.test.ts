/**
 * `buildLineStroke` on numbers: the strip Godot's `LineBuilder::build` emits for a polyline.
 * Expected areas and offsets are worked out by hand from the stroke's geometry, not from the code.
 */

import { describe, expect, it } from 'vitest';
import { LineCapMode, LineJointMode, LineTextureMode } from '../../../godot/scene/line2d.js';
import type { Rgba } from '../../../godot/math/math';
import { buildLineStroke, type LineStroke, type LineStrokeOptions } from './lineBuilder';

const OPTIONS = {
  width: 20,
  closed: false,
  jointMode: LineJointMode.SHARP,
  sharpLimit: 2,
  roundPrecision: 8,
  beginCapMode: LineCapMode.NONE,
  endCapMode: LineCapMode.NONE,
  gradient: null,
  widthFactorAt: null,
  textureMode: LineTextureMode.NONE,
  tileAspect: 1,
} satisfies Omit<LineStrokeOptions, 'points'>;

function stroke(points: number[], overrides: Partial<LineStrokeOptions> = {}): LineStroke {
  const built = buildLineStroke({ ...OPTIONS, points: Float32Array.from(points), ...overrides });
  if (!built) throw new Error('expected a stroke, got none');
  return built;
}

function triangles({ vertices, indices }: LineStroke) {
  const corner = (i: number) => ({ x: vertices[i * 2]!, y: vertices[i * 2 + 1]! });
  return Array.from({ length: indices.length / 3 }, (_, t) => ({
    a: corner(indices[t * 3]!),
    b: corner(indices[t * 3 + 1]!),
    c: corner(indices[t * 3 + 2]!),
  }));
}

/** Twice the signed area is `cross(b - a, c - a)`. */
function area({ a, b, c }: ReturnType<typeof triangles>[number]): number {
  return Math.abs((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)) / 2;
}

const totalArea = (built: LineStroke) => triangles(built).reduce((sum, t) => sum + area(t), 0);

function bounds({ vertices }: LineStroke) {
  const xs = vertices.filter((_, i) => i % 2 === 0);
  const ys = vertices.filter((_, i) => i % 2 === 1);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
}

const CORNER = [0, 0, 100, 0, 100, 100];

describe('buildLineStroke', () => {
  describe('nothing to draw', () => {
    it('returns null for one point', () => {
      expect(buildLineStroke({ ...OPTIONS, points: Float32Array.of(5, 5) })).toBeNull();
    });

    it('returns null for a width of 0 (line_2d.cpp:275)', () => {
      expect(buildLineStroke({ ...OPTIONS, points: Float32Array.of(0, 0, 10, 0), width: 0 })).toBeNull();
    });

    it('returns null for a gradient on two equal points (line_builder.cpp:115)', () => {
      const gradient = { first: RED, last: BLUE, colorAt: () => RED };
      expect(buildLineStroke({ ...OPTIONS, points: Float32Array.of(5, 5, 5, 5), gradient })).toBeNull();
    });
  });

  describe('a straight segment', () => {
    it('is one quad of the half-width on each side', () => {
      const built = stroke([50, 100, 150, 100]);
      expect(triangles(built)).toHaveLength(2);
      expect(bounds(built)).toEqual({ minX: 50, maxX: 150, minY: 90, maxY: 110 });
      expect(totalArea(built)).toBeCloseTo(2000, 6);
    });
  });

  describe('corners', () => {
    // The L's outer corner is at (110, -10) and its inner corner at (90, 10): 100 x 20 + 90 x 20 + 10 x 10.
    it('shares one edge at a SHARP corner, so no area is drawn twice', () => {
      const built = stroke(CORNER);
      expect(totalArea(built)).toBeCloseTo(4000, 4);
      // Two quads that share the corner edge are 6 vertices, not 8.
      expect(built.vertices.length / 2).toBe(6);
    });

    it('cuts the outer corner with one triangle at a BEVEL corner', () => {
      // The square 10 x 10 at the outer corner loses its far half.
      expect(totalArea(stroke(CORNER, { jointMode: LineJointMode.BEVEL }))).toBeCloseTo(3950, 4);
    });

    it('adds a fan of round_precision steps per half turn at a ROUND corner', () => {
      // A quarter turn is 4 steps of PI / 8: 4 triangles of 0.5 * r^2 * sin(PI / 8) around the
      // corner, on top of the bevel's 3950 less its chord triangle of 50.
      const fan = 4 * 0.5 * 100 * Math.sin(Math.PI / 8);
      const built = stroke(CORNER, { jointMode: LineJointMode.ROUND });
      expect(totalArea(built)).toBeCloseTo(3950 - 50 + fan, 3);
    });

    it('falls back to BEVEL past sharp_limit, and keeps the miter within it', () => {
      // An acute corner of 13 degrees: the miter is far past 2 half-widths.
      const hairpin = [0, 0, 100, 0, 10, 20];
      const bevel = stroke(hairpin, { jointMode: LineJointMode.BEVEL });
      expect(stroke(hairpin, { sharpLimit: 2 })).toEqual(bevel);
      expect(stroke(hairpin, { sharpLimit: 1000 })).not.toEqual(bevel);
    });
  });

  describe('caps', () => {
    it('extends a BOX cap by the half-width at each end', () => {
      const built = stroke([50, 100, 150, 100], {
        beginCapMode: LineCapMode.BOX,
        endCapMode: LineCapMode.BOX,
      });
      expect(bounds(built)).toEqual({ minX: 40, maxX: 160, minY: 90, maxY: 110 });
    });

    it('adds round_precision triangles for each ROUND cap', () => {
      const bare = triangles(stroke([50, 100, 150, 100])).length;
      const capped = triangles(
        stroke([50, 100, 150, 100], { beginCapMode: LineCapMode.ROUND, endCapMode: LineCapMode.ROUND })
      ).length;
      expect(capped - bare).toBe(2 * 8);
    });

    it('reaches a half-width past each end with a ROUND cap', () => {
      const built = stroke([50, 100, 150, 100], {
        beginCapMode: LineCapMode.ROUND,
        endCapMode: LineCapMode.ROUND,
      });
      expect(bounds(built).minX).toBeCloseTo(40, 4);
      expect(bounds(built).maxX).toBeCloseTo(160, 4);
    });

    it('ignores both caps on a closed line of more than 2 points', () => {
      const capped = stroke(CORNER, {
        closed: true,
        beginCapMode: LineCapMode.ROUND,
        endCapMode: LineCapMode.BOX,
      });
      expect(capped).toEqual(stroke(CORNER, { closed: true }));
    });
  });

  describe('gradient', () => {
    const gradient = { first: RED, last: BLUE, colorAt: (offset: number) => lerp(RED, BLUE, offset) };

    it('gives the first stop to the first vertices and the last stop to the last', () => {
      const { colors } = stroke([50, 100, 250, 100], { gradient });
      expect(colors).not.toBeNull();
      expect(colorAt(colors!, 0)).toEqual(RED);
      expect(colorAt(colors!, 1)).toEqual(RED);
      expect(colorAt(colors!, 2)).toEqual(BLUE);
      expect(colorAt(colors!, 3)).toEqual(BLUE);
    });

    it('gives an interior point the colour at its distance over the total', () => {
      // Points at 0, 100 and 300 along the line: the middle point sits at 1/3.
      const { colors } = stroke([0, 0, 100, 0, 300, 0], { gradient });
      expect(colorAt(colors!, 2).r).toBeCloseTo(2 / 3, 6);
      expect(colorAt(colors!, 2).b).toBeCloseTo(1 / 3, 6);
    });

    it('carries the last stop through a ROUND end cap', () => {
      const { colors, vertices } = stroke([50, 100, 250, 100], { gradient, endCapMode: LineCapMode.ROUND });
      expect(colors!.length / 4).toBe(vertices.length / 2);
      expect(colorAt(colors!, colors!.length / 4 - 1)).toEqual(BLUE);
    });

    it('measures the offset over a total that includes the BOX cap half-widths (line_builder.cpp:92-113)', () => {
      // 200 long plus a half-width of 10 at each end: the end point is at (200 + 10) / 220.
      const { colors } = stroke([0, 0, 100, 0, 200, 0], {
        gradient,
        beginCapMode: LineCapMode.BOX,
        endCapMode: LineCapMode.BOX,
      });
      expect(colorAt(colors!, 2).r).toBeCloseTo(1 - (10 + 100) / 220, 6);
    });

    it('draws no colours without a gradient', () => {
      expect(stroke([50, 100, 150, 100]).colors).toBeNull();
    });
  });

  describe('width curve', () => {
    const ramp = (offset: number) => 0.25 + 0.75 * offset;

    it('scales the half-width at each point by the curve sample', () => {
      const built = stroke([0, 0, 100, 0], { width: 40, widthFactorAt: ramp });
      const { vertices } = built;
      // Vertices 0 and 1 straddle the first point, 2 and 3 the last.
      expect(Math.abs(vertices[1]! - vertices[3]!)).toBeCloseTo(40 * 0.25, 6);
      expect(Math.abs(vertices[5]! - vertices[7]!)).toBeCloseTo(40, 6);
    });

    it('extends a BOX cap by the end point’s own half-width', () => {
      const built = stroke([0, 0, 100, 0], {
        width: 40,
        widthFactorAt: ramp,
        beginCapMode: LineCapMode.BOX,
        endCapMode: LineCapMode.BOX,
      });
      expect(bounds(built).minX).toBeCloseTo(-5, 6);
      expect(bounds(built).maxX).toBeCloseTo(120, 6);
    });

    it('samples an interior point at its distance over the total', () => {
      const seen: number[] = [];
      stroke([0, 0, 100, 0, 400, 0], {
        widthFactorAt: (offset) => {
          seen.push(offset);
          return 1;
        },
      });
      expect(seen).toEqual([0, 0.25, 1]);
    });
  });

  describe('texture', () => {
    /** The `[u, v]` of each vertex, which the stroke builds in Godot's texel space (v 0 on the up side). */
    const uvPairs = (built: LineStroke) => {
      expect(built.uvs).not.toBeNull();
      return Array.from({ length: built.uvs!.length / 2 }, (_, i) => [
        built.uvs![i * 2]!,
        built.uvs![i * 2 + 1]!,
      ]);
    };

    it('writes no UVs for NONE', () => {
      expect(stroke([0, 0, 100, 0]).uvs).toBeNull();
    });

    it('runs u from 0 to length over width times tile_aspect for TILE', () => {
      // 100 / (20 * 2) = 2.5.
      const built = stroke([0, 0, 100, 0], { textureMode: LineTextureMode.TILE, tileAspect: 2 });
      expect(uvPairs(built)).toEqual([
        [0, 0],
        [0, 1],
        [2.5, 0],
        [2.5, 1],
      ]);
    });

    it('runs u from 0 to 1 for STRETCH, whatever the tile_aspect', () => {
      const built = stroke([0, 0, 100, 0], { textureMode: LineTextureMode.STRETCH, tileAspect: 2 });
      expect(uvPairs(built)).toEqual([
        [0, 0],
        [0, 1],
        [1, 0],
        [1, 1],
      ]);
    });

    it('measures a corner by the distance walked, as TILE and STRETCH', () => {
      // Segments of 100 and 100: the corner is at 100 / 20 = 5 tiles, and at 1/2 of the stretch.
      const tile = uvPairs(stroke(CORNER, { textureMode: LineTextureMode.TILE }));
      expect([tile[2], tile[3], tile[4], tile[5]]).toEqual([
        [5, 0],
        [5, 1],
        [10, 0],
        [10, 1],
      ]);
      const stretch = uvPairs(stroke(CORNER, { textureMode: LineTextureMode.STRETCH }));
      expect([stretch[2], stretch[3], stretch[4], stretch[5]]).toEqual([
        [0.5, 0],
        [0.5, 1],
        [1, 0],
        [1, 1],
      ]);
    });

    it('copies the UV of the opposite strip vertex to a BEVEL vertex (line_builder.cpp:468-472)', () => {
      // The turn opens downward, so the bevel vertex takes the UV of the last up vertex: (5, 0).
      const built = stroke(CORNER, { jointMode: LineJointMode.BEVEL, textureMode: LineTextureMode.TILE });
      expect(uvPairs(built)[4]).toEqual([5, 0]);
    });

    it('adds the BOX cap half-widths to the distance, starting u at 0', () => {
      // Distance 10 + 100 + 10 = 120 at the end: 120 / 20 = 6.
      const built = stroke([0, 0, 100, 0], {
        textureMode: LineTextureMode.TILE,
        beginCapMode: LineCapMode.BOX,
        endCapMode: LineCapMode.BOX,
      });
      expect(uvPairs(built)).toEqual([
        [0, 0],
        [0, 1],
        [6, 0],
        [6, 1],
      ]);
    });

    describe('ROUND caps', () => {
      // Width 16, tile_aspect 2: a cap is a square of 0.5 tiles, centred on u 0.25 at the start
      // and on 136 / 32 = 4.25 at the end (the half-width 8 plus 128).
      const capUvs = () =>
        uvPairs(
          stroke([0, 0, 128, 0], {
            width: 16,
            textureMode: LineTextureMode.TILE,
            tileAspect: 2,
            beginCapMode: LineCapMode.ROUND,
            endCapMode: LineCapMode.ROUND,
          })
        );
      // The begin cap is its hub and 9 arc vertices, then the strip.
      const ARC_VERTICES = 10;

      it('gives the hub the centre of the cap rectangle', () => {
        expect(capUvs()[0]).toEqual([0.25, 0.5]);
      });

      it('starts the strip at the cap’s u, so the texture continues from the cap', () => {
        const uvs = capUvs();
        expect(uvs[ARC_VERTICES]).toEqual([0.25, 0]);
        expect(uvs[ARC_VERTICES + 1]).toEqual([0.25, 1]);
      });

      it('sweeps the arc over the top to the bottom of the rectangle', () => {
        const uvs = capUvs();
        expect(uvs[1]![0]).toBeCloseTo(0.25, 6);
        expect(uvs[1]![1]).toBeCloseTo(0, 6);
        expect(uvs[ARC_VERTICES - 1]![1]).toBeCloseTo(1, 6);
      });

      it('puts the end cap on the rectangle centred on the end quad', () => {
        const uvs = capUvs();
        const last = uvs[uvs.length - 1]!;
        expect(last[0]).toBeCloseTo(4.25, 6);
        expect(last[1]).toBeCloseTo(1, 6);
        expect(uvs[uvs.length - 2 - 9 - 1]![0]).toBeCloseTo(4.25, 6);
      });
    });
  });

  it('closes a closed line whose width curve is 0 at the start without a NaN vertex', () => {
    const built = stroke([0, 0, 100, 0, 100, 100, 0, 100], {
      closed: true,
      jointMode: LineJointMode.BEVEL,
      widthFactorAt: (offset) => offset,
    });
    expect(Array.from(built.vertices).every(Number.isFinite)).toBe(true);
  });

  it('closes a closed SHARP line on its start vertices, with no joint triangles', () => {
    const built = stroke([0, 0, 100, 0, 100, 100, 0, 100], { closed: true });
    // Godot's first quad is degenerate, since the strip has no vertices to start from, then 4 more.
    expect(triangles(built)).toHaveLength(10);
    const last = built.vertices.length / 2 - 2;
    expect(Array.from(built.vertices.slice(last * 2))).toEqual(Array.from(built.vertices.slice(0, 4)));
  });
});

const RED: Rgba = { r: 1, g: 0, b: 0, a: 1 };
const BLUE: Rgba = { r: 0, g: 0, b: 1, a: 1 };

function lerp(from: Rgba, to: Rgba, weight: number): Rgba {
  return {
    r: from.r + (to.r - from.r) * weight,
    g: from.g + (to.g - from.g) * weight,
    b: from.b + (to.b - from.b) * weight,
    a: from.a + (to.a - from.a) * weight,
  };
}

function colorAt(colors: Float32Array, vertex: number): Rgba {
  return {
    r: colors[vertex * 4]!,
    g: colors[vertex * 4 + 1]!,
    b: colors[vertex * 4 + 2]!,
    a: colors[vertex * 4 + 3]!,
  };
}
