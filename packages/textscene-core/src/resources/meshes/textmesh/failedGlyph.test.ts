/**
 * A glyph that polypartition cannot partition draws no face in Godot (`primitive_meshes.cpp:3185-3194`).
 * The vertex counts come from `TextMesh.get_mesh_arrays()` in Godot 4.6.3 with Montserrat ExtraBold,
 * one glyph to a mesh. An empty mesh holds the one vertex of its degenerate triangle.
 */

import { describe, expect, it } from 'vitest';
import { withOutlines, withVariation } from '../../../r3f/controls/native/text/fontMetrics';
import { OPEN_SANS_FONT_METRICS } from '../../../r3f/controls/native/text/openSansFontMetrics';
import { openFontOutlines } from '../../../r3f/controls/native/text/sfntOutlines';
import { fixtureFontBytes } from '../../../r3f/controls/native/text/sfntOutlines.testkit';
import { buildTextMeshSurface } from './build';
import { decodeTextMesh } from './decode';

const outlines = (await openFontOutlines(fixtureFontBytes('montserrat-extra-bold.otf')))!;

interface Mesh {
  text: string;
  embolden: number;
  skew: number;
  depth?: number;
  fontSize?: number;
  curveStep?: number;
}

function vertexCount({ text, embolden, skew, depth = 0, fontSize = 64, curveStep = 0.5 }: Mesh): number {
  const face = withOutlines(withVariation(OPEN_SANS_FONT_METRICS, { embolden, skew }), outlines);
  const properties = decodeTextMesh({
    text: `"${text}"`,
    font_size: String(fontSize),
    depth: String(depth),
    curve_step: String(curveStep),
  });
  return buildTextMeshSurface(properties, face).positions.length / 3;
}

describe('a flat TextMesh of a glyph Godot fails to triangulate', () => {
  it.each([
    ['a', 0.6, 0, 744],
    ['a', 0.7, 0, 744],
    ['a', 0.8, 0, 1],
    ['a', 1.0, 0, 1],
    ['a', 0.6, 0.3, 744],
    ['a', 0.7, 0.3, 1],
    ['8', 1.2, 0, 1119],
    ['8', 2.0, 0, 1],
  ])('makes the vertices of %s at embolden %s and skew %s', (text, embolden, skew, vertices) => {
    expect(vertexCount({ text, embolden, skew })).toBe(vertices);
  });
});

describe('a deep TextMesh of a glyph Godot fails to triangulate', () => {
  it('draws the sides and no faces', () => {
    const faceless = vertexCount({ text: 'a', embolden: 1.2, skew: 0, depth: 0.05 });
    expect(faceless).toBe(996);
  });

  it('draws the faces too where the glyph triangulates', () => {
    expect(vertexCount({ text: 'a', embolden: 0.6, skew: 0, depth: 0.05 })).toBe(2480);
  });
});

describe('a glyph whose contour points are single precision', () => {
  it.each([
    [0.75, 1],
    [1.1, 1],
  ])(
    'fails at embolden %s, skew 0.3, font_size 128 and curve_step 0.1 as Godot does',
    (embolden, vertices) => {
      expect(vertexCount({ text: '%', embolden, skew: 0.3, fontSize: 128, curveStep: 0.1 })).toBe(vertices);
    }
  );
});
