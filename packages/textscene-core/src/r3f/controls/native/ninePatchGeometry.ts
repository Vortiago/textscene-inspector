/**
 * Pure geometry for a nine-patch draw, in the shape `RS::canvas_item_add_nine_patch`
 * takes from `NinePatchRect` (`scene/gui/nine_patch_rect.cpp:37-49`) and from
 * `StyleBoxTexture::draw` (`scene/resources/style_box_texture.cpp:165-184`).
 */

export const NINE_PATCH_STRETCH = 0;
export const NINE_PATCH_TILE = 1;
export const NINE_PATCH_TILE_FIT = 2;

/** `NinePatchRect::AxisStretchMode` / `StyleBoxTexture::AxisStretchMode` (both 0/1/2, same order). */
export type NinePatchAxisMode =
  | typeof NINE_PATCH_STRETCH
  | typeof NINE_PATCH_TILE
  | typeof NINE_PATCH_TILE_FIT;

export interface NinePatchMargins {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

// Both callers pass the same nine parameters (`style_box_texture.cpp:183`), so
// the input is those parameters, not a NinePatchRect.
export interface NinePatchInput {
  /** The destination rect's size in Godot pixels: `draw_size` per axis. */
  rectSize: { x: number; y: number };
  /** The full source texture's natural size, Godot pixels. */
  textureSize: { x: number; y: number };
  /**
   * The source window's top-left within the texture. `{0,0}` when no region
   * is authored: the base `Texture2D::get_rect_region` is a pass-through
   * (`scene/resources/texture.cpp:85-89`), so an unset region draws the whole texture.
   */
  regionOffset: { x: number; y: number };
  /** The source window's size; equals `textureSize` when no region is authored. */
  regionSize: { x: number; y: number };
  margin: NinePatchMargins;
  axisH: NinePatchAxisMode;
  axisV: NinePatchAxisMode;
  drawCenter: boolean;
}

export interface NinePatchGeometryBuffers {
  /** xyz triples, Godot pixels, dest-rect-local, +Y down, z=0. A caller flips and offsets. */
  positions: number[];
  indices: number[];
  /** uv pairs, three's convention (v=1 at the texture's top row). */
  uvs: number[];
}

interface AxisCell {
  destStart: number;
  destEnd: number;
  /** Absolute texture-pixel coordinates (region offset already folded in). */
  srcStart: number;
  srcEnd: number;
  /** True for a cell from the "not a corner" branch. */
  isMiddle: boolean;
}

/**
 * `map_ninepatch_axis` (`servers/rendering/renderer_rd/shaders/canvas.glsl:435-467`, called per
 * axis at `:587-588`), the RD backend's per-fragment UV remap of one quad, as dest-space cells
 * along this axis's slice of `NinePatchInput`, each with the absolute source-pixel span it samples.
 * Flat quads are exact, as each branch is a 1:1 copy or an affine map.
 */
function solveAxisCells(
  drawSize: number,
  marginBegin: number,
  marginEnd: number,
  regionOrigin: number,
  regionSize: number,
  mode: NinePatchAxisMode
): AxisCell[] {
  const cells: AxisCell[] = [];
  if (drawSize <= 0 || regionSize <= 0) return cells;

  // `pixel < margin_begin` (`:437-438`): an identity map, so one unscaled quad.
  // Clamped to `drawSize` when `marginBegin` alone exceeds it, matching the
  // shader's unconditional first check.
  const beginW = Math.min(Math.max(marginBegin, 0), drawSize);
  if (beginW > 0) {
    cells.push({ destStart: 0, destEnd: beginW, srcStart: regionOrigin, srcEnd: regionOrigin + beginW, isMiddle: false });
  }

  // `pixel >= draw_size - margin_end` (`:439-440`): an identity map anchored to
  // the far edge. `Math.max(beginW, …)` is the shader's first-branch-first order:
  // when the margins overlap, the rest lands here, cropped from the end
  // corner's own tail rather than scaled.
  const endDestStart = Math.max(beginW, drawSize - marginEnd);
  const endW = drawSize - endDestStart;

  const midDestLen = endDestStart - beginW;
  if (midDestLen > 0) {
    const midSourceLen = regionSize - marginBegin - marginEnd;
    const midSrcStart = regionOrigin + marginBegin;
    const midSrcEnd = regionOrigin + regionSize - marginEnd;

    if (midSourceLen > 0) {
      if (mode === NINE_PATCH_STRETCH) {
        // An affine ratio map, like three's UV interpolation, so one quad is exact.
        cells.push({ destStart: beginW, destEnd: endDestStart, srcStart: midSrcStart, srcEnd: midSrcEnd, isMiddle: true });
      } else if (mode === NINE_PATCH_TILE) {
        // `ofs = mod(pixel - margin_begin, mid_source_len)` (`:453-455`): an
        // unscaled repeat, `midSourceLen`-wide dest cells showing the whole
        // strip, plus a final partial cell cropped from the strip's start
        // (where `ofs` wraps to 0) when the span is not an exact multiple.
        const fullTiles = Math.floor(midDestLen / midSourceLen);
        let cursor = beginW;
        for (let i = 0; i < fullTiles; i++) {
          cells.push({ destStart: cursor, destEnd: cursor + midSourceLen, srcStart: midSrcStart, srcEnd: midSrcEnd, isMiddle: true });
          cursor += midSourceLen;
        }
        const remainder = endDestStart - cursor;
        if (remainder > 0) {
          cells.push({ destStart: cursor, destEnd: endDestStart, srcStart: midSrcStart, srcEnd: midSrcStart + remainder, isMiddle: true });
        }
      } else {
        // TILE_FIT (`:456-464`): `scale = max(1, floor(src_area/dst_area + 0.5))`,
        // GLSL round-half-up over dest span / source span, then `scale` equal
        // cells, each the STRETCH map over the full source strip.
        const scale = Math.max(1, Math.floor(midDestLen / midSourceLen + 0.5));
        const cellW = midDestLen / scale;
        for (let i = 0; i < scale; i++) {
          cells.push({
            destStart: beginW + i * cellW,
            destEnd: beginW + (i + 1) * cellW,
            srcStart: midSrcStart,
            srcEnd: midSrcEnd,
            isMiddle: true,
          });
        }
      }
    } else {
      // The margins consume the whole source region, so the shader divides by a
      // non-positive `midSourceLen`, undefined in GLSL. Sample the nearest
      // valid texel rather than propagate a NaN UV.
      const clampedSrc = regionOrigin + Math.min(Math.max(marginBegin, 0), regionSize);
      cells.push({ destStart: beginW, destEnd: endDestStart, srcStart: clampedSrc, srcEnd: clampedSrc, isMiddle: true });
    }
  }

  if (endW > 0) {
    cells.push({
      destStart: endDestStart,
      destEnd: drawSize,
      srcStart: regionOrigin + regionSize - endW,
      srcEnd: regionOrigin + regionSize,
      isMiddle: false,
    });
  }

  return cells;
}

/** One quad's four corners, dest-local Godot pixels, in TL/TR/BR/BL order. */
function pushQuad(
  buf: NinePatchGeometryBuffers,
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  u0: number,
  u1: number,
  v0: number,
  v1: number
): void {
  const i = buf.positions.length / 3;
  buf.positions.push(x0, y0, 0, x1, y0, 0, x1, y1, 0, x0, y1, 0);
  buf.uvs.push(u0, v0, u1, v0, u1, v1, u0, v1);
  buf.indices.push(i, i + 1, i + 2, i, i + 2, i + 3);
}

/**
 * Builds a nine-patch's draw geometry. Empty buffers for a degenerate dest rect
 * or an empty source window. The caller guards "no texture".
 */
export function ninePatchGeometry(input: NinePatchInput): NinePatchGeometryBuffers {
  const buffers: NinePatchGeometryBuffers = { positions: [], indices: [], uvs: [] };
  const { rectSize, textureSize, regionOffset, regionSize, margin, axisH, axisV, drawCenter } = input;
  if (textureSize.x <= 0 || textureSize.y <= 0) return buffers;

  const xCells = solveAxisCells(rectSize.x, margin.left, margin.right, regionOffset.x, regionSize.x, axisH);
  const yCells = solveAxisCells(rectSize.y, margin.top, margin.bottom, regionOffset.y, regionSize.y, axisV);

  for (const y of yCells) {
    // Godot's source Y is top-down, three's V is bottom-up: the flip
    // `spriteFrame.ts`'s region crop applies. `v0`, the cell's top edge, takes
    // the smaller source Y and yields the larger v.
    const v0 = 1 - y.srcStart / textureSize.y;
    const v1 = 1 - y.srcEnd / textureSize.y;
    for (const x of xCells) {
      // `draw_center` (`canvas.glsl:443`) drops only a cell middle on both axes.
      if (x.isMiddle && y.isMiddle && !drawCenter) continue;
      const u0 = x.srcStart / textureSize.x;
      const u1 = x.srcEnd / textureSize.x;
      pushQuad(buffers, x.destStart, x.destEnd, y.destStart, y.destEnd, u0, u1, v0, v1);
    }
  }

  return buffers;
}
