/**
 * The Light2D set must reach its subclasses. Asserted through `findValidator` on
 * a real leaf, not only the abstract key: a tier never imported registers nothing.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import './linterParser.js';

/**
 * Every key Light2D binds, read from its ADD_PROPERTY calls. Set this or
 * DECLARES_NOTHING: leaving both unset fails on purpose, since an empty KEYS
 * against an empty registerAll would pass vacuously.
 */
const KEYS: string[] = [
  'enabled',
  'editor_only',
  'color',
  'energy',
  'blend_mode',
  'range_z_min',
  'range_z_max',
  'range_layer_min',
  'range_layer_max',
  'range_item_cull_mask',
  'shadow_enabled',
  'shadow_color',
  'shadow_filter',
  'shadow_filter_smooth',
  'shadow_item_cull_mask',
];
/** True only when the class binds no ADD_PROPERTY, with the source line that proves it. */
const DECLARES_NOTHING = false;
const LEAVES = ["DirectionalLight2D","PointLight2D"] as const;

describe('Light2D shared validators', () => {
  it('registers exactly what Light2D binds', () => {
    expect(
      DECLARES_NOTHING || KEYS.length > 0,
      'fill KEYS from the ADD_PROPERTY calls, or set DECLARES_NOTHING with the source line that proves it'
    ).toBe(true);
    expect(validatorRegistry.getOwnKeys('Light2D').sort()).toEqual([...KEYS].sort());
  });

  it.each(LEAVES)('delivers every key to %s through the base-walk', (nodeType) => {
    const missing = KEYS.filter((key) => !validatorRegistry.findValidator(nodeType, key));
    expect(missing).toEqual([]);
  });

  // light_2d.cpp:311-312 hint RS::CANVAS_LAYER_MIN..MAX, both ends closed. The
  // setters (light_2d.cpp:125-128, :134-137) only assign, so out of band warns.
  describe.each(['range_layer_min', 'range_layer_max'])('%s', (property) => {
    const check = (value: string) => {
      const validator = validatorRegistry.findValidator('Light2D', property);
      expect(validator, `no validator registered for Light2D.${property}`).not.toBeNull();
      return validator!(property, value, 1);
    };

    it.each(['-2147483648', '0', '2147483647'])('accepts the in-band value %s', (value) => {
      expect(check(value)).toBeNull();
    });

    it.each(['-2147483649', '4294967296'])('errors one step outside int32 on %s', (value) => {
      // Past the 32-bit band the engine keeps bits the file does not state.
      // `2147483648` is inside it: the unsigned spelling of -2147483648, which the
      // hint's own floor allows.
      expect(check(value)?.severity).toBe('error');
    });

    it('takes 2147483648, the unsigned spelling of the int32 floor', () => {
      expect(check('2147483648')).toBeNull();
    });
  });
});
