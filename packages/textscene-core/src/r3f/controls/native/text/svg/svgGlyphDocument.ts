/**
 * The SVG document Godot's OT-SVG hook hands ThorVG for one glyph (`thorvg_svg_in_ot.cpp:76-243`):
 * the document's content outside every glyph element, with the glyph's own element in its place,
 * and the `svg` element's view box and size dropped and read as its em box. It keeps Godot's
 * quirks, so a document draws as Godot draws it.
 */
import { XmlNodeType, XmlParser } from '../../../../../godot/project/xmlParser';
import { stringToFloat, stringToInt } from '../../../../../godot/string/string';
import type { SvgDocument } from './svgTable';

/** The document of one glyph, and the em box of its `svg` element. */
export interface SvgGlyphDocument {
  readonly xml: string;
  readonly emboxX: number;
  readonly emboxY: number;
}

/** Builds the document of `glyph` from the document that holds it, in a face of `unitsPerEm`. */
export type SvgGlyphDocumentReader = (
  document: SvgDocument,
  glyph: number,
  unitsPerEm: number
) => SvgGlyphDocument;

/** Where a glyph element starts in the document, and where its text goes in the shared content (`TVG_NodeCache`). */
interface GlyphNodePlace {
  readonly documentOffset: number;
  readonly bodyOffset: number;
}

/** A parsed document (`TVG_DocumentCache`): its content outside the glyph elements, its em box and each glyph's places. */
interface DocumentCache {
  body: string;
  emboxX: number;
  emboxY: number;
  readonly places: Map<number, GlyphNodePlace[]>;
}

/** The em box of a document as its `svg` element sets it. */
interface Embox {
  x: number;
  y: number;
}

/** `id` prefix that marks a glyph's element (`thorvg_svg_in_ot.cpp:179`). */
const GLYPH_ID_PREFIX = 'glyph';

/**
 * A reader with Godot's document cache (`TVG_State::document_map`): the first glyph read from a
 * document parses it whole, and every later read builds from that parse.
 */
export function svgGlyphDocumentReader(): SvgGlyphDocumentReader {
  const caches = new Map<object, DocumentCache>();
  return (document, glyph, unitsPerEm) => {
    let cache = caches.get(document.key);
    if (!cache) caches.set(document.key, (cache = { body: '', emboxX: 0, emboxY: 0, places: new Map() }));
    const embox = { x: unitsPerEm, y: unitsPerEm };
    const xml = cache.body
      ? documentFromCache(document.bytes, cache, glyph, embox)
      : parsedDocument(document.bytes, cache, glyph, embox);
    return { xml, emboxX: embox.x, emboxY: embox.y };
  };
}

/** The first parse of a document (`thorvg_svg_in_ot.cpp:163-216`), which fills `cache`. */
function parsedDocument(bytes: Uint8Array, cache: DocumentCache, glyph: number, embox: Embox): string {
  const parser = new XmlParser(bytes);
  let body = '';
  let node = '';
  // -1 while the parse writes the content, else how deep it is inside the glyph's element, never below 0.
  let depth = -1;
  let isInDefs = false;
  while (parser.read()) {
    if (parser.nodeType === XmlNodeType.ELEMENT && parser.nodeName.toLowerCase() === 'defs') isInDefs = true;
    else if (parser.nodeType === XmlNodeType.ELEMENT_END && parser.nodeName.toLowerCase() === 'defs')
      isInDefs = false;
    const glyphOfNode = isInDefs ? null : glyphOfId(parser);
    if (glyphOfNode !== null) {
      const places = cache.places.get(glyphOfNode) ?? [];
      places.push({ documentOffset: parser.nodeOffset, bodyOffset: cache.body.length });
      cache.places.set(glyphOfNode, places);
      if (glyphOfNode !== glyph) {
        parser.skipSection();
        continue;
      }
      depth = 0;
      node = '';
    }
    const written = nodeXml(parser, embox);
    if (depth < 0) {
      body += written.xml;
      cache.body += written.xml;
      continue;
    }
    node += written.xml;
    depth = Math.max(0, depth + written.depthChange);
    if (depth === 0) {
      depth = -1;
      body += node;
    }
  }
  cache.emboxX = embox.x;
  cache.emboxY = embox.y;
  return body;
}

/** A later read of a document (`thorvg_svg_in_ot.cpp:137-162`): the cached content with the glyph's elements put back. */
function documentFromCache(bytes: Uint8Array, cache: DocumentCache, glyph: number, embox: Embox): string {
  embox.x = cache.emboxX;
  embox.y = cache.emboxY;
  let body = cache.body;
  let inserted = 0;
  for (const { documentOffset, bodyOffset } of cache.places.get(glyph) ?? []) {
    const parser = new XmlParser(bytes);
    if (!parser.seek(documentOffset)) continue;
    let node = '';
    let depth = 0;
    do {
      const written = nodeXml(parser, embox);
      node += written.xml;
      depth = Math.max(0, depth + written.depthChange);
    } while (depth !== 0 && parser.read());
    const at = bodyOffset + inserted;
    body = body.slice(0, at) + node + body.slice(at);
    inserted += node.length;
  }
  return body;
}

/** The glyph a node's `id` names, or null for a node with no glyph id. A text node still has its element's attributes. */
function glyphOfId(parser: XmlParser): number | null {
  if (!parser.hasAttribute('id')) return null;
  const id = parser.namedAttributeValue('id');
  if (!id.startsWith(GLYPH_ID_PREFIX)) return null;
  const dot = id.indexOf('.');
  return stringToInt(id.slice(GLYPH_ID_PREFIX.length, dot > 0 ? dot : undefined));
}

/**
 * `construct_xml` (`thorvg_svg_in_ot.cpp:76-112`): the XML Godot writes for the current node, and
 * how much deeper it leaves the parse. An `svg` element's view box and size set `embox` instead.
 */
function nodeXml(parser: XmlParser, embox: Embox): { xml: string; depthChange: number } {
  switch (parser.nodeType) {
    case XmlNodeType.ELEMENT: {
      const isSvg = parser.nodeName === 'svg';
      let xml = `<${parser.nodeName}`;
      for (const { name, value } of parser.attributes) {
        if (isSvg && readsEmbox(name, value, embox)) continue;
        xml += ` ${name}="${value}"`;
      }
      return parser.isEmpty ? { xml: `${xml}/>`, depthChange: 0 } : { xml: `${xml}>`, depthChange: 1 };
    }
    case XmlNodeType.TEXT:
      return { xml: parser.nodeData, depthChange: 0 };
    case XmlNodeType.ELEMENT_END:
      return { xml: `</${parser.nodeName}>`, depthChange: -1 };
    default:
      return { xml: '', depthChange: 0 };
  }
}

/** Whether an `svg` attribute is one Godot reads as the em box and drops: `viewBox`, `width` or `height`. */
function readsEmbox(name: string, value: string, embox: Embox): boolean {
  switch (name) {
    case 'viewBox': {
      const box = value.split(' ');
      if (box.length === 4) {
        embox.x = stringToFloat(box[2]!);
        embox.y = stringToFloat(box[3]!);
      }
      return true;
    }
    case 'width':
      embox.x = stringToFloat(value);
      return true;
    case 'height':
      embox.y = stringToFloat(value);
      return true;
    default:
      return false;
  }
}
