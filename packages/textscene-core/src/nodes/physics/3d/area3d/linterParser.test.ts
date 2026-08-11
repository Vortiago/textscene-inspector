/**
 * Area3D strict validators — reverb bus and wind property format/bound checks.
 *
 * Asserted through `validatorRegistry` rather than by linting a `.tscn`: the
 * unit under test is the validator, so a failure points at the validator
 * instead of at scene parsing, and no fixture text has to be maintained
 * alongside it. Rule-level behaviour belongs in linter.test.ts, through `Linter`.
 *
 * Each `describe` pins the ENGINE rule at its cited `area_3d.cpp:NNN`, not
 * just "rejects garbage": both edges of every bound are asserted accepted,
 * the first value past each edge is asserted at the right severity, and the
 * non-finite spellings Godot's own writer produces (`inf`, `-inf`, `inf_neg`,
 * `nan`) are asserted at whatever a bare numeric comparison against them
 * actually yields — not assumed.
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
    // set_reverb_bus_name (:618-620) is a bare assignment; the ENUM hint's
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

  describe('reverb_bus_amount — area_3d.cpp:805, PROPERTY_HINT_RANGE "0,1,0.01"', () => {
    // set_reverb_amount (:631-633) is a bare assignment: both ends are
    // hint-only, so out-of-range warns rather than errors on either side.
    it('accepts the 0 floor', () => {
      expect(check('reverb_bus_amount', '0')).toBeNull();
    });

    it('accepts the 1 ceiling', () => {
      expect(check('reverb_bus_amount', '1')).toBeNull();
    });

    it('rejects a non-numeric value', () => {
      const error = check('reverb_bus_amount', 'loud');
      expect(error).not.toBeNull();
      expect(error!.code).toBe('INVALID_REVERB_BUS_AMOUNT_FORMAT');
    });

    it('warns just below 0 rather than erroring', () => {
      const error = check('reverb_bus_amount', '-0.01');
      expect(error).not.toBeNull();
      expect(error!.code).toBe('INVALID_REVERB_BUS_AMOUNT_VALUE');
      expect(error!.severity).toBe('warning');
    });

    it('warns just above 1 rather than erroring', () => {
      const error = check('reverb_bus_amount', '1.01');
      expect(error).not.toBeNull();
      expect(error!.code).toBe('INVALID_REVERB_BUS_AMOUNT_VALUE');
      expect(error!.severity).toBe('warning');
    });

    it('warns on inf: `inf > 1` trips the hinted ceiling, the bare-assignment setter never checks it', () => {
      expect(check('reverb_bus_amount', 'inf')?.severity).toBe('warning');
    });

    it('warns on inf_neg: `inf_neg < 0` trips the hinted floor the same way', () => {
      expect(check('reverb_bus_amount', 'inf_neg')?.severity).toBe('warning');
    });

    it('accepts nan: every comparison against nan is false, so neither bound trips', () => {
      expect(check('reverb_bus_amount', 'nan')).toBeNull();
    });
  });

  describe('reverb_bus_uniformity — area_3d.cpp:806, PROPERTY_HINT_RANGE "0,1,0.01"', () => {
    // set_reverb_uniformity (:639-641) is a bare assignment, the same shape
    // as reverb_bus_amount above.
    it('accepts the 0 floor', () => {
      expect(check('reverb_bus_uniformity', '0')).toBeNull();
    });

    it('accepts the 1 ceiling', () => {
      expect(check('reverb_bus_uniformity', '1')).toBeNull();
    });

    it('rejects a non-numeric value', () => {
      const error = check('reverb_bus_uniformity', 'even');
      expect(error).not.toBeNull();
      expect(error!.code).toBe('INVALID_REVERB_BUS_UNIFORMITY_FORMAT');
    });

    it('warns just below 0 rather than erroring', () => {
      const error = check('reverb_bus_uniformity', '-0.01');
      expect(error).not.toBeNull();
      expect(error!.code).toBe('INVALID_REVERB_BUS_UNIFORMITY_VALUE');
      expect(error!.severity).toBe('warning');
    });

    it('warns just above 1 rather than erroring', () => {
      const error = check('reverb_bus_uniformity', '1.01');
      expect(error).not.toBeNull();
      expect(error!.code).toBe('INVALID_REVERB_BUS_UNIFORMITY_VALUE');
      expect(error!.severity).toBe('warning');
    });

    it('warns on inf: `inf > 1` trips the hinted ceiling', () => {
      expect(check('reverb_bus_uniformity', 'inf')?.severity).toBe('warning');
    });

    it('warns on inf_neg: `inf_neg < 0` trips the hinted floor', () => {
      expect(check('reverb_bus_uniformity', 'inf_neg')?.severity).toBe('warning');
    });

    it('accepts nan: every comparison against nan is false, so neither bound trips', () => {
      expect(check('reverb_bus_uniformity', 'nan')).toBeNull();
    });
  });

  describe('wind_force_magnitude — area_3d.cpp:794, PROPERTY_HINT_RANGE "0,10,0.001,or_greater"', () => {
    // or_greater opens the max, so only the floor is a bound.
    // set_wind_force_magnitude (:134-137) is a bare assignment, so below-floor
    // warns rather than errors.
    it('accepts the 0 floor', () => {
      expect(check('wind_force_magnitude', '0')).toBeNull();
    });

    it('accepts a value past the hint ceiling (or_greater opens it)', () => {
      expect(check('wind_force_magnitude', '50')).toBeNull();
    });

    it('rejects a non-numeric value', () => {
      const error = check('wind_force_magnitude', 'strong');
      expect(error).not.toBeNull();
      expect(error!.code).toBe('INVALID_WIND_FORCE_MAGNITUDE_FORMAT');
    });

    it('warns just below the 0 floor rather than erroring', () => {
      const error = check('wind_force_magnitude', '-0.001');
      expect(error).not.toBeNull();
      expect(error!.code).toBe('INVALID_WIND_FORCE_MAGNITUDE_VALUE');
      expect(error!.severity).toBe('warning');
    });

    it('accepts inf: or_greater leaves no ceiling for it to trip', () => {
      expect(check('wind_force_magnitude', 'inf')).toBeNull();
    });

    it('warns on inf_neg: `inf_neg < 0` trips the hinted floor', () => {
      expect(check('wind_force_magnitude', 'inf_neg')?.severity).toBe('warning');
    });

    it('accepts nan: every comparison against nan is false, so the floor never trips', () => {
      expect(check('wind_force_magnitude', 'nan')).toBeNull();
    });
  });

  describe('wind_attenuation_factor — area_3d.cpp:795, PROPERTY_HINT_RANGE "0.0,3.0,0.001,or_greater"', () => {
    // or_greater opens the max. set_wind_attenuation_factor (:145-148) is a
    // bare assignment, so below-floor warns rather than errors.
    it('accepts the 0 floor', () => {
      expect(check('wind_attenuation_factor', '0')).toBeNull();
    });

    it('accepts a value past the hint ceiling (or_greater opens it)', () => {
      expect(check('wind_attenuation_factor', '10')).toBeNull();
    });

    it('rejects a non-numeric value', () => {
      const error = check('wind_attenuation_factor', 'gusty');
      expect(error).not.toBeNull();
      expect(error!.code).toBe('INVALID_WIND_ATTENUATION_FACTOR_FORMAT');
    });

    it('warns just below the 0 floor rather than erroring', () => {
      const error = check('wind_attenuation_factor', '-0.001');
      expect(error).not.toBeNull();
      expect(error!.code).toBe('INVALID_WIND_ATTENUATION_FACTOR_VALUE');
      expect(error!.severity).toBe('warning');
    });

    it('accepts inf: or_greater leaves no ceiling for it to trip', () => {
      expect(check('wind_attenuation_factor', 'inf')).toBeNull();
    });

    it('warns on inf_neg: `inf_neg < 0` trips the hinted floor', () => {
      expect(check('wind_attenuation_factor', 'inf_neg')?.severity).toBe('warning');
    });

    it('accepts nan: every comparison against nan is false, so the floor never trips', () => {
      expect(check('wind_attenuation_factor', 'nan')).toBeNull();
    });
  });

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
