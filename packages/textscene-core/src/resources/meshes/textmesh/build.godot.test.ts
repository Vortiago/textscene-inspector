/**
 * TextMesh against Godot 4.6.3: `build.godot.json` holds, for each mesh, the glyph outlines Godot's
 * TextServer reads, with its y hinting, and the vertices `get_mesh_arrays` returns. Fed those
 * outlines, the build must make the same vertices. Triangulation differs, so each corner is
 * compared as a position, not by its place in the array.
 */

import { describe, expect, it } from 'vitest';
import { OPEN_SANS_FONT_METRICS } from '../../../r3f/controls/native/text/openSansFontMetrics';
import type { GlyphContours } from '../../../r3f/controls/native/text/sfntGlyf';
import measured from './build.godot.json';
import { buildTextMeshSurface, type TextMeshFace } from './build';
import { decodeTextMesh } from './decode';

interface MeasuredGlyph {
  points: [number, number, number][];
  ends: number[];
  isFillRight: boolean;
}

interface MeasuredMesh {
  text: string;
  raw: Record<string, string>;
  /** Null for a character the font has no glyph for. */
  glyphs: Record<string, MeasuredGlyph | null>;
  vertices: number;
  indices: number;
  /** x, y, z of each distinct position, in order of x, then y, then z. */
  distinctPositions: number[];
}

/** The outlines of a mesh, as Godot read them, under the glyph index the character's code point gives. */
function measuredFace({ glyphs }: MeasuredMesh): TextMeshFace {
  const contoursOf = (codepoint: number): GlyphContours | null => {
    const glyph = glyphs[String.fromCodePoint(codepoint)];
    if (!glyph) return null;
    return {
      points: glyph.points.map(([x, y, tag]) => ({ x, y, tag: tag as 0 | 1 | 2 })),
      contourEnds: glyph.ends,
      isFillRight: glyph.isFillRight,
    };
  };
  return {
    outlines: {
      glyphIndex: (codepoint) => (glyphs[String.fromCodePoint(codepoint)] ? codepoint : 0),
      glyphContours: (index) => contoursOf(index),
    },
    metrics: OPEN_SANS_FONT_METRICS,
  };
}

/** The distinct positions of a flat xyz array. */
function distinctPositions(positions: ArrayLike<number>): [number, number, number][] {
  const byKey = new Map<string, [number, number, number]>();
  for (let i = 0; i < positions.length; i += 3) {
    const position: [number, number, number] = [positions[i]!, positions[i + 1]!, positions[i + 2]!];
    byKey.set(position.join(','), position);
  }
  return [...byKey.values()];
}

/** How far the position of `from` that lies farthest from every position of `to` is from its nearest. */
function farthestFromNearest(
  from: readonly [number, number, number][],
  to: readonly [number, number, number][]
): number {
  const nearest = from.map(([x, y, z]) =>
    Math.min(...to.map(([u, v, w]) => Math.hypot(x - u, y - v, z - w)))
  );
  return Math.max(...nearest);
}

/** Godot sums its positions in single precision, and a position here differs from it by a few ulps of a metre. */
const POSITION_TOLERANCE = 2e-6;

describe.each(measured.surfaces as unknown as MeasuredMesh[])('TextMesh $text $raw against Godot', (mesh) => {
  const surface = buildTextMeshSurface(
    decodeTextMesh({ ...mesh.raw, text: JSON.stringify(mesh.text) }),
    measuredFace(mesh)
  );

  it('writes the same number of vertices and indices', () => {
    expect([surface.positions.length / 3, surface.indices.length]).toEqual([mesh.vertices, mesh.indices]);
  });

  it('writes the same distinct positions', () => {
    const ours = distinctPositions(surface.positions);
    const theirs = distinctPositions(mesh.distinctPositions);
    expect(ours.length).toBe(theirs.length);
    expect(farthestFromNearest(ours, theirs)).toBeLessThan(POSITION_TOLERANCE);
    expect(farthestFromNearest(theirs, ours)).toBeLessThan(POSITION_TOLERANCE);
  });
});
