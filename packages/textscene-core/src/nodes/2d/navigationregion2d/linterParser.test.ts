/**
 * NavigationRegion2D strict validators — format and bound checks.
 *
 * Asserted through `validatorRegistry` rather than by linting a `.tscn`: the
 * unit under test is the validator, so a failure points at the validator
 * instead of at scene parsing, and no fixture text has to be maintained
 * alongside it. Rule-level behaviour belongs in linter.test.ts, through `Linter`.
 *
 * NavigationRegion3D carries the SAME five keys and MUST answer identically
 * except where the engine genuinely differs (navigation_layers' hint index,
 * 2D vs 3D) — see navigationregion3d/linterParser.test.ts.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../linter/ValidatorRegistry';
import './linterParser';

/** The error a validator returns for a value, or null when it accepts it. */
function check(property: string, value: string) {
  const validator = validatorRegistry.findValidator('NavigationRegion2D', property);
  expect(validator, `no validator registered for NavigationRegion2D.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

describe('NavigationRegion2D strict validators', () => {
  describe('enabled', () => {
    // navigation_region_2d.cpp:348 — plain BOOL, no hint.
    it('accepts "true" and "false"', () => {
      expect(check('enabled', 'true')).toBeNull();
      expect(check('enabled', 'false')).toBeNull();
    });

    it('rejects a non-boolean value', () => {
      const error = check('enabled', 'yes');
      expect(error).not.toBeNull();
      expect(error!.code).toBe('INVALID_ENABLED_FORMAT');
    });
  });

  describe('use_edge_connections', () => {
    // navigation_region_2d.cpp:349 — plain BOOL, no hint.
    it('accepts "true" and "false"', () => {
      expect(check('use_edge_connections', 'true')).toBeNull();
      expect(check('use_edge_connections', 'false')).toBeNull();
    });

    it('rejects a non-boolean value', () => {
      const error = check('use_edge_connections', 'yes');
      expect(error).not.toBeNull();
      expect(error!.code).toBe('INVALID_USE_EDGE_CONNECTIONS_FORMAT');
    });
  });

  describe('navigation_layers', () => {
    // navigation_region_2d.cpp:350 — PROPERTY_HINT_LAYERS_2D_NAVIGATION.
    // set_navigation_layers (:75-83) only short-circuits on an unchanged
    // value; otherwise it is a bare assignment, so out-of-range warns.
    it('accepts a single-layer mask', () => {
      expect(check('navigation_layers', '1')).toBeNull();
    });

    it('accepts zero (no layers)', () => {
      expect(check('navigation_layers', '0')).toBeNull();
    });

    it('accepts the full 32-bit mask', () => {
      expect(check('navigation_layers', '4294967295')).toBeNull();
    });

    it('rejects a non-numeric mask', () => {
      const error = check('navigation_layers', 'not-a-number');
      expect(error).not.toBeNull();
      expect(error!.code).toBe('INVALID_NAVIGATION_LAYERS_FORMAT');
    });

    it('warns on a negative mask rather than erroring', () => {
      const error = check('navigation_layers', '-1');
      expect(error).not.toBeNull();
      expect(error!.code).toBe('INVALID_NAVIGATION_LAYERS_VALUE');
      expect(error!.severity).toBe('warning');
    });

    it('warns on a mask beyond the 32-bit range rather than erroring', () => {
      const error = check('navigation_layers', '4294967296');
      expect(error).not.toBeNull();
      expect(error!.code).toBe('INVALID_NAVIGATION_LAYERS_VALUE');
      expect(error!.severity).toBe('warning');
    });
  });

  // Both are plain FLOATs with NO PROPERTY_HINT_RANGE, yet both setters open with
  // ERR_FAIL_COND_MSG(cost < 0.0) — navigation_region_2d.cpp:112 and :127 — so the floor is
  // ENFORCED and comes from the setter guard rather than from ADD_PROPERTY. The
  // ADD_PROPERTY cite and the negative sample stay columns.
  describe.each([
    ['enter_cost', 'navigation_region_2d.cpp:351', 'ENTER_COST', '-0.01'],
    ['travel_cost', 'navigation_region_2d.cpp:352', 'TRAVEL_COST', '-1'],
  ])('%s — %s, plain FLOAT with NO PROPERTY_HINT_RANGE', (property, _cite, code, negative) => {
    it('accepts zero, a positive float, and the non-finite spellings Godot writes', () => {
      // `nan < 0.0` is false in both C++ and JS, so the setter's guard lets
      // `nan` through; there is no ceiling for `inf` to trip.
      expect(check(property, '0')).toBeNull();
      expect(check(property, '1000')).toBeNull();
      expect(check(property, 'inf')).toBeNull();
      expect(check(property, 'nan')).toBeNull();
    });

    it('rejects a non-numeric value', () => {
      const error = check(property, 'cheap');
      expect(error).not.toBeNull();
      expect(error!.code).toBe(`INVALID_${code}_FORMAT`);
    });

    it('errors on a negative value: the setter refuses it', () => {
      const error = check(property, negative);
      expect(error).not.toBeNull();
      expect(error!.code).toBe(`INVALID_${code}_VALUE`);
      expect(error!.severity).toBe('error');
    });

    it('errors on inf_neg, since inf_neg < 0.0 trips the same guard', () => {
      const error = check(property, 'inf_neg');
      expect(error).not.toBeNull();
      expect(error!.severity).toBe('error');
    });
  });
});
