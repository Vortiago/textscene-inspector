/**
 * LightmapGI strict validators — format and range checks.
 *
 * Asserted through `validatorRegistry` rather than by linting a `.tscn`: the
 * unit under test is the validator, so a failure points at the validator
 * instead of at scene parsing, and no fixture text has to be maintained
 * alongside it. Rule-level behaviour belongs in linter.test.ts, through `Linter`.
 *
 * Grow this into one case per property — happy, malformed, and any bound — and
 * quote the governing Godot source line beside every numeric bound.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../linter/ValidatorRegistry';
import { expectFixtureClean } from '../../../linter/testing/fixtureCheck';
import './linterParser';

/** The error a validator returns for a value, or null when it accepts it. */
function check(property: string, value: string) {
  const validator = validatorRegistry.findValidator('LightmapGI', property);
  expect(validator, `no validator registered for LightmapGI.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

/**
 * Set exactly ONE, from the source rather than from expectation: list the keys
 * LightmapGI binds, or set DECLARES_NOTHING when it binds no ADD_PROPERTY at all.
 * Leaving both unset is red on purpose. Do NOT delete an assertion to go green.
 *
 * scene/3d/lightmap_gi.cpp:1918-1943 — the 22 `ADD_PROPERTY` calls in
 * `LightmapGI::_bind_methods`, matching doc/classes/LightmapGI.xml's 22
 * `<members>`, none carrying `overrides=`.
 */
const KEYS: string[] = [
  'quality',
  'supersampling',
  'supersampling_factor',
  'bounces',
  'bounce_indirect_energy',
  'directional',
  'shadowmask_mode',
  'use_texture_for_bounces',
  'interior',
  'use_denoiser',
  'denoiser_strength',
  'denoiser_range',
  'bias',
  'texel_scale',
  'max_texture_size',
  'environment_mode',
  'environment_custom_sky',
  'environment_custom_color',
  'environment_custom_energy',
  'camera_attributes',
  'generate_probes_subdiv',
  'light_data',
];
/** True only when the class binds NO ADD_PROPERTY. Say which source line proves it. */
const DECLARES_NOTHING = false;

/**
 * Keys LightmapGI does NOT declare, each paired with the ancestor that does.
 * Name at least one; VisualInstance3D is where to start.
 *
 * This is the assertion the malformed-value sweep below CANNOT make. That sweep
 * iterates `getOwnKeys`, so on a class that rightly declares nothing it sweeps
 * an EMPTY set and passes while asserting nothing — "Godot gives LightmapGI no
 * properties of its own" and "nobody has written this slice yet" look identical
 * to it. Resolving a key through the base-walk to the ancestor's own validator
 * function tells the two apart, and it is red until filled for the same reason
 * KEYS is.
 *
 * `sorting_offset` and `sorting_use_aabb_center` are ALSO documented
 * VisualInstance3D members, but that class's own `ADD_PROPERTY` for both passes
 * `PROPERTY_USAGE_NONE` explicitly, and LightmapGI never overrides
 * `_validate_property` to re-enable them (its own override, lightmap_gi.cpp:1825,
 * touches six different property names, none of them these two) — so on
 * LightmapGI neither one serialises, and VisualInstance3D's own linterParser
 * registers neither. `layers` is the one VisualInstance3D member that actually
 * reaches a LightmapGI `.tscn`.
 */
const INHERITED: [owner: string, key: string][] = [['VisualInstance3D', 'layers']];

describe('LightmapGI strict validators', () => {
  it('registers exactly what LightmapGI binds', () => {
    expect(
      DECLARES_NOTHING || KEYS.length > 0,
      'fill KEYS from the ADD_PROPERTY calls, or set DECLARES_NOTHING with the source line that proves it'
    ).toBe(true);
    expect(validatorRegistry.getOwnKeys('LightmapGI').sort()).toEqual([...KEYS].sort());
  });

  it('accepts every value its own fixture carries', () => {
    // The fixture's "zero errors and zero warnings" claim, RUN rather than
    // reasoned. `fixtureLint` owns the whole-registry version but needs the
    // barrel, so it cannot run while sibling slices are being written; this
    // checks the same file against whatever this test imported.
    expectFixtureClean('unit-lightmap-gi.tscn');
  });

  it('rejects a malformed value on every property it validates', () => {
    // A validator that accepts arbitrary prose is not validating a format. The
    // sweep is generic on purpose; per-property cases come next. Vacuous when
    // LightmapGI declares nothing, which is what INHERITED below covers.
    const accepted = validatorRegistry
      .getOwnKeys('LightmapGI')
      .filter((property) => check(property, 'definitely-not-a-valid-value') === null);
    expect(accepted).toEqual([]);
  });

  it('resolves each inherited key to the ancestor that declares it', () => {
    expect(
      INHERITED.length,
      'name at least one key LightmapGI inherits, and the ancestor that declares it'
    ).toBeGreaterThan(0);
    for (const [owner, key] of INHERITED) {
      const owned = validatorRegistry.findValidator(owner, key);
      expect(owned, `${owner} does not declare '${key}'`).not.toBeNull();
      // The SAME function, not merely some validator: a shadowing copy on
      // LightmapGI would answer here while drifting from the ancestor's rule.
      expect(validatorRegistry.findValidator('LightmapGI', key)).toBe(owned);
      expect(validatorRegistry.getOwnKeys('LightmapGI')).not.toContain(key);
    }
  });

  describe('quality', () => {
    it('accepts every documented enum value (0-3)', () => {
      expect(check('quality', '0')).toBeNull();
      expect(check('quality', '1')).toBeNull();
      expect(check('quality', '2')).toBeNull();
      expect(check('quality', '3')).toBeNull();
    });

    it('rejects a value past the enum — set_bake_quality is a bare assignment, hint-only', () => {
      const error = check('quality', '4');
      expect(error).not.toBeNull();
      expect(error?.severity).toBe('warning');
    });

    it('rejects a non-numeric value as a format error', () => {
      expect(check('quality', 'high')?.severity).toBe('error');
    });
  });

  describe('supersampling', () => {
    it('accepts true and false', () => {
      expect(check('supersampling', 'true')).toBeNull();
      expect(check('supersampling', 'false')).toBeNull();
    });

    it('rejects a non-boolean token', () => {
      expect(check('supersampling', 'yes')).not.toBeNull();
    });
  });

  describe('supersampling_factor', () => {
    it('accepts the enforced floor (1)', () => {
      expect(check('supersampling_factor', '1')).toBeNull();
    });

    it('accepts the hinted ceiling (8)', () => {
      expect(check('supersampling_factor', '8')).toBeNull();
    });

    it('rejects below 1 — set_supersampling_factor is ERR_FAIL_COND(p_factor < 1)', () => {
      const error = check('supersampling_factor', '0.5');
      expect(error).not.toBeNull();
      expect(error?.severity).toBe('error');
    });

    it('rejects past the closed hint ceiling as a warning, not an error', () => {
      const error = check('supersampling_factor', '20');
      expect(error).not.toBeNull();
      expect(error?.severity).toBe('warning');
    });
  });

  describe('bounces', () => {
    it('accepts the enforced bounds (0 and 16)', () => {
      expect(check('bounces', '0')).toBeNull();
      expect(check('bounces', '16')).toBeNull();
    });

    it('accepts a value past the hint\'s soft "6" — the hint carries or_greater, and the real ceiling is 16', () => {
      expect(check('bounces', '10')).toBeNull();
    });

    it('rejects a negative value — set_bounces is ERR_FAIL_COND(p_bounces < 0 || p_bounces > 16)', () => {
      const error = check('bounces', '-1');
      expect(error).not.toBeNull();
      expect(error?.severity).toBe('error');
    });

    it('rejects past the true ceiling of 16, which the hint\'s or_greater does not actually open', () => {
      const error = check('bounces', '17');
      expect(error).not.toBeNull();
      expect(error?.severity).toBe('error');
      expect(error?.message).toContain('at most 16');
      expect(error?.message).toContain("Godot's setter refuses the write");
    });

    it('still refuses a value far past 16 — or_greater opens the HINT, not the setter', () => {
      expect(check('bounces', '1000')?.severity).toBe('error');
    });

    it('carries the setter ceiling in the enforced slot, leaving the or_greater end of `bounds` open', () => {
      const validator = validatorRegistry.findValidator('LightmapGI', 'bounces');
      expect(validator?.bounds).toEqual({ min: 0, enforcedMax: { at: 16 } });
    });

    it('warns that a fractional value is truncated, never refusing it', () => {
      // `Variant::_to_int` (variant.h:369-370) converts rather than refusing,
      // so the file loads — with 5 where it says 5.9.
      expect(check('bounces', '5.9')?.severity).toBe('warning');
    });
  });

  describe('bounce_indirect_energy', () => {
    it('accepts the enforced floor (0) and the hinted ceiling (2)', () => {
      expect(check('bounce_indirect_energy', '0')).toBeNull();
      expect(check('bounce_indirect_energy', '2')).toBeNull();
    });

    it('rejects a negative value — set_bounce_indirect_energy is ERR_FAIL_COND(p_indirect_energy < 0.0)', () => {
      const error = check('bounce_indirect_energy', '-0.1');
      expect(error).not.toBeNull();
      expect(error?.severity).toBe('error');
    });

    it('rejects past the closed hint ceiling as a warning', () => {
      const error = check('bounce_indirect_energy', '2.5');
      expect(error).not.toBeNull();
      expect(error?.severity).toBe('warning');
    });
  });

  describe('directional', () => {
    it('accepts true and false', () => {
      expect(check('directional', 'true')).toBeNull();
      expect(check('directional', 'false')).toBeNull();
    });

    it('rejects a non-boolean token', () => {
      expect(check('directional', '1')).not.toBeNull();
    });
  });

  describe('shadowmask_mode', () => {
    it('accepts every value this property\'s own hint lists (0-2)', () => {
      expect(check('shadowmask_mode', '0')).toBeNull();
      expect(check('shadowmask_mode', '1')).toBeNull();
      expect(check('shadowmask_mode', '2')).toBeNull();
    });

    it('warns on 3 — ShadowmaskMode::SHADOWMASK_MODE_ONLY exists on the enum type (lightmap_gi.h:50) but this property\'s own hint (cpp:1925) offers only 3 labels', () => {
      const error = check('shadowmask_mode', '3');
      expect(error).not.toBeNull();
      expect(error?.severity).toBe('warning');
    });

    it('rejects a negative value as a warning — set_shadowmask_mode is a bare assignment', () => {
      const error = check('shadowmask_mode', '-1');
      expect(error).not.toBeNull();
      expect(error?.severity).toBe('warning');
    });

    it('rejects a non-numeric value as a format error', () => {
      expect(check('shadowmask_mode', 'none')?.severity).toBe('error');
    });
  });

  describe('use_texture_for_bounces', () => {
    it('accepts true and false', () => {
      expect(check('use_texture_for_bounces', 'true')).toBeNull();
      expect(check('use_texture_for_bounces', 'false')).toBeNull();
    });

    it('rejects a non-boolean token', () => {
      expect(check('use_texture_for_bounces', 'on')).not.toBeNull();
    });
  });

  describe('interior', () => {
    it('accepts true and false', () => {
      expect(check('interior', 'true')).toBeNull();
      expect(check('interior', 'false')).toBeNull();
    });

    it('rejects a non-boolean token', () => {
      expect(check('interior', 'maybe')).not.toBeNull();
    });
  });

  describe('use_denoiser', () => {
    it('accepts true and false', () => {
      expect(check('use_denoiser', 'true')).toBeNull();
      expect(check('use_denoiser', 'false')).toBeNull();
    });

    it('rejects a non-boolean token', () => {
      expect(check('use_denoiser', '0')).not.toBeNull();
    });
  });

  describe('denoiser_strength', () => {
    it('accepts the hinted floor (0.001)', () => {
      expect(check('denoiser_strength', '0.001')).toBeNull();
    });

    it('accepts a value past the soft ceiling — the hint carries or_greater', () => {
      expect(check('denoiser_strength', '5')).toBeNull();
    });

    it('rejects below the hinted floor as a warning — set_denoiser_strength is a bare assignment', () => {
      const error = check('denoiser_strength', '0.0001');
      expect(error).not.toBeNull();
      expect(error?.severity).toBe('warning');
    });

    it('rejects a non-numeric value as a format error', () => {
      expect(check('denoiser_strength', 'low')?.severity).toBe('error');
    });
  });

  describe('denoiser_range', () => {
    it('accepts the hinted bounds (1 and 20)', () => {
      expect(check('denoiser_range', '1')).toBeNull();
      expect(check('denoiser_range', '20')).toBeNull();
    });

    it('rejects below 1 as a warning — set_denoiser_range is a bare assignment', () => {
      const error = check('denoiser_range', '0');
      expect(error).not.toBeNull();
      expect(error?.severity).toBe('warning');
    });

    it('rejects past 20 as a warning', () => {
      const error = check('denoiser_range', '21');
      expect(error).not.toBeNull();
      expect(error?.severity).toBe('warning');
    });

    it('warns that a fractional value is truncated, never refusing it', () => {
      expect(check('denoiser_range', '15.9')?.severity).toBe('warning');
    });
  });

  describe('bias', () => {
    it('accepts the enforced floor (0.00001)', () => {
      expect(check('bias', '0.00001')).toBeNull();
    });

    it('accepts a large value — the hint carries or_greater and nothing caps the ceiling', () => {
      expect(check('bias', '10')).toBeNull();
    });

    it('rejects below the floor — set_bias is ERR_FAIL_COND(p_bias < 0.00001)', () => {
      const error = check('bias', '0.000001');
      expect(error).not.toBeNull();
      expect(error?.severity).toBe('error');
    });

    it('rejects a non-numeric value as a format error', () => {
      expect(check('bias', 'low')?.severity).toBe('error');
    });
  });

  describe('texel_scale', () => {
    it('accepts the documented default (1.0) and the hinted ceiling (100)', () => {
      expect(check('texel_scale', '1.0')).toBeNull();
      expect(check('texel_scale', '100')).toBeNull();
    });

    it('accepts the hint floor 0.01 in silence', () => {
      expect(check('texel_scale', '0.01')).toBeNull();
    });

    // The band is one CMP_EPSILON wide: set_texel_scale:1749 refuses below
    // (0.01 - CMP_EPSILON) while the :1932 hint floors at a bare 0.01, so a
    // value in between loads and only warns.
    it('warns on a value fractionally under 0.01 but within CMP_EPSILON, which the setter still takes', () => {
      const error = check('texel_scale', '0.0099999');
      expect(error).not.toBeNull();
      expect(error?.severity).toBe('warning');
    });

    it('errors below (0.01 - CMP_EPSILON) — set_texel_scale is ERR_FAIL_COND(p_multiplier < (0.01 - CMP_EPSILON))', () => {
      const error = check('texel_scale', '0.005');
      expect(error).not.toBeNull();
      expect(error?.severity).toBe('error');
    });

    it('rejects past the closed hint ceiling as a warning', () => {
      const error = check('texel_scale', '150');
      expect(error).not.toBeNull();
      expect(error?.severity).toBe('warning');
    });
  });

  describe('max_texture_size', () => {
    it('accepts the enforced bounds (2048 and 16384)', () => {
      expect(check('max_texture_size', '2048')).toBeNull();
      expect(check('max_texture_size', '16384')).toBeNull();
    });

    it('rejects below 2048 — set_max_texture_size is ERR_FAIL_COND_MSG(p_size < 2048, …)', () => {
      const error = check('max_texture_size', '2047');
      expect(error).not.toBeNull();
      expect(error?.severity).toBe('error');
    });

    it('rejects past 16384 — set_max_texture_size is ERR_FAIL_COND_MSG(p_size > 16384, …)', () => {
      const error = check('max_texture_size', '16385');
      expect(error).not.toBeNull();
      expect(error?.severity).toBe('error');
    });

    it('warns that a fractional value in range is truncated, never refusing it', () => {
      expect(check('max_texture_size', '8192.7')?.severity).toBe('warning');
    });
  });

  describe('environment_mode', () => {
    it('accepts every documented enum value (0-3)', () => {
      expect(check('environment_mode', '0')).toBeNull();
      expect(check('environment_mode', '1')).toBeNull();
      expect(check('environment_mode', '2')).toBeNull();
      expect(check('environment_mode', '3')).toBeNull();
    });

    it('rejects a value past the enum as a warning — set_environment_mode is a bare assignment', () => {
      const error = check('environment_mode', '4');
      expect(error).not.toBeNull();
      expect(error?.severity).toBe('warning');
    });

    it('rejects a non-numeric value as a format error', () => {
      expect(check('environment_mode', 'scene')?.severity).toBe('error');
    });
  });

  describe('environment_custom_sky', () => {
    it('accepts a SubResource reference', () => {
      expect(check('environment_custom_sky', 'SubResource("Sky_1")')).toBeNull();
    });

    it('accepts an ExtResource reference', () => {
      expect(check('environment_custom_sky', 'ExtResource("1")')).toBeNull();
    });

    it('accepts the literal null, a cleared slot Godot loads', () => {
      // Omitting a cleared slot is what the WRITER does. The loader still
      // takes a hand-written `null`: variant_parser.cpp:699 reads it as
      // Variant(), can_convert_strict allows NIL -> OBJECT (variant.cpp:543),
      // and the Ref setter accepts an invalid Ref.
      expect(check('environment_custom_sky', 'null')).toBeNull();
    });

    it('rejects a bare resource path string', () => {
      expect(check('environment_custom_sky', '"res://sky.tres"')).not.toBeNull();
    });
  });

  describe('environment_custom_color', () => {
    it('accepts a Color literal', () => {
      expect(check('environment_custom_color', 'Color(0.8, 0.6, 0.4, 1)')).toBeNull();
    });

    it('rejects a malformed Color literal', () => {
      expect(check('environment_custom_color', 'Color(0.8, 0.6)')).not.toBeNull();
    });
  });

  describe('environment_custom_energy', () => {
    it('accepts the hinted bounds (0 and 64)', () => {
      expect(check('environment_custom_energy', '0')).toBeNull();
      expect(check('environment_custom_energy', '64')).toBeNull();
    });

    it('rejects a negative value as a warning — set_environment_custom_energy is a bare assignment', () => {
      const error = check('environment_custom_energy', '-0.1');
      expect(error).not.toBeNull();
      expect(error?.severity).toBe('warning');
    });

    it('rejects past 64 as a warning', () => {
      const error = check('environment_custom_energy', '64.1');
      expect(error).not.toBeNull();
      expect(error?.severity).toBe('warning');
    });
  });

  describe('camera_attributes', () => {
    it('accepts a SubResource reference', () => {
      expect(check('camera_attributes', 'SubResource("CameraAttributesPractical_1")')).toBeNull();
    });

    it('accepts an ExtResource reference', () => {
      expect(check('camera_attributes', 'ExtResource("1")')).toBeNull();
    });

    it('accepts the literal null, a cleared slot Godot loads', () => {
      // Omitting a cleared slot is what the WRITER does. The loader still
      // takes a hand-written `null`: variant_parser.cpp:699 reads it as
      // Variant(), can_convert_strict allows NIL -> OBJECT (variant.cpp:543),
      // and the Ref setter accepts an invalid Ref.
      expect(check('camera_attributes', 'null')).toBeNull();
    });
  });

  describe('generate_probes_subdiv', () => {
    it('accepts every documented enum value (0-4)', () => {
      expect(check('generate_probes_subdiv', '0')).toBeNull();
      expect(check('generate_probes_subdiv', '1')).toBeNull();
      expect(check('generate_probes_subdiv', '2')).toBeNull();
      expect(check('generate_probes_subdiv', '3')).toBeNull();
      expect(check('generate_probes_subdiv', '4')).toBeNull();
    });

    it('rejects a value past the enum as a warning — set_generate_probes is a bare assignment', () => {
      const error = check('generate_probes_subdiv', '5');
      expect(error).not.toBeNull();
      expect(error?.severity).toBe('warning');
    });

    it('rejects a non-numeric value as a format error', () => {
      expect(check('generate_probes_subdiv', 'high')?.severity).toBe('error');
    });
  });

  describe('light_data', () => {
    it('accepts a SubResource reference', () => {
      expect(check('light_data', 'SubResource("LightmapGIData_1")')).toBeNull();
    });

    it('accepts an ExtResource reference', () => {
      expect(check('light_data', 'ExtResource("1")')).toBeNull();
    });

    it('accepts the literal null, a cleared slot Godot loads', () => {
      // Omitting a cleared slot is what the WRITER does. The loader still
      // takes a hand-written `null`: variant_parser.cpp:699 reads it as
      // Variant(), can_convert_strict allows NIL -> OBJECT (variant.cpp:543),
      // and the Ref setter accepts an invalid Ref.
      expect(check('light_data', 'null')).toBeNull();
    });
  });
});
