/**
 * Reads the tables of a WOFF 1.0 file (W3C WOFF 1.0, §"WOFF Header" and §"Table Directory"). Each
 * table is a zlib stream, or stored raw when compression did not shrink it.
 */

import {
  zlibBlockInflater,
  type BlockInflater,
} from '../../../../resources/formats/binaryresource/compressedStream';
import { SCENE_FONT_TABLE_TAGS, readTag, sfntFileOfTables, type SfntFile } from './sfntTables';

export const WOFF_SIGNATURE = 0x774f4646; // 'wOFF'
const WOFF_HEADER_SIZE = 44;
const WOFF_NUM_TABLES_OFFSET = 12;
// Table directory entry: tag(4) offset(4) compLength(4) origLength(4) origChecksum(4)
const WOFF_RECORD_SIZE = 20;

/** Throws on a directory or a table that does not fit `bytes`, or on a zlib stream that does not inflate to its `origLength`. */
export async function readWoffTables(
  bytes: ArrayBuffer,
  tags: readonly string[] = SCENE_FONT_TABLE_TAGS
): Promise<SfntFile> {
  const dv = new DataView(bytes);
  const numTables = dv.getUint16(WOFF_NUM_TABLES_OFFSET, false);
  const tables = new Map<string, Uint8Array>();
  let inflate: BlockInflater | undefined;

  for (let index = 0; index < numTables; index++) {
    const at = WOFF_HEADER_SIZE + index * WOFF_RECORD_SIZE;
    const tag = readTag(dv, at);
    if (!tags.includes(tag)) continue;
    const offset = dv.getUint32(at + 4, false);
    const compressedLength = dv.getUint32(at + 8, false);
    const length = dv.getUint32(at + 12, false);
    const stored = new Uint8Array(bytes, offset, compressedLength);
    if (compressedLength >= length) {
      tables.set(tag, stored);
      continue;
    }
    inflate ??= await zlibBlockInflater();
    tables.set(tag, inflate(stored, length));
  }
  return sfntFileOfTables(tables);
}
