/**
 * NavigationRegion3D strict validators, asserted through `validatorRegistry` so a
 * failure points at the validator rather than at scene parsing. NavigationRegion2D
 * answers the same keys identically, citing navigation_region_2d.cpp:350 for
 * `navigation_layers` where this slice cites :301.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../linter/ValidatorRegistry';
import './linterParser';

/** The error a validator returns for a value, or null when it accepts it. */
function check(property: string, value: string) {
  const validator = validatorRegistry.findValidator('NavigationRegion3D', property);
  expect(validator, `no validator registered for NavigationRegion3D.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

describe('NavigationRegion3D strict validators', () => {
  describe('enabled', () => {
    // navigation_region_3d.cpp:299: plain BOOL, no hint.
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
    // navigation_region_3d.cpp:300: plain BOOL, no hint.
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
    // navigation_region_3d.cpp:301: PROPERTY_HINT_LAYERS_3D_NAVIGATION.
    // set_navigation_layers (:95-103) is a bare assignment, so out-of-range warns.
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

    it('accepts a negative mask, which is how Godot spells all layers on', () => {
      expect(check('navigation_layers', '-1')).toBeNull();
      expect(check('navigation_layers', '4294967295')).toBeNull();
    });

    it('errors past the 32-bit range, where the engine drops the extra bits', () => {
      const error = check('navigation_layers', '4294967296');
      expect(error).not.toBeNull();
      expect(error!.code).toBe('INVALID_NAVIGATION_LAYERS_VALUE');
      expect(error!.severity).toBe('error');
    });
  });

  // Both are plain FLOATs with no range hint, but both setters refuse cost < 0.0
  // (navigation_region_3d.cpp:132 and :147), so the setter guard enforces the floor.
  describe.each([
    ['enter_cost', 'navigation_region_3d.cpp:302', 'ENTER_COST', '-0.01'],
    ['travel_cost', 'navigation_region_3d.cpp:303', 'TRAVEL_COST', '-1'],
  ])('%s — %s, plain FLOAT with NO PROPERTY_HINT_RANGE', (property, _cite, code, negative) => {
    it('accepts zero, a positive float, and the non-finite spellings Godot writes', () => {
      // `nan < 0.0` is false in C++ and JS, so the guard lets `nan` through, and `inf`
      // has no ceiling to trip.
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
