/**
 * Pure geometry for a nine-patch draw — the shape `RS::canvas_item_add_nine_patch`
 * takes (`NinePatchRect::_notification`'s `NOTIFICATION_DRAW`,
 * `scene/gui/nine_patch_rect.cpp:37-49`, and `StyleBoxTexture::draw`,
 * `scene/resources/style_box_texture.cpp:165-184`, both just record a
 * `CommandNinePatch` — the RenderingServer itself carries no vertex math).
 *
 * The RD backend `ref:godot` renders through draws this as ONE quad with a
 * per-fragment UV remap (`servers/rendering/renderer_rd/shaders/canvas.glsl`'s
 * `map_ninepatch_axis`, `:435-467`, called once per axis at `:587-588`), not
 * nine separate quads. This module is a PIECEWISE-LINEAR port of that same
 * function, expressed as up to nine (or, under TILE, more) flat quads instead
 * of one shaded one — exact for every branch:
 *
 *   - The corner branches (`pixel < margin_begin` / `pixel >= draw_size -
 *     margin_end`) are an IDENTITY map (`pixel * tex_pixel_size`), i.e. a 1:1
 *     dest-to-source copy — one quad, unscaled, reproduces it exactly.
 *   - STRETCH's ratio map is affine in `pixel`, and three's own UV
 *     interpolation across a quad is affine too, so one quad with linear
 *     corner-to-corner UVs is bit-for-bit the same map.
 *   - TILE's `mod(pixel - margin_begin, mid_source_len)` is a 1:1 (unscaled)
 *     repeat: `midSourceLen`-wide dest cells, each showing the WHOLE middle
 *     source strip, plus one final cell cropped from the strip's own start
 *     when the middle span isn't an exact multiple — the identical shape
 *     `textureRectDraw`'s `STRETCH_TILE` branch already uses for the same
 *     Godot idiom (`../texturerect/nativeSolver.ts`).
 *   - TILE_FIT computes an integer `scale` once (`floor(x + 0.5)`, GLSL's
 *     round-half-up) then re-runs the SAME affine ratio per repeat, so it is
 *     `scale` equal-width STRETCH-shaped quads across the middle span.
 *
 * `draw_center` (`canvas.glsl:443`) only ever suppresses a cell that is
 * "middle" on BOTH axes: the decrement fires once per axis whenever that
 * axis's OWN branch is neither corner, so a cell that is middle on one axis
 * and corner on the other (an edge strip) never loses more than one
 * decrement and always survives to zero. An edge or corner cell therefore
 * always draws.
 *
 * Positions are Godot pixels, dest-rect-local, +Y down, z=0 — the same
 * uncooked convention `styleBoxFlatGeometry` documents; a caller flips/offsets.
 * UVs follow three's own convention (v=1 at the texture's top row), matching
 * `spriteFrame.ts`'s region-crop flip.
 *
 * Reusable beyond NinePatchRect: `StyleBoxTexture::draw` funnels through the
 * identical `canvas_item_add_nine_patch` call with the same nine parameters
 * (`style_box_texture.cpp:183`), so this module takes no NinePatchRect-shaped
 * input — only the primitive nine-patch parameters themselves.
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

export interface NinePatchInput {
  /** The destination rect's own size (Godot pixels) — `draw_size` per axis. */
  rectSize: { x: number; y: number };
  /** The full source texture's natural size, Godot pixels. */
  textureSize: { x: number; y: number };
  /**
   * The source window's top-left within the texture. `{0,0}` when no region
   * is authored (region_rect unset draws the WHOLE texture — the base
   * `Texture2D::get_rect_region` this module's callers both run through is a
   * pass-through, `scene/resources/texture.cpp:85-89`).
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
  /** xyz triples, Godot pixels, +Y down. */
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
  /** True for any cell produced by the "not a corner" branch, on EITHER axis. */
  isMiddle: boolean;
}

