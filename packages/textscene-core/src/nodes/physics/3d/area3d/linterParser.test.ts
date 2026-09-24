/**
 * Area3D strict validators for the reverb bus and wind properties, asserted through
 * `validatorRegistry`, not by linting a `.tscn`. Each `describe` pins the engine rule at its
 * cited `area_3d.cpp:NNN`: both edges accepted, the first value past each edge at its severity,
 * and `inf`, `-inf`, `inf_neg` and `nan` at what a numeric comparison against them yields.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry';
import './linterParser';

/** The error a validator returns for a value, or null when it accepts it. */
function check(property: string, value: string) {
  const validator = validatorRegistry.findValidator('Area3D', property);
  expect(validator, `no validator registered for Area3D.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

describe('Area3D reverb/wind strict validators', () => {
  describe('reverb_bus_enabled — area_3d.cpp:803, PROPERTY_HINT_GROUP_ENABLE (bool)', () => {
    it('accepts "true" and "false"', () => {
      expect(check('reverb_bus_enabled', 'true')).toBeNull();
      expect(check('reverb_bus_enabled', 'false')).toBeNull();
    });

    it('rejects a non-boolean value', () => {
      const error = check('reverb_bus_enabled', 'yes');
      expect(error).not.toBeNull();
      expect(error!.code).toBe('INVALID_REVERB_BUS_ENABLED_FORMAT');
    });
  });

  describe('reverb_bus_name — area_3d.cpp:804, Variant::STRING_NAME', () => {
    // set_reverb_bus_name (:618-620) is a bare assignment. The ENUM hint's
    // option list is populated dynamically in the editor only, so it carries
    // no bound to check a saved value against.
    it('accepts the quoted-string spelling Godot writes for the default bus', () => {
      expect(check('reverb_bus_name', '"Master"')).toBeNull();
    });

    it('accepts the &"name" StringName spelling', () => {
      expect(check('reverb_bus_name', '&"Master"')).toBeNull();
    });

    it('rejects an unquoted bare word', () => {
      const error = check('reverb_bus_name', 'Master');
      expect(error).not.toBeNull();
      expect(error!.code).toBe('INVALID_REVERB_BUS_NAME_FORMAT');
    });
  });

  // Both reverb properties hint "0,1,0.01" over a bare-assigning setter
  // (set_reverb_amount :631-633, set_reverb_uniformity :639-641), so both ends
  // are hint-only and out-of-range warns on either side.
  describe.each([
    ['reverb_bus_amount', 'area_3d.cpp:805', 'REVERB_BUS_AMOUNT', 'loud'],
    ['reverb_bus_uniformity', 'area_3d.cpp:806', 'REVERB_BUS_UNIFORMITY', 'even'],
  ])('%s — %s, PROPERTY_HINT_RANGE "0,1,0.01"', (property, _cite, code, nonNumeric) => {
    it.each([
      ['the 0 floor', '0'],
      ['the 1 ceiling', '1'],
      // Every comparison against nan is false, so neither bound trips.
      ['nan', 'nan'],
    ])('accepts %s', (_label, value) => {
      expect(check(property, value)).toBeNull();
    });

    it('rejects a non-numeric value', () => {
      const error = check(property, nonNumeric);
      expect(error).not.toBeNull();
      expect(error!.code).toBe(`INVALID_${code}_FORMAT`);
    });

    it.each([
      ['just below 0', '-0.01'],
      ['just above 1', '1.01'],
      // `inf > 1` trips the hinted ceiling and `inf_neg < 0` the hinted floor.
      // The bare-assignment setter never checks either.
      ['inf', 'inf'],
      ['inf_neg', 'inf_neg'],
    ])('warns on %s rather than erroring', (_label, value) => {
      const error = check(property, value);
      expect(error).not.toBeNull();
      expect(error!.code).toBe(`INVALID_${code}_VALUE`);
      expect(error!.severity).toBe('warning');
    });
  });

  // Both wind properties hint a floor of 0 with or_greater opening the max, over
  // a bare-assigning setter (set_wind_force_magnitude :134-137,
  // set_wind_attenuation_factor :145-148), so only below-floor warns.
  describe.each([
    [
      'wind_force_magnitude',
      'area_3d.cpp:794',
      '"0,10,0.001,or_greater"',
      'WIND_FORCE_MAGNITUDE',
      '50',
      'strong',
    ],
    [
      'wind_attenuation_factor',
      'area_3d.cpp:795',
      '"0.0,3.0,0.001,or_greater"',
      'WIND_ATTENUATION_FACTOR',
      '10',
      'gusty',
    ],
  ])(
    '%s — %s, PROPERTY_HINT_RANGE %s',
    (property, _cite, _hint, code, pastCeiling, nonNumeric) => {
      it.each([
        ['the 0 floor', '0'],
        ['a value past the hint ceiling (or_greater opens it)', pastCeiling],
        // or_greater leaves no ceiling for inf to trip.
        ['inf', 'inf'],
        // Every comparison against nan is false, so the floor never trips.
        ['nan', 'nan'],
      ])('accepts %s', (_label, value) => {
        expect(check(property, value)).toBeNull();
      });

      it('rejects a non-numeric value', () => {
        const error = check(property, nonNumeric);
        expect(error).not.toBeNull();
        expect(error!.code).toBe(`INVALID_${code}_FORMAT`);
      });

      it.each([
        ['just below the 0 floor', '-0.001'],
        // `inf_neg < 0` trips the hinted floor.
        ['inf_neg', 'inf_neg'],
      ])('warns on %s rather than erroring', (_label, value) => {
        const error = check(property, value);
        expect(error).not.toBeNull();
        expect(error!.code).toBe(`INVALID_${code}_VALUE`);
        expect(error!.severity).toBe('warning');
      });
    }
  );

  describe('wind_source_path — area_3d.cpp:796, Variant::NODE_PATH, PROPERTY_HINT_NODE_PATH_VALID_TYPES "Node3D"', () => {
    // set_wind_source_path (:156-159) is a bare assignment: format-only.
    it('accepts a NodePath literal', () => {
      expect(check('wind_source_path', 'NodePath("../WindSource")')).toBeNull();
    });

    it('accepts the empty NodePath("") — area_3d.cpp:173 treats it as "no wind source"', () => {
      expect(check('wind_source_path', 'NodePath("")')).toBeNull();
    });

    it('rejects a value that is not a NodePath literal', () => {
      const error = check('wind_source_path', '../WindSource');
      expect(error).not.toBeNull();
      expect(error!.code).toBe('INVALID_WIND_SOURCE_PATH_PATH');
    });
  });
});
