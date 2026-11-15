/** The layers a drawing builds for the gizmo: vertex-coloured meshes and hairlines, in draw order. */
import { describe, expect, it } from 'vitest';
import {
  concavePolygonDrawing,
  rectangleDrawing,
  segmentDrawing,
  worldBoundaryDrawing,
} from '../../../../resources/shapes/shape2d/drawings';
import { shapeLayers } from './shapeLayers';

const TEAL = { r: 0, g: 0.6, b: 0.7, a: 0.42 };

/** The alpha of each vertex of a layer's mesh. */
function alphas(layer: ReturnType<typeof shapeLayers>[number]): number[] {
  if (layer.kind !== 'mesh') throw new Error('expected a mesh layer');
  const colours = layer.geometry.getAttribute('color');
  return Array.from({ length: colours.count }, (_, i) => colours.getW(i));
}

describe('shapeLayers', () => {
  it('builds a filled mesh of two triangles and a closed hairline of four segments for a rectangle', () => {
    const [fill, outline] = shapeLayers(rectangleDrawing({ size: { x: 40, y: 30 } }), TEAL);

    expect(fill!.kind).toBe('mesh');
    expect(fill!.kind === 'mesh' && fill!.geometry.getIndex()!.count).toBe(6);
    expect(outline).toMatchObject({ kind: 'hairline', alpha: 1 });
    expect(outline!.kind === 'hairline' && outline!.positions.length).toBe(4 * 6);
  });

  it('gives the fill the alpha of the debug colour and the outline an alpha of 1', () => {
    const [fill] = shapeLayers(rectangleDrawing({ size: { x: 40, y: 30 } }), TEAL);

    for (const alpha of alphas(fill!)) expect(alpha).toBeCloseTo(0.42, 6);
  });

  it('flips Y into three space, so a point below the origin sits below it on screen', () => {
    const [stroke] = shapeLayers(segmentDrawing({ a: { x: 0, y: 0 }, b: { x: 0, y: 10 } }), TEAL);
    const positions = stroke!.kind === 'mesh' ? stroke!.geometry.getAttribute('position') : null;
    const ys = Array.from({ length: positions!.count }, (_, i) => positions!.getY(i));

    expect(Math.min(...ys)).toBe(-10);
    expect(Math.max(...ys)).toBeCloseTo(0, 9);
  });

  it('fades the world boundary line out at both ends with a clear vertex colour', () => {
    const [line] = shapeLayers(worldBoundaryDrawing({ normal: { x: 0, y: -1 }, distance: 0 }), TEAL);

    expect(alphas(line!).slice(0, 8)).toEqual(
      [0, 0, 0.42, 0.42, 0.42, 0.42, 0, 0].map((a) => expect.closeTo(a, 5))
    );
  });

  it('merges the strokes of a concave polygon into one mesh', () => {
    const lines = Array.from({ length: 50 }, (_, i) => [
      { x: i, y: 0 },
      { x: i, y: 10 },
    ]).flat();

    const layers = shapeLayers(concavePolygonDrawing({ segments: lines }), TEAL);

    expect(layers).toHaveLength(1);
    expect(layers[0]!.kind === 'mesh' && layers[0]!.geometry.getAttribute('position').count).toBe(200);
  });

  it('builds no layer for a drawing of no commands', () => {
    expect(shapeLayers([], TEAL)).toEqual([]);
  });
});
