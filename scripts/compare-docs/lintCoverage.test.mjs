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
});
