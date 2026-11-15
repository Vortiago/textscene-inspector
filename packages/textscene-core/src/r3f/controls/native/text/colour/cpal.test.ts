import { describe, expect, it } from 'vitest';
import { cpalTable, type TestCpal } from '../sfntOutlines.testkit';
import { sfntFileOfTables, type SfntFile } from '../sfntTables';
import { readCpal } from './cpal';

const RED: readonly [number, number, number, number] = [0, 0, 255, 255];
const HALF_BLUE: readonly [number, number, number, number] = [255, 0, 0, 128];

function fontWithCpal(bytes: readonly number[]): SfntFile {
  return sfntFileOfTables(new Map([['CPAL', new Uint8Array(bytes)]]));
}

function cpalBytes(input: TestCpal): number[] {
  return cpalTable(input).toBytes();
}

describe('readCpal', () => {
  it('reads the colours of palette 0 in blue, green, red, alpha order', () => {
    const palette = readCpal(fontWithCpal(cpalBytes({ palettes: [[RED, HALF_BLUE]] })));

    expect(palette?.entries).toEqual([RED, HALF_BLUE]);
  });

  it('reads palette 0 alone, from the colour record its index names', () => {
    const bytes = cpalBytes({ palettes: [[RED], [HALF_BLUE]] });
    // Palette 0 starts at colour record 1.
    bytes[12 + 1] = 1;

    expect(readCpal(fontWithCpal(bytes))?.entries).toEqual([HALF_BLUE]);
  });

  it('makes the foreground black for a version 0 table', () => {
    expect(readCpal(fontWithCpal(cpalBytes({ palettes: [[RED]] })))?.isForDarkBackground).toBe(false);
  });

  it('makes the foreground white for palette 0 flagged for a dark background', () => {
    const palette = readCpal(fontWithCpal(cpalBytes({ palettes: [[RED]], paletteFlags: [0x0002] })));

    expect(palette?.isForDarkBackground).toBe(true);
  });

  it('reads the dark-background flag of palette 0 only', () => {
    const palette = readCpal(
      fontWithCpal(cpalBytes({ palettes: [[RED], [RED]], paletteFlags: [0x0001, 0x0002] }))
    );

    expect(palette?.isForDarkBackground).toBe(false);
  });

  it('reads no palette from a font with no CPAL', () => {
    expect(readCpal(sfntFileOfTables(new Map()))).toBeNull();
  });

  it('rejects a version past 1, as FreeType does', () => {
    const bytes = cpalBytes({ palettes: [[RED]] });
    bytes[1] = 2;

    expect(readCpal(fontWithCpal(bytes))).toBeNull();
  });

  it('rejects more palette entries than colour records', () => {
    const bytes = cpalBytes({ palettes: [[RED, RED]] });
    // numColorRecords 1 under numPaletteEntries 2.
    bytes[7] = 1;

    expect(readCpal(fontWithCpal(bytes))).toBeNull();
  });

  it('rejects a palette whose first colour record leaves too few for its entries', () => {
    const bytes = cpalBytes({ palettes: [[RED, RED]] });
    bytes[12 + 1] = 1;

    expect(readCpal(fontWithCpal(bytes))).toBeNull();
  });

  it('rejects colour records past the table', () => {
    const bytes = cpalBytes({ palettes: [[RED]] });

    expect(readCpal(fontWithCpal(bytes.slice(0, bytes.length - 1)))).toBeNull();
  });

  it('rejects a version 1 palette type array past the table', () => {
    const bytes = cpalBytes({ palettes: [[RED]], paletteFlags: [0] });
    // paletteTypesArrayOffset past the end.
    bytes[12 + 2 + 3] = 0xff;

    expect(readCpal(fontWithCpal(bytes))).toBeNull();
  });

  it('rejects a table with no palette', () => {
    expect(readCpal(fontWithCpal(cpalBytes({ palettes: [] })))).toBeNull();
  });
});
