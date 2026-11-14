/**
 * The browser's draw of a glyph's SVG document, where Godot's OT-SVG hook draws it with ThorVG
 * (`thorvg_svg_in_ot.cpp:218-367`): the document's content box as ThorVG measures it, and the
 * content drawn into that box at the glyph's size. The rim of a shape differs from ThorVG's by the
 * browser's own antialiasing.
 */
import { thorvgContentBox, type ContentBox } from './contentBox/contentBox';
import { parsedSvg } from './parsedSvg';
import type { SvgGlyphPlacement } from './svgGlyphPlacement';

/** A glyph's parsed document, ready to draw. */
export interface SvgPicture {
  /**
   * The box of the document's shapes, strokes left out, as ThorVG measures a document whose view box
   * Godot drops (`tvgSvgSceneBuilder.cpp:885-903`).
   */
  readonly box: ContentBox;
  /**
   * The straight RGBA of the content of `box` stretched over the picture's size, on a bitmap of
   * `placement.width` by `placement.rows`, or null where the browser draws nothing.
   */
  draw(placement: SvgGlyphPlacement): Promise<Uint8ClampedArray | null>;
}

export interface SvgPictureDrawer {
  /** The picture of a glyph's document, or null for a document that does not parse or draws no shape. */
  picture(xml: string): SvgPicture | null;
}

/** The browser's drawer, or null outside a document, where nothing draws an SVG. */
export function browserSvgPictureDrawer(): SvgPictureDrawer | null {
  if (
    typeof DOMParser === 'undefined' ||
    typeof Image === 'undefined' ||
    typeof OffscreenCanvas === 'undefined'
  )
    return null;
  // One canvas for every draw: each draw resizes it and reads it back before the next can start.
  const canvas = new OffscreenCanvas(1, 1);
  return { picture: (xml) => browserPicture(canvas, xml) };
}

function browserPicture(canvas: OffscreenCanvas, xml: string): SvgPicture | null {
  const root = parsedSvg(xml);
  const box = root && thorvgContentBox(root);
  if (!root || !box) return null;
  return { box, draw: (placement) => drawnPicture(canvas, root, box, placement) };
}

/** The content of `box` stretched over the picture's size, as ThorVG's `Picture::size` scales each axis apart. */
async function drawnPicture(
  canvas: OffscreenCanvas,
  root: SVGSVGElement,
  box: ContentBox,
  placement: SvgGlyphPlacement
): Promise<Uint8ClampedArray | null> {
  root.setAttribute('viewBox', `${box.x} ${box.y} ${box.width} ${box.height}`);
  root.setAttribute('width', String(placement.pictureWidth));
  root.setAttribute('height', String(placement.pictureHeight));
  root.setAttribute('preserveAspectRatio', 'none');
  const url = URL.createObjectURL(
    new Blob([new XMLSerializer().serializeToString(root)], { type: 'image/svg+xml' })
  );
  const image = new Image();
  image.src = url;
  try {
    await image.decode();
  } catch {
    // A document the browser cannot draw leaves the glyph blank, as a failed ThorVG render does.
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
  canvas.width = placement.width;
  canvas.height = placement.rows;
  const context = canvas.getContext('2d');
  if (!context) return null;
  context.drawImage(image, 0, 0, placement.pictureWidth, placement.pictureHeight);
  return context.getImageData(0, 0, placement.width, placement.rows).data;
}
