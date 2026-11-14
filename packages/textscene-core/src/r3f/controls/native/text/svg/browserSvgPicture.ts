/**
 * The browser's draw of a glyph's SVG document, where Godot's OT-SVG hook draws it with ThorVG
 * (`thorvg_svg_in_ot.cpp:218-367`): the document's content box, which ThorVG sizes a document with
 * no view box by, and the content drawn into that box at the glyph's size. The rim of a shape differs
 * from ThorVG's by the browser's own antialiasing.
 */
import type { SvgGlyphPlacement } from './svgGlyphPlacement';

/** A box in the document's own units. */
export interface ContentBox {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface SvgPictureDrawer {
  /**
   * The box of the document's shapes, strokes left out, as ThorVG measures a document whose view box
   * Godot drops (`tvgSvgSceneBuilder.cpp:885-903`), or null for a document that does not parse.
   */
  contentBox(xml: string): ContentBox | null;
  /**
   * The straight RGBA of the content of `box` stretched over the picture's size, on a bitmap of
   * `placement.width` by `placement.rows`, or null where the browser draws nothing.
   */
  draw(xml: string, box: ContentBox, placement: SvgGlyphPlacement): Promise<Uint8ClampedArray | null>;
}

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

/** The browser's drawer, or null outside a document, where nothing draws an SVG. */
export function browserSvgPictureDrawer(): SvgPictureDrawer | null {
  const document = globalThis.document;
  if (!document?.body || typeof DOMParser === 'undefined') return null;
  return { contentBox: (xml) => measuredContentBox(document, xml), draw: drawnPicture };
}

/** The document's root `svg` element, or null for text that does not parse as one. */
function parsedSvg(xml: string): SVGSVGElement | null {
  const parsed = new DOMParser().parseFromString(xml, 'image/svg+xml');
  const root = parsed.documentElement;
  if (parsed.getElementsByTagName('parsererror').length > 0) return null;
  return root.namespaceURI === SVG_NAMESPACE && root.localName === 'svg'
    ? (root as unknown as SVGSVGElement)
    : null;
}

/** `getBBox` measures only an element in a rendered document, so the root joins the page unseen for the read. */
function measuredContentBox(document: Document, xml: string): ContentBox | null {
  const root = parsedSvg(xml);
  if (!root) return null;
  const svg = document.importNode(root, true);
  svg.setAttribute('style', 'position:absolute;left:0;top:0;visibility:hidden;pointer-events:none');
  document.body.appendChild(svg);
  try {
    const { x, y, width, height } = svg.getBBox();
    return { x, y, width, height };
  } finally {
    svg.remove();
  }
}

/** The content of `box` stretched over the picture's size, as ThorVG's `Picture::size` scales each axis apart. */
async function drawnPicture(
  xml: string,
  box: ContentBox,
  placement: SvgGlyphPlacement
): Promise<Uint8ClampedArray | null> {
  const root = parsedSvg(xml);
  if (!root) return null;
  root.setAttribute('viewBox', `${box.x} ${box.y} ${box.width} ${box.height}`);
  root.setAttribute('width', String(placement.pictureWidth));
  root.setAttribute('height', String(placement.pictureHeight));
  root.setAttribute('preserveAspectRatio', 'none');
  const image = new Image();
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(root))}`;
  try {
    await image.decode();
  } catch {
    // A document the browser cannot draw leaves the glyph blank, as a failed ThorVG render does.
    return null;
  }
  const canvas = new OffscreenCanvas(placement.width, placement.rows);
  const context = canvas.getContext('2d');
  if (!context) return null;
  context.drawImage(image, 0, 0, placement.pictureWidth, placement.pictureHeight);
  return context.getImageData(0, 0, placement.width, placement.rows).data;
}
