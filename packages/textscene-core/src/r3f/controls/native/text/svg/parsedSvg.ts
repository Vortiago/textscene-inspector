/**
 * The root `svg` element of a glyph's document, as the browser parses it. Godot writes the text and
 * attributes of a document unescaped (`svgGlyphDocument.ts`), which ThorVG's lenient parser reads,
 * so a document that is not well-formed XML parses as HTML, whose parser reads it the same way.
 */
const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

/** The document's root `svg` element, or null for text that holds none. */
export function parsedSvg(xml: string): SVGSVGElement | null {
  const parsed = new DOMParser().parseFromString(xml, 'image/svg+xml');
  if (parsed.getElementsByTagName('parsererror').length === 0) return svgRoot(parsed.documentElement);
  return svgRoot(new DOMParser().parseFromString(xml, 'text/html').querySelector('svg'));
}

function svgRoot(element: Element | null): SVGSVGElement | null {
  return element?.namespaceURI === SVG_NAMESPACE && element.localName === 'svg'
    ? (element as unknown as SVGSVGElement)
    : null;
}
