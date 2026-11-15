import { describe, expect, it } from 'vitest';
import { colrTable, maxpTable, type TestColrBase } from '../sfntOutlines.testkit';
import { sfntFileOfTables, type SfntFile } from '../sfntTables';
import { colrLayersReader } from './colr';
import type { BgraColour, Palette } from './cpal';

const RED: BgraColour = [0, 0, 255, 255];
const GREEN: BgraColour = [0, 255, 0, 255];
const PALETTE: Palette = { entries: [RED, GREEN], isForDarkBackground: false };
const FOREGROUND = 0xffff;
const GLYPH_COUNT = 10;

function fontWithColr(colr: readonly number[], extra: [string, Uint8Array][] = []): SfntFile {
  return sfntFileOfTables(
    new Map([
      ['COLR', new Uint8Array(colr)],
      ['maxp', new Uint8Array(maxpTable(GLYPH_COUNT).toBytes())],
      ...extra,
    ])
  );
}

function layersOf(bases: readonly TestColrBase[], glyph: number, palette = PALETTE) {
  return colrLayersReader(fontWithColr(colrTable(bases).toBytes()), palette)?.(glyph);
}

describe('colrLayersReader', () => {
  it('reads the layers of a base glyph in order, each in its palette colour', () => {
    const layers = layersOf(
      [
        {
          glyph: 3,
          layers: [
            [4, 1],
            [5, 0],
          ],
        },
      ],
      3
    );

    expect(layers).toEqual([
      { glyph: 4, colour: GREEN },
      { glyph: 5, colour: RED },
    ]);
  });

  it('finds a base glyph among several, whatever their order in the file', () => {
    const bases: TestColrBase[] = [
      { glyph: 2, layers: [[4, 0]] },
      { glyph: 6, layers: [[5, 1]] },
      { glyph: 8, layers: [[7, 0]] },
    ];

    expect(layersOf(bases, 6)).toEqual([{ glyph: 5, colour: GREEN }]);
  });

  it('paints the foreground black on a palette for a light background', () => {
    expect(layersOf([{ glyph: 3, layers: [[4, FOREGROUND]] }], 3)).toEqual([
      { glyph: 4, colour: [0, 0, 0, 255] },
    ]);
  });

  it('paints the foreground white on a palette for a dark background', () => {
    const palette: Palette = { ...PALETTE, isForDarkBackground: true };

    expect(layersOf([{ glyph: 3, layers: [[4, FOREGROUND]] }], 3, palette)).toEqual([
      { glyph: 4, colour: [255, 255, 255, 255] },
    ]);
  });

  it('gives no layers to a glyph with no base glyph record, which draws its own outline', () => {
    expect(layersOf([{ glyph: 3, layers: [[4, 0]] }], 5)).toBeNull();
  });

  it('gives no layers to a base glyph with none', () => {
    const bases: TestColrBase[] = [
      { glyph: 3, layers: [] },
      { glyph: 6, layers: [[5, 0]] },
    ];

    expect(layersOf(bases, 3)).toBeNull();
  });

  it('ends the layers at the first that names a glyph past the font', () => {
    const layers = layersOf(
      [
        {
          glyph: 3,
          layers: [
            [4, 0],
            [GLYPH_COUNT, 0],
            [5, 0],
          ],
        },
      ],
      3
    );

    expect(layers).toEqual([{ glyph: 4, colour: RED }]);
  });

  it('ends the layers at the first that names a palette entry past the palette', () => {
    expect(
      layersOf(
        [
          {
            glyph: 3,
            layers: [
              [4, 2],
              [5, 0],
            ],
          },
        ],
        3
      )
    ).toBeNull();
  });

  it('gives no layers where they run past the layer records', () => {
    const bytes = colrTable([{ glyph: 3, layers: [[4, 0]] }]).toBytes();
    // numLayers 2 in the base glyph record, over one layer record.
    bytes[14 + 5] = 2;

    expect(colrLayersReader(fontWithColr(bytes), PALETTE)?.(3)).toBeNull();
  });

  it('rejects a version past 1', () => {
    const bytes = colrTable([{ glyph: 3, layers: [[4, 0]] }]).toBytes();
    bytes[1] = 2;

    expect(colrLayersReader(fontWithColr(bytes), PALETTE)).toBeNull();
  });

  it('rejects base glyph records past the table', () => {
    const bytes = colrTable([{ glyph: 3, layers: [[4, 0]] }]).toBytes();
    // numBaseGlyphRecords 9.
    bytes[3] = 9;

    expect(colrLayersReader(fontWithColr(bytes), PALETTE)).toBeNull();
  });

  it('rejects layer records past the table', () => {
    const bytes = colrTable([{ glyph: 3, layers: [[4, 0]] }]).toBytes();
    // numLayerRecords 9.
    bytes[13] = 9;

    expect(colrLayersReader(fontWithColr(bytes), PALETTE)).toBeNull();
  });

  it('reads the version 0 layers of a version 1 table whose lists fit', () => {
    expect(layersOf3(colrV1(0))).toEqual([{ glyph: 4, colour: RED }]);
  });

  it('rejects a version 1 table whose base glyph list runs past it, version 0 layers and all', () => {
    expect(layersOf3(colrV1(99))).toBeNull();
  });
});

/** A version 1 table over one version 0 base glyph 3, its empty base glyph list claiming `paintRecordCount` records. */
function colrV1(paintRecordCount: number): number[] {
  const v0 = colrTable([{ glyph: 3, layers: [[4, 0]] }]).toBytes();
  // The version 0 records move 20 bytes on, past the longer header.
  const header = [0, 1, 0, 1, 0, 0, 0, 34, 0, 0, 0, 40, 0, 1];
  const v1Offsets = [0, 0, 0, 44, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  const records = v0.slice(14);
  // FreeType wants bytes past the list count, where the paints of real records sit.
  const baseGlyphList = [0, 0, 0, paintRecordCount, 0, 0];
  return [...header, ...v1Offsets, ...records, ...baseGlyphList];
}

function layersOf3(bytes: number[]) {
  return colrLayersReader(fontWithColr(bytes), PALETTE)?.(3) ?? null;
}
