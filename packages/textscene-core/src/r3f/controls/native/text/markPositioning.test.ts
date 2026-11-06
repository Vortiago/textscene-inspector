/**
 * The offsets of the marks of a cluster in Montserrat SemiBold's `mark` and `mkmk` lookups. The
 * expected values are what HarfBuzz 11 shapes for the same text (`uharfbuzz`): the `x_offset` of a
 * mark plus its base's advance, and its `y_offset`.
 */
import { describe, expect, it } from 'vitest';
import { markPositioningReader } from './markPositioning';
import { fixtureFontBytes } from './sfntOutlines.testkit';
import { openSfnt } from './sfntTables';

const offsetsOf = (cluster: string) =>
  markPositioningReader(openSfnt(fixtureFontBytes('montserrat-semibold-marks-subset.ttf'))!)!(
    Array.from(cluster)
  );

describe('markPositioningReader', () => {
  it('attaches a mark to its base with the difference of their anchors', () => {
    expect(offsetsOf('Ä')).toEqual([
      { x: 0, y: 0 },
      { x: 674, y: 166 },
    ]);
  });

  it('attaches a mark to the base by its own anchor class', () => {
    expect(offsetsOf('é')).toEqual([
      { x: 0, y: 0 },
      { x: 611, y: 0 },
    ]);
  });

  it('attaches a second mark to the mark before it, where a mark-to-mark lookup has the pair', () => {
    expect(offsetsOf('Ȫ')).toEqual([
      { x: 0, y: 0 },
      { x: 721, y: 166 },
      { x: 721, y: 322 },
    ]);
  });

  it('attaches a mark below a base and a mark above it each to the base', () => {
    expect(offsetsOf('Ậ')).toEqual([
      { x: 0, y: 0 },
      { x: 674, y: 0 },
      { x: 674, y: 166 },
    ]);
  });

  it('leaves a mark at its pen position, after the base, where the GPOS has no mark lookup', () => {
    const reader = markPositioningReader(
      openSfnt(fixtureFontBytes('montserrat-semibold-marks-nomark-subset.ttf'))!
    )!;
    expect(reader(Array.from('Ȫ'.normalize('NFD')))).toEqual([
      { x: 0, y: 0 },
      { x: 842, y: 0 },
      { x: 842, y: 0 },
    ]);
  });

  it('leaves a mark at its pen position where the GPOS has a script and no lookup at all', () => {
    const reader = markPositioningReader(
      openSfnt(fixtureFontBytes('montserrat-semibold-marks-nolookups-subset.ttf'))!
    )!;
    expect(reader(Array.from('À'.normalize('NFD')))).toEqual([
      { x: 0, y: 0 },
      { x: 749, y: 0 },
    ]);
  });

  it('answers null for a font with no GPOS script, which HarfBuzz places by its fallback', () => {
    expect(
      markPositioningReader(openSfnt(fixtureFontBytes('montserrat-semibold-marks-nogpos-subset.ttf'))!)
    ).toBeNull();
  });
});
