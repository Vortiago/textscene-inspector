/**
 * SplitContainer's one number, `computed_split_offset`.
 *
 * Every expectation is a Godot 4.6.3 render of
 * `scenes/fixtures/unit-split-container.tscn`, whose rows are 400 px wide with
 * ColorRect children so the boundary is a hard colour edge. Measured widths
 * (first child | gap | second child):
 *
 *   Both        194 | 12 | 194     both expand, split_offset 0
 *   Offset      254 | 12 | 134     both expand, split_offset 60
 *   Ratio       294 | 12 |  94     both expand, stretch_ratio 3 : 1
 *   FirstOnly   388 | 12 |   0     only the first expands
 *   Neither     120 | 12 | 268     neither expands, split_offset 120
 *   SepZero     196 |  8 | 196     theme separation overridden to 0
 *   Collapsed   194 | 12 | 194     collapsed, split_offset 60 ignored
 *   DragColl    200 |  0 | 200     dragger_visibility = HIDDEN_COLLAPSED
 *
 * `SepZero` is what measures `GRABBER_EXTENT`: `_get_separation` returns
 * `MAX(theme_cache.separation, grabber width)`, so overriding the constant to
 * 0 leaves the grabber's own 8 px behind.
 */

import { describe, expect, it } from 'vitest';

import type { ControlProperties } from '../control/types';
import {
  DEFAULT_SEPARATION,
  GRABBER_EXTENT,
  splitFirstExtent,
  splitSeparation,
  type SplitContainerProperties,
} from './splitContainer';

const EXPAND_FILL = 3; // SIZE_FILL | SIZE_EXPAND, what the editor writes
const FILL = 1;

const expands = (ratio?: number): ControlProperties =>
  ({ sizeFlagsHorizontal: EXPAND_FILL, sizeFlagsStretchRatio: ratio }) as ControlProperties;
const fixed = (): ControlProperties => ({ sizeFlagsHorizontal: FILL }) as ControlProperties;

/** Evaluate a `calc(P% + Npx)` (or a bare `Npx`) against a container size. */
function evaluate(extent: string, size: number): number {
  const calc = /^calc\((-?[\d.]+)% \+ (-?[\d.]+)px\)$/.exec(extent);
  if (calc) return (size * Number(calc[1])) / 100 + Number(calc[2]);
  const px = /^(-?[\d.]+)px$/.exec(extent);
  if (px) return Number(px[1]);
  throw new Error(`unparseable extent: ${extent}`);
}

const split = (
  props: SplitContainerProperties,
  first: ControlProperties | undefined,
  second: ControlProperties | undefined
) => evaluate(splitFirstExtent(props, first, second, false), 400);

describe('splitSeparation', () => {
  it('defaults to the theme constant', () => {
    expect(splitSeparation({} as SplitContainerProperties)).toBe(DEFAULT_SEPARATION);
    expect(DEFAULT_SEPARATION).toBe(12);
  });

  /** `MAX(theme_cache.separation, grabber)` — the override cannot go below the icon. */
  it('floors an override at the grabber’s own extent', () => {
    expect(
      splitSeparation({ name: 'S', themeOverrideConstants: { separation: 0 } })
    ).toBe(GRABBER_EXTENT);
    expect(GRABBER_EXTENT).toBe(8);
  });

  it('honours an override above the grabber', () => {
    expect(
      splitSeparation({ name: 'S', themeOverrideConstants: { separation: 30 } })
    ).toBe(30);
  });

  it('only HIDDEN_COLLAPSED removes the separation — plain HIDDEN keeps it', () => {
    expect(splitSeparation({ draggerVisibility: 1 } as SplitContainerProperties)).toBe(12);
    expect(splitSeparation({ draggerVisibility: 2 } as SplitContainerProperties)).toBe(0);
  });
});

describe('splitFirstExtent', () => {
  describe('both children expand — size * ratio - sep * 0.5 + split_offset', () => {
    it('splits evenly at rest (Both: 194)', () => {
      expect(split({} as SplitContainerProperties, expands(), expands())).toBe(194);
    });

    it('displaces the boundary by split_offset (Offset: 254)', () => {
      expect(split({ splitOffset: 60 } as SplitContainerProperties, expands(), expands())).toBe(254);
    });

    it('weights by stretch_ratio (Ratio 3:1: 294)', () => {
      expect(split({} as SplitContainerProperties, expands(3), expands(1))).toBe(294);
    });

    it('collapsed pins the boundary at rest, ignoring split_offset (Collapsed: 194)', () => {
      expect(
        split({ splitOffset: 60, collapsed: true } as SplitContainerProperties, expands(), expands())
      ).toBe(194);
    });

    it('a zeroed separation moves the boundary to the exact middle (DragColl: 200)', () => {
      expect(split({ draggerVisibility: 2 } as SplitContainerProperties, expands(), expands())).toBe(
        200
      );
    });

    it('an overridden separation still keeps the grabber’s floor (SepZero: 196)', () => {
      expect(
        split({ name: 'S', themeOverrideConstants: { separation: 0 } }, expands(), expands())
      ).toBe(196);
    });
  });

  describe('one or neither expands', () => {
    it('first only — size - sep + split_offset (FirstOnly: 388)', () => {
      expect(split({} as SplitContainerProperties, expands(), fixed())).toBe(388);
    });

    it('neither — the offset IS the extent (Neither: 120)', () => {
      expect(split({ splitOffset: 120 } as SplitContainerProperties, fixed(), fixed())).toBe(120);
    });

    /**
     * Second-only takes the same branch as neither: `_compute_split_offset`
     * has no `else if (second_is_expanded)`, so the first child is pinned at
     * `split_offset` and the second absorbs everything else.
     */
    it('second only — same branch as neither', () => {
      expect(split({ splitOffset: 40 } as SplitContainerProperties, fixed(), expands())).toBe(40);
    });
  });

  describe('edge cases', () => {
    it('reads the vertical flags when the split is vertical', () => {
      const vertical = { sizeFlagsVertical: EXPAND_FILL } as ControlProperties;
      expect(evaluate(splitFirstExtent({} as SplitContainerProperties, vertical, vertical, true), 400)).toBe(
        194
      );
      // The horizontal flags must not be consulted on a vertical split.
      expect(
        evaluate(splitFirstExtent({} as SplitContainerProperties, expands(), expands(), true), 400)
      ).toBe(0);
    });

    it('treats two zero stretch ratios as even rather than NaN', () => {
      expect(split({} as SplitContainerProperties, expands(0), expands(0))).toBe(194);
    });

    it('handles a missing child’s properties as Godot defaults', () => {
      expect(split({} as SplitContainerProperties, undefined, undefined)).toBe(0);
    });
  });
});
