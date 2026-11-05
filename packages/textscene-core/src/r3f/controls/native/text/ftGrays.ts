/**
 * FreeType's smooth rasteriser (`ftgrays.c`): the 8-bit coverage bitmap of a glyph outline, as
 * Godot's glyph bitmaps hold it. It covers each pixel cell by FreeType's own integer area sums, so
 * a pixel matches FreeType's to the level, where a canvas fill is off by up to 25 levels.
 *
 * Portions ported from FreeType (FreeType License).
 * Copyright (c) 1996-2024 David Turner, Robert Wilhelm and Werner Lemberg.
 */
import { FIXED_26_6_ONE } from './fontMetrics';
import { freeTypeChordSink, ONE_PIXEL, PIXEL_BITS, type ChordSink } from './freeTypeChords';
import { extent, toOutlineUnits, type GlyphContours } from './glyphContours';
import { traceGlyphContours } from './glyphPath';

/** The pixel grid a bitmap covers: its top-left corner in px from the glyph origin, y down. */
export interface BitmapGrid {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** `FT_UDIVPREP`: the 32-bit reciprocal that `FT_UDIV` multiplies by. */
const UDIV_NUMERATOR = 0xffffffff;
const TWO_TO_32 = 2 ** 32;

/** `TRUNC`: the cell of a subpixel coordinate. */
const cellOf = (subpixel: number): number => Math.floor(subpixel / ONE_PIXEL);
/** `FRACT`: the place of a subpixel coordinate inside its cell. */
const fractionOf = (subpixel: number): number => subpixel - cellOf(subpixel) * ONE_PIXEL;

/**
 * `FT_UDIV` with its `FT_UDIVPREP`: `a / b` by a multiply and a 32-bit shift, which FreeType floors.
 * The quotient is within a pixel, so the product stays under 2^41 and a double holds it exactly.
 */
const udiv = (a: number, b: number): number => Math.floor((a * Math.floor(UDIV_NUMERATOR / b)) / TWO_TO_32);

/**
 * The cells of one render (`gray_TWorker`), in the rasteriser's frame: subpixels, y up, the grid's
 * bottom-left corner at the origin. A cell left of the grid lands in column -1, as `gray_set_cell`
 * puts it at `min_ex - 1`, and a cell right of, above or below the grid is dropped. Each row holds
 * every column, where FreeType lists only the cells a line touches: an untouched cell sums to zero,
 * so the sweep reads the same coverage.
 */
class CellRaster {
  /** The `cover` and `area` sums of each cell (`TCell`), row by row, column -1 first. */
  readonly cover: Float64Array;
  readonly area: Float64Array;
  readonly stride: number;
  /** The index of the current cell, or -1 for a dropped one. */
  private cell = -1;
  private x = 0;
  private y = 0;

  constructor(
    private readonly width: number,
    readonly height: number
  ) {
    this.stride = width + 1;
    this.cover = new Float64Array(this.stride * height);
    this.area = new Float64Array(this.stride * height);
  }

  /** `gray_set_cell`. */
  private setCell(ex: number, ey: number): void {
    const isDropped = ey < 0 || ey >= this.height || ex >= this.width;
    this.cell = isDropped ? -1 : ey * this.stride + Math.max(ex, -1) + 1;
  }

  /** `FT_INTEGRATE`. */
  private integrate(cover: number, doubledX: number): void {
    if (this.cell < 0) return;
    this.cover[this.cell]! += cover;
    this.area[this.cell]! += cover * doubledX;
  }

  /** `gray_move_to`. */
  moveTo(x: number, y: number): void {
    this.setCell(cellOf(x), cellOf(y));
    this.x = x;
    this.y = y;
  }

