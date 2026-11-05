/**
 * The coverage bitmap FreeType's smooth rasteriser (`ftgrays.c`) draws of a glyph outline, for the
 * tests that hold a glyph against Godot's glyph bitmaps. It draws FreeType's chords and covers each
 * pixel by exact area. FreeType floors where a chord crosses a pixel edge, so a pixel can sit a
 * level or two off Godot's.
 */
import { freeTypeChordSink } from './freeTypeChords';
import type { GlyphContours } from './glyphContours';
import { traceGlyphContours } from './glyphPath';

interface Point {
  x: number;
  y: number;
}

/** The pixel grid a bitmap covers: its top-left corner in px from the glyph origin, y down. */
export interface BitmapGrid {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** The closed polygons of the chords FreeType draws, moved so that the grid's corner is the origin. */
function chordPolygons(contours: GlyphContours, grid: BitmapGrid): Point[][] {
  const polygons: Point[][] = [];
  traceGlyphContours(
    freeTypeChordSink({
      moveTo: (x, y) => polygons.push([{ x, y }]),
      lineTo: (x, y) => polygons[polygons.length - 1]!.push({ x, y }),
      closePath: () => {},
    }),
    contours,
    -grid.left,
    -grid.top
  );
  return polygons;
}

/**
 * Adds the signed area that the edge `from`-`to` covers to the right of it in each pixel of its
 * rows. A row's running sum of `cells` is then the winding coverage of each pixel.
 */
function accumulateEdge(cells: Float64Array, stride: number, rows: number, from: Point, to: Point): void {
  if (from.y === to.y) return;
  const [direction, top, bottom] = from.y < to.y ? [1, from, to] : [-1, to, from];
  const slope = (bottom.x - top.x) / (bottom.y - top.y);
  for (let row = Math.max(0, Math.floor(top.y)); row < Math.min(rows, Math.ceil(bottom.y)); row++) {
    const y0 = Math.max(row, top.y);
    const y1 = Math.min(row + 1, bottom.y);
    const xa = top.x + (y0 - top.y) * slope;
    const xb = top.x + (y1 - top.y) * slope;
    accumulateSpan(cells, row * stride, direction * (y1 - y0), Math.min(xa, xb), Math.max(xa, xb));
  }
}

/**
 * Spreads the height `height` of an edge that crosses a row from `left` to `right` over the pixels
 * it passes. Each pixel takes its share times the area right of the edge, and the next the rest.
 */
function accumulateSpan(
  cells: Float64Array,
  rowStart: number,
  height: number,
  left: number,
  right: number
): void {
  const first = Math.floor(left);
  const last = right === left ? first : Math.ceil(right) - 1;
  for (let column = first; column <= last; column++) {
    const x0 = Math.max(column, left);
    const x1 = Math.min(column + 1, right);
    const share = right === left ? height : (height * (x1 - x0)) / (right - left);
    const meanInside = (x0 + x1) / 2 - column;
    cells[rowStart + column]! += share * (1 - meanInside);
    cells[rowStart + column + 1]! += share * meanInside;
  }
}

/**
 * The 8-bit coverage of each pixel of `grid`, row by row, as `ftgrays.c` maps a winding area under
 * the non-zero rule: the area in 1/256 floored, and a whole pixel 255.
 */
export function freeTypeCoverage(contours: GlyphContours, grid: BitmapGrid): number[][] {
  const stride = grid.width + 2;
  const cells = new Float64Array(stride * grid.height);
  for (const polygon of chordPolygons(contours, grid)) {
    for (let i = 0; i < polygon.length; i++)
      accumulateEdge(cells, stride, grid.height, polygon[i]!, polygon[(i + 1) % polygon.length]!);
  }
  return Array.from({ length: grid.height }, (_, row) => {
    let winding = 0;
    return Array.from({ length: grid.width }, (_, column) => {
      winding += cells[row * stride + column]!;
      return Math.min(255, Math.floor(Math.abs(winding) * 256 + 1e-9));
    });
  });
}
