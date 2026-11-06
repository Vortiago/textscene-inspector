/**
 * The offsets of the marks of a cluster in Montserrat SemiBold's mark subset with its `GPOS` and `GDEF`
 * removed. The expected values are what HarfBuzz 11 shapes for the same text (`uharfbuzz`, font scale
 * 64000, so one px per design unit): the `x_offset` of a mark plus its base's advance, and its
 * `y_offset`, in 26.6 divided by 64. `decomposedMarks.godot.test.ts` holds Godot's own values at
 * text sizes.
 */
import { describe, expect, it } from 'vitest';
import { fallbackMarkReader } from './fallbackMarkPositioning';
import { fixtureSfnt } from './sfntOutlines.testkit';

/** The font's em in px: a design unit is then a whole pixel, and the 26.6 scale has no remainder. */
const EM_PX = 1000;

const offsetsOf = (cluster: string) =>
  fallbackMarkReader(fixtureSfnt('montserrat-semibold-marks-nogpos-subset.ttf'))!(
    Array.from(cluster.normalize('NFD')),
    EM_PX
  );

describe('fallbackMarkReader', () => {
  it.each([
    ['Ä', [674.5, 144.5]],
    ['Á', [617.5, 155.5]],
    ['À', [731.5, 155.5]],
    ['Å', [675, 169.5]],
    ['é', [554, -2.25]],
    ['ä', [603.5, -7.75]],
    ['ü', [640.5, -10.75]],
  ])('centres a mark above its base by ink, as %s', (cluster, [x, y]) => {
    expect(offsetsOf(cluster)[1]).toEqual({ x, y });
  });

  it('measures a second mark of the same class from the marks before it', () => {
    expect(offsetsOf('Ǟ')).toEqual([
      { x: 0, y: 0 },
      { x: 674.5, y: 144.5 },
      { x: 674.5, y: 308 },
    ]);
  });

  it('measures a mark of another class from the base again', () => {
    expect(offsetsOf('Ậ')).toEqual([
      { x: 0, y: 0 },
      { x: 674.5, y: 0 },
      { x: 674.5, y: 155.5 },
    ]);
  });
});
