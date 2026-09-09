/**
 * FlowContainer strict validators — format and range checks.
 *
 * Asserted through `validatorRegistry` rather than by linting a `.tscn`: the
 * unit under test is the validator, so a failure points at the validator
 * instead of at scene parsing, and no fixture text has to be maintained
 * alongside it. There is no genuine cross-field rule for FlowContainer, so
 * there is no `linter.ts` / `linter.test.ts`.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry';
import './linterParser';

/** The error a validator returns for a value, or null when it accepts it. */
function check(property: string, value: string) {
  const validator = validatorRegistry.findValidator('FlowContainer', property);
  expect(validator, `no validator registered for FlowContainer.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

describe('FlowContainer strict validators', () => {
  it('registers validators of its own', () => {
    expect(validatorRegistry.getOwnKeys('FlowContainer')).not.toEqual([]);
  });

  it('rejects a malformed value on every property it validates', () => {
    // A validator that accepts arbitrary prose is not validating a format. The
    // sweep is generic on purpose; per-property cases below are the real check.
    const accepted = validatorRegistry
      .getOwnKeys('FlowContainer')
      .filter((property) => check(property, 'definitely-not-a-valid-value') === null);
    expect(accepted).toEqual([]);
  });

  it('validates exactly its own 4 members — no more, no fewer', () => {
    // doc/classes/FlowContainer.xml lists 4 own members, none `overrides=`.
    // HFlowContainer/VFlowContainer (a later wave) chain through this base,
    // so a widened set here would leak into both leaves.
    expect(new Set(validatorRegistry.getOwnKeys('FlowContainer'))).toEqual(
      new Set(['alignment', 'last_wrap_alignment', 'vertical', 'reverse_fill'])
    );
  });

  describe('alignment', () => {
    // flow_container.cpp:410-412: ALIGNMENT_BEGIN=0, ALIGNMENT_CENTER=1, ALIGNMENT_END=2.
    it('accepts 0 (ALIGNMENT_BEGIN, the documented default)', () => {
      expect(check('alignment', '0')).toBeNull();
    });

    it('accepts 1 (ALIGNMENT_CENTER)', () => {
      expect(check('alignment', '1')).toBeNull();
    });

    it('accepts 2 (ALIGNMENT_END)', () => {
      expect(check('alignment', '2')).toBeNull();
    });

    it('rejects a value beyond the enum (3)', () => {
      expect(check('alignment', '3')).not.toBeNull();
    });

    it('rejects a negative value', () => {
      expect(check('alignment', '-1')).not.toBeNull();
    });

    it('rejects a non-numeric value', () => {
      expect(check('alignment', 'center')).not.toBeNull();
    });
  });

  describe('last_wrap_alignment', () => {
    // flow_container.cpp:413-416: LAST_WRAP_ALIGNMENT_INHERIT=0, _BEGIN=1, _CENTER=2, _END=3.
    it('accepts 0 (LAST_WRAP_ALIGNMENT_INHERIT, the documented default)', () => {
      expect(check('last_wrap_alignment', '0')).toBeNull();
    });

    it('accepts 1 (LAST_WRAP_ALIGNMENT_BEGIN)', () => {
      expect(check('last_wrap_alignment', '1')).toBeNull();
    });

    it('accepts 2 (LAST_WRAP_ALIGNMENT_CENTER)', () => {
      expect(check('last_wrap_alignment', '2')).toBeNull();
    });

    it('accepts 3 (LAST_WRAP_ALIGNMENT_END)', () => {
      expect(check('last_wrap_alignment', '3')).toBeNull();
    });

    it('rejects a value beyond the enum (4)', () => {
      expect(check('last_wrap_alignment', '4')).not.toBeNull();
    });

    it('rejects a negative value', () => {
      expect(check('last_wrap_alignment', '-1')).not.toBeNull();
    });

    it('rejects a non-numeric value', () => {
      expect(check('last_wrap_alignment', 'inherit')).not.toBeNull();
    });
  });

  describe('vertical', () => {
    it('accepts false (the documented default)', () => {
      expect(check('vertical', 'false')).toBeNull();
    });

    it('accepts true', () => {
      expect(check('vertical', 'true')).toBeNull();
    });

    it('rejects a non-boolean value', () => {
      expect(check('vertical', '1')).not.toBeNull();
    });
  });

  describe('reverse_fill', () => {
    it('accepts false (the documented default)', () => {
      expect(check('reverse_fill', 'false')).toBeNull();
    });

    it('accepts true', () => {
      expect(check('reverse_fill', 'true')).toBeNull();
    });

    it('rejects a non-boolean value', () => {
      expect(check('reverse_fill', 'yes')).not.toBeNull();
    });
  });
});
