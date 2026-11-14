import { describe, expect, it } from 'vitest';
import { svgBytes } from './svg.testkit';
import { svgGlyphDocumentReader } from './svgGlyphDocument';
import type { SvgDocument } from './svgTable';

const UNITS_PER_EM = 1000;

const documentOf = (xml: string): SvgDocument => ({
  bytes: svgBytes(xml),
  startGlyph: 0,
  endGlyph: 9,
  key: {},
});

/** The document Godot builds for `glyph` of `xml`, read once by a fresh reader. */
const xmlOf = (xml: string, glyph: number) =>
  svgGlyphDocumentReader()(documentOf(xml), glyph, UNITS_PER_EM).xml;

describe('svgGlyphDocumentReader', () => {
  it('keeps the content around the glyph elements, and the element of the glyph alone', () => {
    const xml =
      '<svg><defs><g id="glyph9"/></defs><g id="glyph1"><path/></g><g id="glyph2"><rect/></g></svg> ';
    expect(xmlOf(xml, 2)).toBe('<svg><defs><g id="glyph9"/></defs><g id="glyph2"><rect/></g></svg>');
  });

  it('reads the glyph of an id with a suffix after a dot', () => {
    expect(xmlOf('<svg><g id="glyph3.alt"><path/></g><g id="glyph4"/></svg> ', 3)).toBe(
      '<svg><g id="glyph3.alt"><path/></g></svg>'
    );
  });

  it('drops the view box and the size of the svg element, and takes its em box from them', () => {
    const read = svgGlyphDocumentReader()(
      documentOf('<svg xmlns="ns" viewBox="0 -100 200 300" width="50"><g id="glyph1"/></svg> '),
      1,
      UNITS_PER_EM
    );
    expect(read).toEqual({ xml: '<svg xmlns="ns"><g id="glyph1"/></svg>', embox: { x: 50, y: 300 } });
  });

  it('takes the em box of the face where the svg element gives none', () => {
    const read = svgGlyphDocumentReader()(documentOf('<svg><g id="glyph1"/></svg> '), 1, UNITS_PER_EM);
    expect([read.embox.x, read.embox.y]).toEqual([UNITS_PER_EM, UNITS_PER_EM]);
  });

  it('drops comments, CDATA and definitions, and writes text and attributes unescaped', () => {
    const xml =
      '<?xml version="1.0"?><svg><style><![CDATA[x]]></style><!-- c --><text a="&lt;">1 &amp; 2</text></svg> ';
    expect(xmlOf(xml, 1)).toBe('<svg><style></style><text a="<">1 & 2</text></svg>');
  });

  it('builds a later glyph of a document from its first parse, as a fresh parse would', () => {
    const xml = '<svg><g id="glyph1"><path/></g><g id="glyph2"><rect/></g></svg> ';
    const read = svgGlyphDocumentReader();
    const document = documentOf(xml);
    read(document, 1, UNITS_PER_EM);
    expect(read(document, 2, UNITS_PER_EM).xml).toBe(xmlOf(xml, 2));
  });

  it("loses the glyph's opening tag where text follows it, as Godot reads the id again on the text", () => {
    expect(xmlOf('<svg><g id="glyph1">abc<path/></g></svg> ', 1)).toBe('<svg>abc<path/></g></svg>');
  });

  it('builds the text after a glyph element twice from the first parse, as Godot does', () => {
    const read = svgGlyphDocumentReader();
    const document = documentOf('<svg><g id="glyph1">abc<path/></g></svg> ');
    read(document, 1, UNITS_PER_EM);
    expect(read(document, 1, UNITS_PER_EM).xml).toBe(
      '<svg><g id="glyph1">abc<path/></g>abc<path/></g></svg>'
    );
  });
});
