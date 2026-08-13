/**
 * ReflectionProbe strict validators — format and range checks.
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
  const validator = validatorRegistry.findValidator('ReflectionProbe', property);
  expect(validator, `no validator registered for ReflectionProbe.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

/**
 * Set exactly ONE, from the source rather than from expectation: list the keys
 * ReflectionProbe binds, or set DECLARES_NOTHING when it binds no ADD_PROPERTY at all.
 * Leaving both unset is red on purpose. Do NOT delete an assertion to go green.
 */
const KEYS: string[] = [
  'update_mode',
  'intensity',
  'blend_distance',
  'max_distance',
  'size',
  'origin_offset',
  'box_projection',
  'interior',
  'enable_shadows',
  'cull_mask',
  'reflection_mask',
  'mesh_lod_threshold',
  'ambient_mode',
  'ambient_color',
  'ambient_color_energy',
];
/** True only when the class binds NO ADD_PROPERTY. Say which source line proves it. */
const DECLARES_NOTHING = false;

/**
 * Keys ReflectionProbe does NOT declare, each paired with the ancestor that does.
 * Name at least one; VisualInstance3D is where to start.
 *
 * This is the assertion the malformed-value sweep below CANNOT make. That sweep
 * iterates `getOwnKeys`, so on a class that rightly declares nothing it sweeps
 * an EMPTY set and passes while asserting nothing — "Godot gives ReflectionProbe no
 * properties of its own" and "nobody has written this slice yet" look identical
 * to it. Resolving a key through the base-walk to the ancestor's own validator
 * function tells the two apart, and it is red until filled for the same reason
 * KEYS is.
 */
const INHERITED: [owner: string, key: string][] = [
  // visual_instance_3d.cpp:182, PROPERTY_HINT_LAYERS_3D_RENDER — ReflectionProbe
  // never overrides `layers`, so it inherits VisualInstance3D's own validator.
  ['VisualInstance3D', 'layers'],
];