/**
 * `map_ninepatch_axis` (`canvas.glsl:435-467`) as a list of dest-space cells
 * along ONE axis, each carrying the absolute source-pixel span it samples.
 * `regionOrigin`/`regionSize` are this axis's slice of `regionOffset`/
 * `regionSize` above; `marginBegin`/`marginEnd` are `margin.left`/`.right` (or
 * `.top`/`.bottom`).
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

  // `pixel < margin_begin` (`:437-438`): identity map, clamped to `drawSize`
  // when `marginBegin` alone exceeds it — nothing beyond the branch is ever
  // reached in that case, matching the shader's unconditional first check.
  const beginW = Math.min(Math.max(marginBegin, 0), drawSize);
  if (beginW > 0) {
    cells.push({ destStart: 0, destEnd: beginW, srcStart: regionOrigin, srcEnd: regionOrigin + beginW, isMiddle: false });
  }

  // `pixel >= draw_size - margin_end` (`:439-440`): identity map anchored to
  // the FAR edge. `Math.max(beginW, …)` is the same clamp the shader gets for
  // free from evaluating the first branch first — when the two margins
  // overlap in dest space, every remaining pixel lands here, and this cell's
  // source span is (correctly) cropped from the END corner's OWN tail rather
  // than scaled to fit.
  const endDestStart = Math.max(beginW, drawSize - marginEnd);
  const endW = drawSize - endDestStart;

  const midDestLen = endDestStart - beginW;
  if (midDestLen > 0) {
    const midSourceLen = regionSize - marginBegin - marginEnd;
    const midSrcStart = regionOrigin + marginBegin;
    const midSrcEnd = regionOrigin + regionSize - marginEnd;

    if (midSourceLen > 0) {
      if (mode === NINE_PATCH_STRETCH) {
        cells.push({ destStart: beginW, destEnd: endDestStart, srcStart: midSrcStart, srcEnd: midSrcEnd, isMiddle: true });
      } else if (mode === NINE_PATCH_TILE) {
        // `ofs = mod(pixel - margin_begin, mid_source_len)` (`:453-455`): an
        // unscaled repeat, `midSourceLen`-wide dest cells showing the whole
        // strip, plus a final partial cell cropped from the strip's START
        // (where `ofs` wraps back to 0) when the span isn't an exact
        // multiple.
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
        // TILE_FIT (`:456-464`): `scale = max(1, floor(src_area/dst_area +
        // 0.5))` — GLSL round-half-up over (dest middle span / source middle
        // span) — then `scale` EQUAL dest cells, each showing the FULL
        // source strip (the same affine ratio STRETCH uses, repeated).
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
      // Defensive: `patch_margin_*` (or `texture_margin_*`) together consume
      // the whole source region — `mod`/division by `midSourceLen` in the
      // real shader is by a non-positive number here, undefined in GLSL.
      // Sample the nearest valid texel instead of propagating a NaN UV.
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
 * Builds a nine-patch's draw geometry. Empty buffers when there is nothing to
 * draw (a degenerate dest rect or an empty source window — the caller already
 * guards "no texture" upstream, same as every other native painter).
 */
export function ninePatchGeometry(input: NinePatchInput): NinePatchGeometryBuffers {
  const buffers: NinePatchGeometryBuffers = { positions: [], indices: [], uvs: [] };
  const { rectSize, textureSize, regionOffset, regionSize, margin, axisH, axisV, drawCenter } = input;
  if (textureSize.x <= 0 || textureSize.y <= 0) return buffers;

  const xCells = solveAxisCells(rectSize.x, margin.left, margin.right, regionOffset.x, regionSize.x, axisH);
  const yCells = solveAxisCells(rectSize.y, margin.top, margin.bottom, regionOffset.y, regionSize.y, axisV);

  for (const y of yCells) {
    // `1 - srcPixelY / textureSize.y`: Godot's source Y is top-down pixels,
    // three's V is bottom-up — the same flip `spriteFrame.ts`'s region crop
    // applies. `v0` (the cell's TOP edge) therefore takes the SMALLER source
    // Y and yields the LARGER v.
    const v0 = 1 - y.srcStart / textureSize.y;
    const v1 = 1 - y.srcEnd / textureSize.y;
    for (const x of xCells) {
      if (x.isMiddle && y.isMiddle && !drawCenter) continue;
      const u0 = x.srcStart / textureSize.x;
      const u1 = x.srcEnd / textureSize.x;
      pushQuad(buffers, x.destStart, x.destEnd, y.destStart, y.destEnd, u0, u1, v0, v1);
    }
  }

  return buffers;
}
