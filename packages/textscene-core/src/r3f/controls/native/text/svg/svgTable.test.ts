import { gunzipSync } from 'three/addons/libs/fflate.module.js';
import { describe, expect, it } from 'vitest';
import { svgBytes, svgFont, svgTable, type TestSvgDocument } from './svg.testkit';
import { readSvgTable, svgDocumentOf } from './svgTable';

const doc = (startGlyph: number, endGlyph: number, xml: string, isCompressed = false): TestSvgDocument => ({
  startGlyph,
  endGlyph,
  bytes: svgBytes(xml, isCompressed),
});

const decoded = (bytes: Uint8Array | undefined) => (bytes ? new TextDecoder().decode(bytes) : undefined);

function documentText(documents: readonly TestSvgDocument[], glyph: number): string | undefined {
  const table = readSvgTable(svgFont(svgTable(documents)));
  return decoded(table ? svgDocumentOf(table, glyph, gunzipSync)?.bytes : undefined);
}

describe('svgDocumentOf', () => {
  const documents = [doc(1, 1, '<svg>a</svg>'), doc(3, 5, '<svg>b</svg>'), doc(8, 8, '<svg>c</svg>')];

  it('finds the document whose glyph range holds the glyph', () => {
    expect(documentText(documents, 4)).toBe('<svg>b</svg>');
    expect(documentText(documents, 8)).toBe('<svg>c</svg>');
  });

  it('finds no document for a glyph between ranges or past them', () => {
    expect(documentText(documents, 2)).toBeUndefined();
    expect(documentText(documents, 9)).toBeUndefined();
  });

  it('gives the glyph range of the document it finds', () => {
    const table = readSvgTable(svgFont(svgTable(documents)))!;
    expect(svgDocumentOf(table, 5, gunzipSync)).toMatchObject({ startGlyph: 3, endGlyph: 5 });
  });

  it('inflates a gzip-compressed document', () => {
    expect(documentText([doc(1, 1, '<svg>zipped</svg>', true)], 1)).toBe('<svg>zipped</svg>');
  });

  it('gives one document the same key on every read, so its parse is kept', () => {
    const table = readSvgTable(svgFont(svgTable(documents)))!;
    expect(svgDocumentOf(table, 3, gunzipSync)!.key).toBe(svgDocumentOf(table, 5, gunzipSync)!.key);
    expect(svgDocumentOf(table, 3, gunzipSync)!.key).not.toBe(svgDocumentOf(table, 1, gunzipSync)!.key);
  });

  it('gives a compressed document a new key on every read, as FreeType inflates it into a new buffer', () => {
    const table = readSvgTable(svgFont(svgTable([doc(1, 2, '<svg/>', true)])))!;
    expect(svgDocumentOf(table, 1, gunzipSync)!.key).not.toBe(svgDocumentOf(table, 2, gunzipSync)!.key);
  });

  it('finds no document whose record reaches past the table', () => {
    const table = svgTable([doc(1, 1, '<svg/>')]);
    const view = new DataView(table.buffer);
    view.setUint32(10 + 2 + 8, 1000);
    expect(svgDocumentOf(readSvgTable(svgFont(table))!, 1, gunzipSync)).toBeNull();
  });
});

describe('readSvgTable', () => {
  it('has no table in a font without one', () => {
    expect(readSvgTable(svgFont(new Uint8Array(0)))).toBeNull();
  });

  it('has no table whose document list starts inside its header', () => {
    const table = svgTable([doc(1, 1, '<svg/>')]);
    new DataView(table.buffer).setUint32(2, 4);
    expect(readSvgTable(svgFont(table))).toBeNull();
  });

  it('has no table whose records reach past its end', () => {
    const table = svgTable([doc(1, 1, '<svg/>')]);
    new DataView(table.buffer).setUint16(10, 50);
    expect(readSvgTable(svgFont(table))).toBeNull();
  });
});