describe('ReflectionProbe strict validators', () => {
  it('registers exactly what ReflectionProbe binds', () => {
    expect(
      DECLARES_NOTHING || KEYS.length > 0,
      'fill KEYS from the ADD_PROPERTY calls, or set DECLARES_NOTHING with the source line that proves it'
    ).toBe(true);
    expect(validatorRegistry.getOwnKeys('ReflectionProbe').sort()).toEqual([...KEYS].sort());
  });

  it('accepts every value its own fixture carries', () => {
    // The fixture's "zero errors and zero warnings" claim, RUN rather than
    // reasoned. `fixtureLint` owns the whole-registry version but needs the
    // barrel, so it cannot run while sibling slices are being written; this
    // checks the same file against whatever this test imported.
    expectFixtureClean('unit-reflection-probe.tscn');
  });

  it('rejects a malformed value on every property it validates', () => {
    // A validator that accepts arbitrary prose is not validating a format. The
    // sweep is generic on purpose; per-property cases come next. Vacuous when
    // ReflectionProbe declares nothing, which is what INHERITED below covers.
    const accepted = validatorRegistry
      .getOwnKeys('ReflectionProbe')
      .filter((property) => check(property, 'definitely-not-a-valid-value') === null);
    expect(accepted).toEqual([]);
  });

  it('resolves each inherited key to the ancestor that declares it', () => {
    expect(
      INHERITED.length,
      'name at least one key ReflectionProbe inherits, and the ancestor that declares it'
    ).toBeGreaterThan(0);
    for (const [owner, key] of INHERITED) {
      const owned = validatorRegistry.findValidator(owner, key);
      expect(owned, `${owner} does not declare '${key}'`).not.toBeNull();
      // The SAME function, not merely some validator: a shadowing copy on
      // ReflectionProbe would answer here while drifting from the ancestor's rule.
      expect(validatorRegistry.findValidator('ReflectionProbe', key)).toBe(owned);
      expect(validatorRegistry.getOwnKeys('ReflectionProbe')).not.toContain(key);
    }
  });

  describe('update_mode', () => {
    // reflection_probe.cpp:260 — PROPERTY_HINT_ENUM "Once (Fast),Always (Slow)".
    it.each([0, 1])('accepts %i', (n) => {
      expect(check('update_mode', String(n))).toBeNull();
    });

    it('warns past the last constant (set_update_mode has no ERR_FAIL)', () => {
      const error = check('update_mode', '2');
      expect(error?.code).toBe('INVALID_UPDATE_MODE_VALUE');
      expect(error?.severity).toBe('warning');
    });

    it('rejects a non-numeric value', () => {
      expect(check('update_mode', 'Once')?.code).toBe('INVALID_UPDATE_MODE_FORMAT');
    });
  });

  describe('intensity', () => {
    // reflection_probe.cpp:261 — PROPERTY_HINT_RANGE "0,1,0.01", both ends hinted.
    it('accepts the low end', () => {
      expect(check('intensity', '0')).toBeNull();
    });

    it('accepts the high end', () => {
      expect(check('intensity', '1')).toBeNull();
    });

    it('warns (not errors) below the hinted floor', () => {
      const error = check('intensity', '-0.5');
      expect(error?.severity).toBe('warning');
      expect(error?.code).toBe('INVALID_INTENSITY_VALUE');
    });

    it('warns (not errors) above the hinted ceiling', () => {
      const error = check('intensity', '1.5');
      expect(error?.severity).toBe('warning');
    });

    it('rejects a non-numeric value', () => {
      expect(check('intensity', 'bright')?.code).toBe('INVALID_INTENSITY_FORMAT');
    });
  });

  describe('blend_distance', () => {
    // reflection_probe.cpp:262 — "0,8,0.01,or_greater,suffix:m": or_greater
    // opens the max end, so only the 0 floor is a real (hinted) bound.
    it('accepts the hinted floor', () => {
      expect(check('blend_distance', '0')).toBeNull();
    });

    it('accepts a value far past the soft ceiling', () => {
      expect(check('blend_distance', '1000')).toBeNull();
    });

    it('warns (not errors) below the floor', () => {
      const error = check('blend_distance', '-1');
      expect(error?.severity).toBe('warning');
      expect(error?.code).toBe('INVALID_BLEND_DISTANCE_VALUE');
    });

    it('rejects a non-numeric value', () => {
      expect(check('blend_distance', 'far')?.code).toBe('INVALID_BLEND_DISTANCE_FORMAT');
    });
  });

  describe('max_distance', () => {
    // reflection_probe.cpp:81 — `max_distance = CLAMP(p_distance, 0.0, 262'144.0)`.
    // The hint's "0,16384,...,or_greater" is a soft slider extent that the
    // clamp overrides; 16384 must never behave as a bound.
    it('accepts the enforced ceiling', () => {
      expect(check('max_distance', '262144')).toBeNull();
    });

    it('accepts a value well past the hint slider extent but under the real clamp', () => {
      expect(check('max_distance', '20000')).toBeNull();
    });

    it('errors past the enforced ceiling', () => {
      const error = check('max_distance', '262145');
      expect(error?.severity).toBe('error');
      expect(error?.code).toBe('INVALID_MAX_DISTANCE_VALUE');
      expect(error?.message).toContain('at most 262144');
      expect(error?.message).toContain("Godot's setter refuses the write");
    });

    it('still refuses a value far past the clamp — or_greater opens the HINT, not the clamp', () => {
      expect(check('max_distance', '1000000')?.severity).toBe('error');
    });

    it('carries the clamp ceiling in the enforced slot, leaving the or_greater end of `bounds` open', () => {
      const validator = validatorRegistry.findValidator('ReflectionProbe', 'max_distance');
      expect(validator?.bounds).toEqual({ min: 0, enforcedMax: { at: 262144 } });
    });

    it('errors below the enforced floor', () => {
      const error = check('max_distance', '-1');
      expect(error?.severity).toBe('error');
    });

    it('rejects a non-numeric value', () => {
      expect(check('max_distance', 'far')?.code).toBe('INVALID_MAX_DISTANCE_FORMAT');
    });
  });

  describe('size', () => {
    // reflection_probe.cpp:99-117 — set_size stores the component UNCLAMPED;
    // the local half_size it derives only re-clamps origin_offset. Format only.
    it('accepts a Vector3 literal', () => {
      expect(check('size', 'Vector3(20, 20, 20)')).toBeNull();
    });

    it('accepts a zero component — set_size never rejects one', () => {
      expect(check('size', 'Vector3(0, 20, 20)')).toBeNull();
    });

    it('accepts a negative component — set_size never rejects one', () => {
      expect(check('size', 'Vector3(-5, 20, 20)')).toBeNull();
    });

    it('rejects a non-Vector3 value', () => {
      expect(check('size', '20, 20, 20')?.code).toBe('INVALID_SIZE_FORMAT');
    });
  });

  describe('origin_offset', () => {
    // reflection_probe.cpp:123-136 — set_origin_offset DOES clamp each
    // component, but to `size[i]/2 - 0.01`, a bound that depends on `size`'s
    // CURRENT value and on file order (see linterParser.ts). No fixed literal
    // is citable, so this stays format only, same as `size`.
    it('accepts a Vector3 literal', () => {
      expect(check('origin_offset', 'Vector3(0, 0, 0)')).toBeNull();
    });

    it('accepts a value that would exceed a small default size — no static bound is checked', () => {
      expect(check('origin_offset', 'Vector3(100, 0, 0)')).toBeNull();
    });

    it('rejects a non-Vector3 value', () => {
      expect(check('origin_offset', 'nope')?.code).toBe('INVALID_ORIGIN_OFFSET_FORMAT');
    });
  });

  describe('box_projection / interior / enable_shadows', () => {
    // reflection_probe.cpp:266-268 — plain BOOL, no hint.
    it.each(['box_projection', 'interior', 'enable_shadows'])('accepts true and false for %s', (key) => {
      expect(check(key, 'true')).toBeNull();
      expect(check(key, 'false')).toBeNull();
    });

    it.each(['box_projection', 'interior', 'enable_shadows'])('rejects a non-boolean for %s', (key) => {
      expect(check(key, '1')?.code).toBe(`INVALID_${key.toUpperCase()}_FORMAT`);
    });
  });

  describe('cull_mask / reflection_mask', () => {
    // reflection_probe.cpp:269/270 — PROPERTY_HINT_LAYERS_3D_RENDER, a
    // 32-checkbox widget; both setters are bare assignments, so out-of-range is
    // a warning (ADR-0032), not an error.
    it.each(['cull_mask', 'reflection_mask'])('accepts the default (all 20 3D render layers)', (key) => {
      expect(check(key, '1048575')).toBeNull();
    });

    it.each(['cull_mask', 'reflection_mask'])('accepts the widest 32-bit mask', (key) => {
      expect(check(key, '4294967295')).toBeNull();
    });

    it.each(['cull_mask', 'reflection_mask'])('warns (not errors) past the 32-bit widget width', (key) => {
      const error = check(key, '4294967296');
      expect(error?.severity).toBe('warning');
    });

    it.each(['cull_mask', 'reflection_mask'])('rejects a non-numeric value', (key) => {
      expect(check(key, 'all')?.code).toBe(`INVALID_${key.toUpperCase()}_FORMAT`);
    });
  });

  describe('mesh_lod_threshold', () => {
    // reflection_probe.cpp:271 — PROPERTY_HINT_RANGE "0,1024,0.1", no
    // or_greater/or_less, so both ends are hinted only.
    it('accepts the low end', () => {
      expect(check('mesh_lod_threshold', '0')).toBeNull();
    });

    it('accepts the high end', () => {
      expect(check('mesh_lod_threshold', '1024')).toBeNull();
    });

    it('warns (not errors) above the ceiling', () => {
      const error = check('mesh_lod_threshold', '2000');
      expect(error?.severity).toBe('warning');
    });

    it('rejects a non-numeric value', () => {
      expect(check('mesh_lod_threshold', 'lots')?.code).toBe('INVALID_MESH_LOD_THRESHOLD_FORMAT');
    });
  });

  describe('ambient_mode', () => {
    // reflection_probe.cpp:274 — PROPERTY_HINT_ENUM "Disabled,Environment,Constant Color".
    it.each([0, 1, 2])('accepts %i', (n) => {
      expect(check('ambient_mode', String(n))).toBeNull();
    });

    it('warns past the last constant (set_ambient_mode has no ERR_FAIL)', () => {
      const error = check('ambient_mode', '3');
      expect(error?.severity).toBe('warning');
      expect(error?.code).toBe('INVALID_AMBIENT_MODE_VALUE');
    });

    it('rejects a non-numeric value', () => {
      expect(check('ambient_mode', 'Environment')?.code).toBe('INVALID_AMBIENT_MODE_FORMAT');
    });
  });

  describe('ambient_color', () => {
    // reflection_probe.cpp:275 — PROPERTY_HINT_COLOR_NO_ALPHA is an editor
    // widget hint (hides the alpha slider), not a value constraint; the alpha
    // component still round-trips.
    it('accepts a Color literal, alpha included', () => {
      expect(check('ambient_color', 'Color(0.2, 0.4, 0.6, 1)')).toBeNull();
    });

    it('accepts a non-1 alpha — COLOR_NO_ALPHA only hides the slider, the component still round-trips', () => {
      expect(check('ambient_color', 'Color(0.2, 0.4, 0.6, 0.5)')).toBeNull();
    });

    it('rejects a malformed Color', () => {
      expect(check('ambient_color', 'Color(1, 1)')?.code).toBe('INVALID_AMBIENT_COLOR_FORMAT');
    });
  });

  describe('ambient_color_energy', () => {
    // reflection_probe.cpp:276 — PROPERTY_HINT_RANGE "0,16,0.01", both ends hinted.
    it('accepts the low end', () => {
      expect(check('ambient_color_energy', '0')).toBeNull();
    });

    it('accepts the high end', () => {
      expect(check('ambient_color_energy', '16')).toBeNull();
    });

    it('warns (not errors) above the ceiling', () => {
      const error = check('ambient_color_energy', '20');
      expect(error?.severity).toBe('warning');
    });

    it('rejects a non-numeric value', () => {
      expect(check('ambient_color_energy', 'bright')?.code).toBe('INVALID_AMBIENT_COLOR_ENERGY_FORMAT');
    });
  });
});
