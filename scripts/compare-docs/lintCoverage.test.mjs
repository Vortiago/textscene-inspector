/**
 * The `Out of range` cell and the rules that reach a type, stated independently: `docs:lint-sections --check`
 * diffs against output from the same code path. `extra_cull_margin` has an
 * enforced floor (visual_instance_3d.cpp:377) and a hinted ceiling (:602).
 */

import { describe, it, expect } from 'vitest';
import { outOfRangeCell, rulesFor } from './lintCoverage.mjs';

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
    expect(outOfRangeCell(undefined)).toBe('');
    expect(outOfRangeCell({})).toBe('');
  });

  describe('the two-tier branch, where a setter end sits beside a hint end', () => {
    it('names the setter end and the band the hint still owns', () => {
      // The refusal starts below the hint's floor, so values between warn.
      expect(
        outOfRangeCell({ min: 'warning', max: 'warning' }, { min: 1, max: 16384, enforcedMin: { at: 0 } })
      ).toBe('error below 0, warning below 1, warning above 16384');
    });

    it('drops a band no value can land in', () => {
      // The refusal starts at the hint's floor, so no value lands in the band.
      expect(
        outOfRangeCell({ min: 'warning', max: 'warning' }, { min: 0, max: 100, enforcedMin: { at: 0 } })
      ).toBe('error below 0, warning above 100');
    });

    it('separates `at or below` from `below` on the exclusive flag', () => {
      // aspect_ratio: both ends at 0, only the setter's excluding it, the case
      // that separates `<` from `<=` in the reachability test.
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
        outOfRangeCell({ min: 'warning', max: 'warning' }, { min: 0, max: 100, enforcedMax: { at: 200 } })
      ).toBe('warning below 0, warning above 100, error above 200');
    });
  });
});

describe('the rules that reach a type', () => {
  const arm = { severity: 'warning', ruleName: 'some-warning', grounding: { kind: 'engine', at: 'a.cpp:1' } };
  const noNodeRules = { getRulesForNodeType: () => [] };
  const resourceRules = {
    getRulesForResourceType: (type) =>
      type === 'Sky'
        ? [{ meta: { name: 'valid-sky', description: 'd', resourceType: 'Sky', emits: [arm] } }]
        : [],
  };

  it('lists a resource rule on its resource', () => {
    expect(rulesFor('Sky', noNodeRules, resourceRules)).toEqual([
      { name: 'valid-sky', description: 'd', universal: false, viaMatcher: false, emits: [arm] },
    ]);
  });

  it('lists no resource rule on another type', () => {
    expect(rulesFor('Environment', noNodeRules, resourceRules)).toEqual([]);
  });
});
