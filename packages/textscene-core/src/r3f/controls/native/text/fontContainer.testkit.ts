/**
 * Wraps the tables of a plain sfnt in a WOFF 1.0 container for the container reader's tests, with
 * `node:zlib` as the compressor: an independent encoder, so a test never checks the reader against
 * itself. Only `fixtureFontBytes` fonts go in, whose table directory is the 12-byte header plus
 * 16-byte records.
 */

import { deflateSync } from 'node:zlib';

const WOFF_SIGNATURE = 0x774f4646; // 'wOFF'
const WOFF_HEADER_SIZE = 44;
const WOFF_RECORD_SIZE = 20;
const PADDING = 4;

function paddedLength(length: number): number {
  return Math.ceil(length / PADDING) * PADDING;
}

/** A WOFF whose tables are zlib streams, or stored raw when `compress` is false. */
export function woffFromSfnt(sfnt: ArrayBuffer, { compress }: { compress: boolean }): ArrayBuffer {
  const source = new DataView(sfnt);
  const numTables = source.getUint16(4, false);
  const records = Array.from({ length: numTables }, (_, index) => {
    const at = 12 + index * 16;
    const tag = new Uint8Array(sfnt, at, 4);
    const data = new Uint8Array(sfnt, source.getUint32(at + 8, false), source.getUint32(at + 12, false));
    const stored = compress ? deflateSync(data) : data;
    return { tag, origLength: data.length, stored: stored.length < data.length ? stored : data };
  });

  const bodySize = records.reduce((sum, record) => sum + paddedLength(record.stored.length), 0);
  const length = WOFF_HEADER_SIZE + numTables * WOFF_RECORD_SIZE + bodySize;
  const woff = new ArrayBuffer(length);
  const out = new DataView(woff);
  out.setUint32(0, WOFF_SIGNATURE, false);
  out.setUint32(4, source.getUint32(0, false), false);
  out.setUint32(8, length, false);
  out.setUint16(12, numTables, false);

  let dataOffset = WOFF_HEADER_SIZE + numTables * WOFF_RECORD_SIZE;
  records.forEach((record, index) => {
    const at = WOFF_HEADER_SIZE + index * WOFF_RECORD_SIZE;
    new Uint8Array(woff, at, 4).set(record.tag);
    out.setUint32(at + 4, dataOffset, false);
    out.setUint32(at + 8, record.stored.length, false);
    out.setUint32(at + 12, record.origLength, false);
    new Uint8Array(woff, dataOffset, record.stored.length).set(record.stored);
    dataOffset += paddedLength(record.stored.length);
  });
  return woff;
}

/** `woff` with the zlib header of every compressed table overwritten, so no table inflates. */
export function breakZlibHeaders(woff: ArrayBuffer): ArrayBuffer {
  const broken = woff.slice(0);
  const view = new DataView(broken);
  for (let index = 0; index < view.getUint16(12, false); index++) {
    const at = WOFF_HEADER_SIZE + index * WOFF_RECORD_SIZE;
    const isCompressed = view.getUint32(at + 8, false) < view.getUint32(at + 12, false);
    if (isCompressed) view.setUint16(view.getUint32(at + 4, false), 0xffff, false);
  }
  return broken;
}
