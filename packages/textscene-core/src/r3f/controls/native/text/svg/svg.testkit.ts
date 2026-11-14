/** `SVG ` tables built for the SVG readers' tests, around the documents each test gives. */
import { gzipSync } from 'three/addons/libs/fflate.module.js';
import { ByteWriter } from '../sfntOutlines.testkit';
import { sfntFileOfTables, type SfntFile } from '../sfntTables';

/** A document record: the glyphs it covers, and its bytes. */
export interface TestSvgDocument {
  readonly startGlyph: number;
  readonly endGlyph: number;
  readonly bytes: Uint8Array;
}

/** The UTF-8 bytes of `xml`, gzip-compressed where `isCompressed`. */
export function svgBytes(xml: string, isCompressed = false): Uint8Array {
  const bytes = new TextEncoder().encode(xml);
  return isCompressed ? gzipSync(bytes) : bytes;
}

/** An `SVG ` table of `documents`, in the order given. */
export function svgTable(documents: readonly TestSvgDocument[]): Uint8Array {
  const listOffset = 10;
  const recordsSize = 2 + 12 * documents.length;
  const records = new ByteWriter().u16(documents.length);
  const bodies = new ByteWriter();
  for (const { startGlyph, endGlyph, bytes } of documents) {
    records
      .u16(startGlyph)
      .u16(endGlyph)
      .u32(recordsSize + bodies.length)
      .u32(bytes.length);
    bodies.raw([...bytes]);
  }
  const table = new ByteWriter().u16(0).u32(listOffset).u32(0).raw(records).raw(bodies);
  return new Uint8Array(table.toBytes());
}

/** A font that holds only `table` as its `SVG `. */
export function svgFont(table: Uint8Array): SfntFile {
  return sfntFileOfTables(new Map([['SVG ', table]]));
}
