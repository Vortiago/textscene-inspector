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

    it('rejects 4097, since neither end is softened by or_greater', () => {
      expect(check('HSlider', 'tick_count', '4097')).not.toBeNull();
    });

    it('rejects a negative count', () => {
      expect(check('VSlider', 'tick_count', '-1')).not.toBeNull();
    });
  });

  describe('ticks_position', () => {
    it('accepts 3 (TICK_POSITION_CENTER), the last bound constant', () => {
      expect(check('HSlider', 'ticks_position', '3')).toBeNull();
    });

    it('rejects 4, one past the four BIND_ENUM_CONSTANT lines', () => {
      expect(check('HSlider', 'ticks_position', '4')).not.toBeNull();
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