  /** `gray_render_line`, the 64-bit version (`ftgrays.c:873-1000`). */
  lineTo(toX: number, toY: number): void {
    let ey1 = cellOf(this.y);
    const ey2 = cellOf(toY);
    const height = this.height;
    if ((ey1 >= height && ey2 >= height) || (ey1 < 0 && ey2 < 0)) {
      this.x = toX;
      this.y = toY;
      return;
    }
    let ex1 = cellOf(this.x);
    const ex2 = cellOf(toX);
    let fx1 = fractionOf(this.x);
    let fy1 = fractionOf(this.y);
    const dx = toX - this.x;
    const dy = toY - this.y;

    if (ex1 === ex2 && ey1 === ey2) {
      // Inside one cell: the last integration below covers it.
    } else if (dy === 0) {
      this.setCell(ex2, ey2);
      this.x = toX;
      this.y = toY;
      return;
    } else if (dx === 0) {
      const step = dy > 0 ? 1 : -1;
      const [exitY, entryY] = dy > 0 ? [ONE_PIXEL, 0] : [0, ONE_PIXEL];
      do {
        this.integrate(exitY - fy1, fx1 * 2);
        fy1 = entryY;
        ey1 += step;
        this.setCell(ex1, ey1);
      } while (ey1 !== ey2);
    } else {
      // `prod` says on which side, and where, the line leaves the current cell.
      let prod = dx * fy1 - dy * fx1;
      do {
        let fx2: number;
        let fy2: number;
        if (prod - dx * ONE_PIXEL > 0 && prod <= 0) {
          fx2 = 0;
          fy2 = udiv(-prod, -dx);
          prod -= dy * ONE_PIXEL;
          this.integrate(fy2 - fy1, fx1 + fx2);
          fx1 = ONE_PIXEL;
          fy1 = fy2;
          ex1--;
        } else if (prod - dx * ONE_PIXEL + dy * ONE_PIXEL > 0 && prod - dx * ONE_PIXEL <= 0) {
          prod -= dx * ONE_PIXEL;
          fx2 = udiv(-prod, dy);
          fy2 = ONE_PIXEL;
          this.integrate(fy2 - fy1, fx1 + fx2);
          fx1 = fx2;
          fy1 = 0;
          ey1++;
        } else if (prod + dy * ONE_PIXEL >= 0 && prod - dx * ONE_PIXEL + dy * ONE_PIXEL <= 0) {
          prod += dy * ONE_PIXEL;
          fx2 = ONE_PIXEL;
          fy2 = udiv(prod, dx);
          this.integrate(fy2 - fy1, fx1 + fx2);
          fx1 = 0;
          fy1 = fy2;
          ex1++;
        } else {
          fx2 = udiv(prod, -dy);
          fy2 = 0;
          prod += dx * ONE_PIXEL;
          this.integrate(fy2 - fy1, fx1 + fx2);
          fx1 = fx2;
          fy1 = ONE_PIXEL;
          ey1--;
        }
        this.setCell(ex1, ey1);
      } while (ex1 !== ex2 || ey1 !== ey2);
    }
    this.integrate(fractionOf(toY) - fy1, fx1 + fractionOf(toX));
    this.x = toX;
    this.y = toY;
  }
}

/**
 * `FT_FILL_RULE` under the non-zero rule: an area in 1/512 subpixel² to a level, where a negative
 * area counts as its complement and anything past a whole pixel is 255.
 */
function coverageOf(area: number): number {
  let coverage = Math.floor(area / 2 ** (PIXEL_BITS * 2 + 1 - 8));
  if (coverage < 0) coverage = -coverage - 1;
  return Math.min(coverage, 255);
}

/** `gray_sweep`: the coverage of each pixel, row by row from the top, from the cells of each row. */
function sweep(raster: CellRaster, width: number): Uint8Array {
  const { height, stride, cover: covers, area: areas } = raster;
  const bitmap = new Uint8Array(width * height);
  for (let ey = 0; ey < height; ey++) {
    const line = (height - 1 - ey) * width;
    let cover = 0;
    for (let column = -1; column < width; column++) {
      const cell = ey * stride + column + 1;
      cover += covers[cell]! * ONE_PIXEL * 2;
      if (column >= 0) bitmap[line + column] = coverageOf(cover - areas[cell]!);
    }
  }
  return bitmap;
}

/**
 * A chord sink that feeds `raster`. Points are px from the grid's top-left corner, y down, and land
 * on the subpixel grid. A closed path draws its last line back to the start, as
 * `FT_Outline_Decompose` closes every contour.
 */
function rasterChordSink(raster: CellRaster, height: number): ChordSink {
  const toSubpixelX = (x: number) => Math.round(x * ONE_PIXEL);
  const toSubpixelY = (y: number) => Math.round((height - y) * ONE_PIXEL);
  let startX = 0;
  let startY = 0;
  return {
    moveTo(x, y) {
      startX = toSubpixelX(x);
      startY = toSubpixelY(y);
      raster.moveTo(startX, startY);
    },
    lineTo(x, y) {
      raster.lineTo(toSubpixelX(x), toSubpixelY(y));
    },
    closePath() {
      raster.lineTo(startX, startY);
    },
  };
}

/**
 * The 8-bit coverage of each pixel of `grid`, row by row from the top, that `ftgrays.c` draws of
 * `contours` placed at the glyph origin.
 */
export function rasteriseGlyph(contours: GlyphContours, grid: BitmapGrid): Uint8Array {
  const raster = new CellRaster(grid.width, grid.height);
  traceGlyphContours(
    freeTypeChordSink(rasterChordSink(raster, grid.height)),
    contours,
    -grid.left,
    -grid.top
  );
  return sweep(raster, grid.width);
}

/**
 * The grid of the bitmap FreeType draws of `contours` (`ft_glyphslot_preset_bitmap`, gray mode): the
 * control box of every point on the 26.6 grid, widened to whole pixels. Nothing, for no points.
 */
export function glyphBitmapGrid({ points }: GlyphContours): BitmapGrid | null {
  if (points.length === 0) return null;
  const [xMin, xMax] = extent(points.map((point) => toOutlineUnits(point.x)));
  const [yMin, yMax] = extent(points.map((point) => toOutlineUnits(point.y)));
  const left = Math.floor(xMin / FIXED_26_6_ONE);
  const top = Math.floor(yMin / FIXED_26_6_ONE);
  const right = Math.ceil(xMax / FIXED_26_6_ONE);
  const bottom = Math.ceil(yMax / FIXED_26_6_ONE);
  return { left, top, width: right - left, height: bottom - top };
}
