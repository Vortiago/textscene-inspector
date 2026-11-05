/** The lookups `readLayoutTable` reads from a `GPOS` built in bytes. */

import { describe, expect, it } from 'vitest';
import { ByteWriter } from '../sfntOutlines.testkit';
import { GposType, LookupFlag, readLayoutTable } from './openTypeLayout';

/** A `GPOS` with no script and no feature, and one lookup of `flag` that ends before its mark filtering set. */
function gposCutShortBeforeMarkFilteringSet(flag: number): DataView {
  const bytes = new ByteWriter()
    .u32(0x00010000)
    .u16(10)
    .u16(12)
    .u16(14)
    .u16(0)
    .u16(0)
    .u16(1)
    .u16(4)
    .u16(GposType.PAIR)
    .u16(flag)
    .u16(0);
  return new DataView(new Uint8Array(bytes.toBytes()).buffer);
}

describe('readLayoutTable', () => {
  // `Lookup::sanitize` (`hb-ot-layout-common.hh:1418-1431`) fails, and HarfBuzz empties that lookup alone.
  it('empties a lookup that ends before its mark filtering set', () => {
    const dv = gposCutShortBeforeMarkFilteringSet(LookupFlag.USE_MARK_FILTERING_SET);
    expect(readLayoutTable(dv, 0, dv.byteLength, false).lookups).toEqual([
      { subtables: [], props: LookupFlag.USE_MARK_FILTERING_SET },
    ]);
  });
});
