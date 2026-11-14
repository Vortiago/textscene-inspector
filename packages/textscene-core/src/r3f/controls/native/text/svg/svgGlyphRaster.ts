/**
 * Godot's OT-SVG hook end to end (`tvg_svg_in_ot_preset_slot` and `tvg_svg_in_ot_render`,
 * `thorvg_svg_in_ot.cpp:218-367`): the glyph's document loaded as a ThorVG picture, sized and
 * placed on the advance, and drawn on a canvas of its rounded-up size.
 */
import { identityMatrix } from './thorvg/math';
import { Picture } from './thorvg/paint';
import { openPicture, type PictureDecoders } from './thorvg/pictureLoader';
import { drawOnCanvas } from './thorvg/swCanvas';
import type { SvgGlyphDocument } from './svgGlyphDocument';
import { svgGlyphPlacement, type SvgGlyphPlacement, type SvgGlyphSize } from './svgGlyphPlacement';

export interface SvgGlyphBitmap {
  readonly placement: SvgGlyphPlacement;
  /** `placement.width` by `placement.rows` straight ARGB words, which Godot reads as BGRA bytes. */
  readonly pixels: Uint32Array;
}

const utf8 = new TextEncoder();

/**
 * The bitmap of a glyph's document, or null where Godot's hook fails and the glyph draws nothing:
 * a document no loader opens, a picture of no area, or a canvas that renders nothing.
 */
export function drawSvgGlyph(
  document: SvgGlyphDocument,
  size: SvgGlyphSize,
  horiAdvance26_6: number,
  decoders: PictureDecoders
): SvgGlyphBitmap | null {
  // Godot loads the document twice, to size it and to draw it, and both loads read alike.
  const loader = openPicture(utf8.encode(document.xml), 'svg+xml', decoders);
  if (!loader) return null;
  const embox = { x: document.emboxX, y: document.emboxY };
  const placement = svgGlyphPlacement({ width: loader.w, height: loader.h }, embox, size, horiAdvance26_6);
  if (!placement) return null;
  const picture = new Picture(loader);
  picture.size(placement.pictureWidth, placement.pictureHeight);
  picture.transform(identityMatrix());
  const pixels = drawOnCanvas(picture, placement.width, placement.rows);
  return pixels && { placement, pixels };
}
