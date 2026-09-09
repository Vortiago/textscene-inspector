/**
 * GridContainer strict validators.
 *
 * Asserted through `validatorRegistry` rather than by linting a `.tscn`, so a
 * failure points at the validator instead of at scene parsing.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry';
import { expectFixtureClean } from '../../../../linter/testing/fixtureCheck';
import './linterParser';

/** The error a validator returns for a value, or null when it accepts it. */
function check(property: string, value: string) {
  const validator = validatorRegistry.findValidator('GridContainer', property);
  expect(validator, `no validator registered for GridContainer.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

/** The single own member doc/classes/GridContainer.xml lists. */
const KEYS: string[] = ['columns'];

describe('GridContainer strict validators', () => {
  it('registers exactly what GridContainer binds', () => {
    expect(validatorRegistry.getOwnKeys('GridContainer').sort()).toEqual([...KEYS].sort());
  });

  it('accepts every value its own fixture carries', () => {
    expectFixtureClean('unit-grid-container.tscn');
  });

  it('resolves inherited keys through the base-walk', () => {
    // Container contributes no validators of its own, so a GridContainer must
    // still reach Control and CanvasItem keys through the chain.
    expect(validatorRegistry.findValidator('GridContainer', 'anchor_right')).not.toBeNull();
    expect(validatorRegistry.findValidator('GridContainer', 'modulate')).not.toBeNull();
  });

  describe('columns (int 1-1024, floor enforced, ceiling hinted)', () => {
    it('accepts the documented default (1)', () => {
      expect(check('columns', '1')).toBeNull();
    });

    it('accepts a typical value', () => {
      expect(check('columns', '4')).toBeNull();
    });

    it('accepts the hinted ceiling (1024)', () => {
      expect(check('columns', '1024')).toBeNull();
    });

    it('errors below 1, which set_columns refuses outright', () => {
      // grid_container.cpp:244, ERR_FAIL_COND(p_columns < 1): the write never
      // lands, so this is the enforced tier rather than the hint's.
      const error = check('columns', '0');
      expect(error?.severity).toBe('error');
    });

    it('errors on a negative value for the same reason', () => {
      expect(check('columns', '-3')?.severity).toBe('error');
    });

    it('only warns above 1024, since nothing in the setter reads the ceiling', () => {
      const diagnostic = check('columns', '2000');
      expect(diagnostic?.severity).toBe('warning');
    });

    it('rejects a non-integer value', () => {
      expect(check('columns', 'four')?.code).toBe('INVALID_COLUMNS_FORMAT');
    });
  });
});
