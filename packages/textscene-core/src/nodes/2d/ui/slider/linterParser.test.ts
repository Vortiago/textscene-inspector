/**
 * The Slider set must reach HSlider and VSlider, which is the whole point of
 * the tier. Assert through `findValidator` on the real leaves, not just on the
 * abstract key: a tier that registers but is never imported registers nothing.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry';
import './linterParser';

const KEYS = ['editable', 'scrollable', 'tick_count', 'ticks_on_borders', 'ticks_position'];
const LEAVES = ['HSlider', 'VSlider'] as const;

/** The error a validator returns for a value, or null when it accepts it. */
function check(nodeType: string, property: string, value: string) {
  const validator = validatorRegistry.findValidator(nodeType, property);
  expect(validator, `no validator reached ${nodeType}.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

describe('Slider shared validators', () => {
  it('registers exactly what Slider binds', () => {
    expect(validatorRegistry.getOwnKeys('Slider').sort()).toEqual([...KEYS].sort());
  });

  it.each(LEAVES)('delivers the whole set to %s through the base-walk', (leaf) => {
    for (const key of KEYS) {
      expect(validatorRegistry.findValidator(leaf, key), `${leaf}.${key}`).not.toBeNull();
    }
  });

  it.each(LEAVES)('leaves %s declaring nothing of its own', (leaf) => {
    // Godot binds no properties on either orientation; both are Slider plus an
    // axis. A key appearing here would be a shadow of the tier.
    expect(validatorRegistry.getOwnKeys(leaf)).toEqual([]);
  });

  it('still reaches Range and Control keys past the tier', () => {
    expect(validatorRegistry.findValidator('HSlider', 'min_value')).not.toBeNull();
    expect(validatorRegistry.findValidator('HSlider', 'anchor_right')).not.toBeNull();
  });

  describe('tick_count', () => {
    it('accepts 0, the default that draws no ticks', () => {
      expect(check('HSlider', 'tick_count', '0')).toBeNull();
    });

    it('accepts 4096, the top of the hint', () => {
      expect(check('HSlider', 'tick_count', '4096')).toBeNull();
    });

    it('rejects 4097 with a WARNING, since neither end is softened by or_greater and set_ticks (slider.cpp:386-392) assigns straight through', () => {
      const error = check('HSlider', 'tick_count', '4097');
      expect(error).not.toBeNull();
      expect(error?.severity).toBe('warning');
    });

    it('rejects a negative count, also a WARNING (slider.cpp:467)', () => {
      const error = check('VSlider', 'tick_count', '-1');
      expect(error).not.toBeNull();
      expect(error?.severity).toBe('warning');
    });
  });

  describe('ticks_position', () => {
    it('accepts 0 (TICK_POSITION_BOTTOM_RIGHT), the first bound constant', () => {
      expect(check('HSlider', 'ticks_position', '0')).toBeNull();
    });

    it('accepts 3 (TICK_POSITION_CENTER), the last bound constant', () => {
      expect(check('HSlider', 'ticks_position', '3')).toBeNull();
    });

    // `slider.cpp:469` passes PROPERTY_HINT_ENUM with no hint string, so the
    // hint states nothing (`p_hint_string` defaults to `""`, `object.h:181`)
    // and `set_ticks_position` (`slider.cpp:416-422`) neither fails nor clamps.
    // Both tiers are therefore absent and the value passes.
    it('accepts a value outside the constant set: the hint carries no string', () => {
      expect(check('HSlider', 'ticks_position', '4')).toBeNull();
      expect(check('VSlider', 'ticks_position', '-1')).toBeNull();
    });

    it('still refuses a value the INT slot cannot read', () => {
      expect(check('HSlider', 'ticks_position', '"middle"')).not.toBeNull();
    });
  });

  describe('editable and scrollable', () => {
    it('accept booleans', () => {
      expect(check('VSlider', 'editable', 'false')).toBeNull();
      expect(check('VSlider', 'scrollable', 'true')).toBeNull();
    });

    it('reject a non-boolean', () => {
      expect(check('VSlider', 'editable', 'yes')).not.toBeNull();
      expect(check('VSlider', 'ticks_on_borders', '1')).not.toBeNull();
    });
  });
});
