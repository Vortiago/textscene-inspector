/**
 * The sheet's `Out of range` cell, which nothing else can check.
 *
 * `docs:lint-sections --check` regenerates the block and diffs it against the
 * committed sheet, so generator and expectation come from ONE code path: swap
 * the tier mapping, regenerate all 241 files, and the check stays green while
 * every sheet lies. The cell therefore needs a test that states the expected
 * text independently, which is what this file is.
 *
 * The defect it was written for: the first version read `grounding.kind`, which
 * collapses to `enforced` when EITHER end is, so `extra_cull_margin` (enforced
 * floor at visual_instance_3d.cpp:377, hinted ceiling at :602) rendered a flat
 * "error" and told a reader that exceeding the ceiling stops a build.
 */

import { describe, it, expect } from 'vitest';
import { outOfRangeCell } from './lintCoverage.mjs';

describe('the Out of range cell', () => {
  it('names one tier when both ends agree', () => {
    expect(outOfRangeCell({ min: 'error', max: 'error' })).toBe('error');
    expect(outOfRangeCell({ min: 'warning', max: 'warning' })).toBe('warning');
  });

  it('names both ends when they disagree, the case that made this column wrong', () => {
    // extra_cull_margin: ERR_FAIL_COND on the floor, hint alone on the ceiling.
    expect(outOfRangeCell({ min: 'error', max: 'warning' })).toBe('error below, warning above');
    expect(outOfRangeCell({ min: 'warning', max: 'error' })).toBe('warning below, error above');
  });

  it('names only the end that is bounded', () => {
    expect(outOfRangeCell({ min: 'error' })).toBe('error below');
    expect(outOfRangeCell({ max: 'warning' })).toBe('warning above');
  });

  it('is blank when nothing is bounded, rather than inventing a rejection', () => {
    // A format-only validator has no out-of-range behaviour to report; a tier
    // here would advertise a rejection it never makes.
    expect(outOfRangeCell(undefined)).toBe('');
    expect(outOfRangeCell({})).toBe('');
  });

  describe('the two-tier branch, where a setter end sits beside a hint end', () => {
    // Eight single-argument cases above never reach this branch, so the whole
    // `enforcedMin || enforcedMax` half of the function was uncovered — the
    // half that decides whether a warning band is describable at all.
    it('names the setter end and the band the hint still owns', () => {
      // extra_cull_margin's shape: the refusal starts strictly below the hint's
      // floor, so values between the two really do only warn.
      expect(
        outOfRangeCell(
          { min: 'warning', max: 'warning' },
          { min: 1, max: 16384, enforcedMin: { at: 0 } }
        )
      ).toBe('error below 0, warning below 1, warning above 16384');
    });

    it('drops a band no value can land in', () => {
      // The refusal starts AT the hint's floor, so nothing can be below the
      // hint without being refused first; naming the band describes a warning
      // that can never fire.
      expect(
        outOfRangeCell({ min: 'warning', max: 'warning' }, { min: 0, max: 100, enforcedMin: { at: 0 } })
      ).toBe('error below 0, warning above 100');
    });

    it('separates `at or below` from `below` on the exclusive flag', () => {
      // aspect_ratio: both ends at 0, only the setter's excluding it. This is
      // the single case that distinguishes `<` from `<=` in the reachability
      // test, and the one row where the Accepts column moves with it.
      expect(
        outOfRangeCell(
          { min: 'warning', max: 'warning' },
          { min: 0, max: 100, enforcedMin: { at: 0, exclusive: true } }
        )
      ).toBe('error at or below 0, warning above 100');
    });

    it('does the same at the ceiling', () => {
      expect(
        outOfRangeCell(
          { min: 'warning', max: 'warning' },
          { min: 0, max: 4096, enforcedMax: { at: 4096, exclusive: true } }
        )
      ).toBe('warning below 0, error at or above 4096');
      expect(
        outOfRangeCell(
          { min: 'warning', max: 'warning' },
          { min: 0, max: 100, enforcedMax: { at: 200 } }
        )
      ).toBe('warning below 0, warning above 100, error above 200');
    });
  });
});
